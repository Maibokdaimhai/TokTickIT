import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { authenticatedAgentFor, testPasswordHash, testUserId } from "../authenticated-request.js";

describe("Issue #28: requester ownership and role authorization", () => {
  const marker = randomUUID();
  const filePath = path.join(os.tmpdir(), `toktickit-authz-${marker}.pdf`);
  let otherRequesterId: number;
  let staffId: number;
  let administratorId: number;
  let ownTicketId: number;
  let otherTicketId: number;
  let activeAttachmentId: number;
  let removedAttachmentId: number;
  let requester: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staff: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let administrator: Awaited<ReturnType<typeof authenticatedAgentFor>>;

  beforeAll(async () => {
    const prisma = getPrisma();
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    const users = await Promise.all([
      prisma.user.create({ data: { name: "Authorization Other Requester", email: `${marker}-requester@example.com`, passwordHash: testPasswordHash, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Authorization Staff", email: `${marker}-staff@example.com`, passwordHash: testPasswordHash, mustChangePassword: false, role: "IT_STAFF" } }),
      prisma.user.create({ data: { name: "Authorization Administrator", email: `${marker}-admin@example.com`, passwordHash: testPasswordHash, mustChangePassword: false, role: "ADMINISTRATOR" } }),
    ]);
    [otherRequesterId, staffId, administratorId] = users.map((user) => user.id);
    const [ownTicket, otherTicket] = await Promise.all([
      prisma.ticket.create({ data: { ticketNumber: `TKT-AUTHZ-${marker}-OWN`, requesterId: testUserId, categoryId: category.id, relatedSystemId: system.id, summary: "[Authz Test] Session requester ticket", description: "[Authz Test] Ticket owned by the authenticated requester.", requestedPriority: "MEDIUM", itPriority: "MEDIUM" } }),
      prisma.ticket.create({ data: { ticketNumber: `TKT-AUTHZ-${marker}-OTHER`, requesterId: otherRequesterId, categoryId: category.id, relatedSystemId: system.id, summary: "[Authz Test] Other requester ticket", description: "[Authz Test] Ticket hidden from the authenticated requester.", requestedPriority: "LOW", itPriority: "LOW" } }),
    ]);
    ownTicketId = ownTicket.id;
    otherTicketId = otherTicket.id;
    fs.writeFileSync(filePath, Buffer.from("%PDF-1.4 authorization evidence"));
    const [active, removed] = await Promise.all([
      prisma.attachment.create({ data: { ticketId: otherTicketId, fileName: `authz-${marker}.pdf`, originalName: "authorization.pdf", mimeType: "application/pdf", fileSize: fs.statSync(filePath).size, filePath } }),
      prisma.attachment.create({ data: { ticketId: otherTicketId, fileName: `removed-${marker}.pdf`, originalName: "removed.pdf", mimeType: "application/pdf", fileSize: 10, filePath, isRemoved: true, removalReason: "Obsolete evidence", removedAt: new Date() } }),
    ]);
    activeAttachmentId = active.id;
    removedAttachmentId = removed.id;
    [requester, staff, administrator] = await Promise.all([
      authenticatedAgentFor(app, testUserId),
      authenticatedAgentFor(app, staffId),
      authenticatedAgentFor(app, administratorId),
    ]);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.publicComment.deleteMany({ where: { ticket: { summary: { startsWith: "[Authz Test]" } } } });
    await prisma.ticket.deleteMany({ where: { summary: { startsWith: "[Authz Test]" } } });
    await prisma.user.deleteMany({ where: { id: { in: [otherRequesterId, staffId, administratorId] } } });
    try { fs.unlinkSync(filePath); } catch {}
  });

  it("uses the session identity and ignores forged legacy requester IDs", async () => {
    const list = await requester.get("/api/tickets").query({ requesterId: otherRequesterId, search: "[Authz Test]" });
    expect(list.status).toBe(200);
    expect(list.body.tickets.map((ticket: { id: number }) => ticket.id)).toEqual([ownTicketId]);
    const detail = await requester.get(`/api/tickets/${ownTicketId}`).query({ requesterId: otherRequesterId });
    expect(detail.status).toBe(200);
    expect(detail.body.requesterId).toBe(testUserId);
    expect((await requester.get(`/api/tickets/${ownTicketId}`).query({ unexpected: "field" })).status).toBe(400);
    expect((await requester.get("/api/tickets").query({ unexpected: "field" })).status).toBe(400);
  });

  it("returns non-disclosing 404 responses for another requester's resources", async () => {
    for (const response of [
      await requester.get(`/api/tickets/${otherTicketId}`),
      await requester.get(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}/metadata`),
      await requester.get(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}`),
      await requester.post(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}/remove`).send({ removalReason: "Not my attachment" }),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns identical attachment error bodies for missing and unauthorized requester tickets", async () => {
    const missingTicketId = 2_147_483_647;
    const expectedBody = { error: { code: "NOT_FOUND", message: "Attachment not found" } };
    const upload = (ticketId: number) => requester
      .post(`/api/tickets/${ticketId}/attachments`)
      .attach("file", Buffer.from("%PDF-1.4 hidden ticket probe"), { filename: "probe.pdf", contentType: "application/pdf" });
    const operations = [
      [await upload(missingTicketId), await upload(otherTicketId)],
      [
        await requester.get(`/api/tickets/${missingTicketId}/attachments/${activeAttachmentId}`),
        await requester.get(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}`),
      ],
      [
        await requester.get(`/api/tickets/${missingTicketId}/attachments/${activeAttachmentId}/metadata`),
        await requester.get(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}/metadata`),
      ],
      [
        await requester.post(`/api/tickets/${missingTicketId}/attachments/${activeAttachmentId}/remove`).send({ removalReason: "Probe resource" }),
        await requester.post(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}/remove`).send({ removalReason: "Probe resource" }),
      ],
    ];

    for (const [missing, unauthorized] of operations) {
      expect(missing.status).toBe(404);
      expect(unauthorized.status).toBe(404);
      expect(missing.body).toEqual(expectedBody);
      expect(unauthorized.body).toEqual(expectedBody);
      expect(unauthorized.body).toEqual(missing.body);
    }
  });

  it("returns 409 and retains an owned ticket after staff work has started", async () => {
    const prisma = getPrisma();
    await prisma.publicComment.create({ data: { ticketId: ownTicketId, authorId: staffId, content: "Staff investigation has started." } });
    const response = await requester.delete(`/api/tickets/${ownTicketId}`).query({ requesterId: otherRequesterId });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ROLLBACK_NOT_ALLOWED");
    expect(await prisma.ticket.findUnique({ where: { id: ownTicketId } })).not.toBeNull();
  });

  it.each([
    ["IT Staff", () => staff],
    ["Administrator", () => administrator],
  ])("prevents %s from using requester-only ticket mutation and lookup routes", async (_label, agent) => {
    const client = agent();
    const responses = [
      await client.get("/api/tickets"),
      await client.get(`/api/tickets/${ownTicketId}`),
      await client.post("/api/tickets").send({}),
      await client.delete(`/api/tickets/${ownTicketId}`),
      await client.post(`/api/tickets/${ownTicketId}/attachments`),
      await client.post(`/api/tickets/${ownTicketId}/attachments/${activeAttachmentId}/remove`).send({ removalReason: "Forbidden" }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });

  it.each([
    ["IT Staff", () => staff],
    ["Administrator", () => administrator],
  ])("allows %s to inspect and download attachments on any ticket", async (_label, agent) => {
    const client = agent();
    const metadata = await client.get(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}/metadata`);
    expect(metadata.status).toBe(200);
    expect(metadata.body.id).toBe(activeAttachmentId);
    expect(metadata.body.filePath).toBeUndefined();
    const download = await client.get(`/api/tickets/${otherTicketId}/attachments/${activeAttachmentId}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe("application/pdf");
    const removedMetadata = await client.get(`/api/tickets/${otherTicketId}/attachments/${removedAttachmentId}/metadata`);
    expect(removedMetadata.status).toBe(200);
    expect(removedMetadata.body.isRemoved).toBe(true);
    const removedDownload = await client.get(`/api/tickets/${otherTicketId}/attachments/${removedAttachmentId}`);
    expect(removedDownload.status).toBe(403);
  });

  it("requires the attachment to belong to the ticket for privileged reads", async () => {
    for (const client of [staff, administrator]) {
      const response = await client.get(`/api/tickets/${ownTicketId}/attachments/${activeAttachmentId}/metadata`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    }
  });

  it.each([() => requester, () => staff, () => administrator])("allows every authenticated role to read reference data", async (agent) => {
    expect((await agent().get("/api/categories")).status).toBe(200);
    expect((await agent().get("/api/related-systems")).status).toBe(200);
  });
});
