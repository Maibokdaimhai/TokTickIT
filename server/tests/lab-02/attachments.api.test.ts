import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import fs from "fs";
import path from "path";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Attachments Lifecycle & Soft Removal API (Lab 2)", () => {
  let userAId: number;
  let userBId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketId: number;
  let otherUserTicketId: number;

  const samplePdfBuffer = Buffer.from("%PDF-1.4 sample test pdf document");
  const samplePngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  beforeAll(async () => {
    const prisma = getPrisma();

    // Clean up any stale test data
    await prisma.attachment.deleteMany({
      where: {
        originalName: { startsWith: "[Att Test]" },
      },
    });

    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[Att Test]" },
      },
    });

    await prisma.requesterUser.deleteMany({
      where: {
        email: {
          in: ["att.userA@example.com", "att.userB@example.com"],
        },
      },
    });

    const userA = await prisma.requesterUser.create({
      data: {
        name: "Att User A",
        email: "att.userA@example.com",
        department: "Engineering",
        isActive: true,
      },
    });
    userAId = userA.id;

    const userB = await prisma.requesterUser.create({
      data: {
        name: "Att User B",
        email: "att.userB@example.com",
        department: "Product",
        isActive: true,
      },
    });
    userBId = userB.id;

    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    categoryId = category!.id;
    relatedSystemId = system!.id;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-880001",
        requesterId: userAId,
        categoryId,
        relatedSystemId,
        requestedPriority: "MEDIUM",
        status: "NEW",
        summary: "[Att Test] Main Ticket",
        description: "[Att Test] Testing attachment uploads and soft removals.",
      },
    });
    ticketId = ticket.id;

    const otherTicket = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-880002",
        requesterId: userBId,
        categoryId,
        relatedSystemId,
        requestedPriority: "LOW",
        status: "NEW",
        summary: "[Att Test] Other User Ticket",
        description: "[Att Test] Belongs to User B.",
      },
    });
    otherUserTicketId = otherTicket.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();

    // Clean up files created during tests
    const attachments = await prisma.attachment.findMany({
      where: {
        originalName: { startsWith: "[Att Test]" },
      },
    });

    for (const att of attachments) {
      if (att.filePath && fs.existsSync(att.filePath)) {
        try { fs.unlinkSync(att.filePath); } catch {}
      }
    }

    await prisma.attachment.deleteMany({
      where: {
        originalName: { startsWith: "[Att Test]" },
      },
    });

    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[Att Test]" },
      },
    });

    await prisma.requesterUser.deleteMany({
      where: {
        email: {
          in: ["att.userA@example.com", "att.userB@example.com"],
        },
      },
    });
  });

  it("API-07 / AC-05: successfully uploads an active attachment and saves to disk", async () => {
    const res = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", userAId)
      .attach("file", samplePdfBuffer, {
        filename: "[Att Test] document.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.originalName).toBe("[Att Test] document.pdf");
    expect(res.body.mimeType).toBe("application/pdf");
    expect(res.body.isRemoved).toBe(false);
    expect(res.body.removalReason).toBeNull();
  });

  it("API-07 / BR-08: rejects attachment when 5 active attachments limit is reached", async () => {
    // We already have 1 active attachment from previous test.
    // Upload 4 more to reach 5 active attachments.
    for (let i = 2; i <= 5; i++) {
      const uploadRes = await supertest(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .field("requesterId", userAId)
        .attach("file", samplePngBuffer, {
          filename: `[Att Test] extra-${i}.png`,
          contentType: "image/png",
        });
      expect(uploadRes.status).toBe(201);
    }

    // Now try to upload a 6th active attachment
    const overLimitRes = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", userAId)
      .attach("file", samplePdfBuffer, {
        filename: "[Att Test] sixth-overlimit.pdf",
        contentType: "application/pdf",
      });

    expect(overLimitRes.status).toBe(400);
    expect(overLimitRes.body.error).toBeDefined();
    expect(overLimitRes.body.error.code).toBe("ATTACHMENT_LIMIT_EXCEEDED");
    expect(overLimitRes.body.error.message).toContain("maximum of 5 active attachments");
  });

  it("API-08 / AC-08 / BR-10: rejects soft removal if removal reason is missing or < 3 characters", async () => {
    const prisma = getPrisma();
    const att = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: false },
    });

    // Empty reason
    const res1 = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments/${att!.id}/remove`)
      .send({ requesterId: userAId, removalReason: "" });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("BAD_REQUEST");
    expect(res1.body.error.message).toContain("at least 3 characters");

    // Whitespace only
    const res2 = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments/${att!.id}/remove`)
      .send({ requesterId: userAId, removalReason: "   " });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("BAD_REQUEST");

    // Less than 3 characters
    const res3 = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments/${att!.id}/remove`)
      .send({ requesterId: userAId, removalReason: "no" });
    expect(res3.status).toBe(400);
    expect(res3.body.error.code).toBe("BAD_REQUEST");
  });

  it("API-08 / BR-05: rejects soft removal if ticket belongs to another requester", async () => {
    const prisma = getPrisma();
    const att = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: false },
    });

    // User B tries to remove User A's attachment
    const res = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments/${att!.id}/remove`)
      .send({ requesterId: userBId, removalReason: "Attempted unauthorized removal" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Access denied");
  });

  it("API-08 / AC-07 / BR-09: successfully soft-removes attachment with valid reason", async () => {
    const prisma = getPrisma();
    const att = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: false },
    });

    const res = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments/${att!.id}/remove`)
      .send({
        requesterId: userAId,
        removalReason: "Uploaded wrong screenshot with sensitive information",
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(att!.id);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removalReason).toBe("Uploaded wrong screenshot with sensitive information");
    expect(res.body.removedAt).toBeDefined();

    // Verify in database
    const inDb = await prisma.attachment.findUnique({ where: { id: att!.id } });
    expect(inDb!.isRemoved).toBe(true);
    expect(inDb!.removalReason).toBe("Uploaded wrong screenshot with sensitive information");
    expect(inDb!.removedAt).not.toBeNull();
  });

  it("API-09 / AC-07 / BR-09: returns 403 Forbidden when attempting to download a soft-removed attachment", async () => {
    const prisma = getPrisma();
    const removedAtt = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: true },
    });

    const res = await supertest(app)
      .get(`/api/tickets/${ticketId}/attachments/${removedAtt!.id}`)
      .query({ requesterId: userAId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Cannot download a removed attachment");
  });

  it("streams active attachment file content successfully for ticket owner", async () => {
    const prisma = getPrisma();
    const activeAtt = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: false },
    });

    const res = await supertest(app)
      .get(`/api/tickets/${ticketId}/attachments/${activeAtt!.id}`)
      .query({ requesterId: userAId });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe(activeAtt!.mimeType);
    expect(res.headers["content-disposition"]).toContain("inline");
  });

  it("streams active attachment with UTF-8 / Thai filename using RFC 6266 and RFC 5987 Content-Disposition without 500 errors", async () => {
    const thaiFilename = "หลักฐาน.pdf";
    const uploadRes = await supertest(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .field("requesterId", userAId)
      .attach("file", Buffer.from("%PDF-1.4 mock thai pdf content"), {
        filename: thaiFilename,
        contentType: "application/pdf",
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.originalName).toBe(thaiFilename);

    const attachmentId = uploadRes.body.id;

    // Download the UTF-8 named attachment
    const downloadRes = await supertest(app)
      .get(`/api/tickets/${ticketId}/attachments/${attachmentId}`)
      .query({ requesterId: userAId });

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toBe("application/pdf");
    expect(downloadRes.headers["content-disposition"]).toContain("inline");
    expect(downloadRes.headers["content-disposition"]).toContain("filename*=");
    expect(downloadRes.headers["content-disposition"]).toContain(encodeURIComponent(thaiFilename));
  });

  it("returns 403 Forbidden when attempting to download an attachment belonging to another requester", async () => {
    const prisma = getPrisma();
    const activeAtt = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: false },
    });

    // User B tries to download User A's active attachment
    const res = await supertest(app)
      .get(`/api/tickets/${ticketId}/attachments/${activeAtt!.id}`)
      .query({ requesterId: userBId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("retrieves attachment metadata JSON for active and removed attachments", async () => {
    const prisma = getPrisma();
    const removedAtt = await prisma.attachment.findFirst({
      where: { ticketId, isRemoved: true },
    });

    const res = await supertest(app)
      .get(`/api/tickets/${ticketId}/attachments/${removedAtt!.id}/metadata`)
      .query({ requesterId: userAId });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(removedAtt!.id);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removalReason).toBe(removedAtt!.removalReason);
  });
});
