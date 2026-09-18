import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { authenticatedAgentFor, testPasswordHash } from "../authenticated-request.js";

describe("API-23 & API-24: Attachment Authorization, Version Coordination, and Limits", () => {
  const marker = randomUUID().slice(0, 8);
  let requester1Id: number;
  let requester2Id: number;
  let staffId: number;
  let adminId: number;

  let requester1Agent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let requester2Agent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staffAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let adminAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;

  let categoryId: number;
  let relatedSystemId: number;
  const createdTicketIds: number[] = [];
  const createdFiles: string[] = [];

  const createTempFile = (name: string, content: string = "dummy file content") => {
    const filePath = path.join(process.cwd(), "server", "uploads", `${marker}-${name}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    createdFiles.push(filePath);
    return filePath;
  };

  beforeAll(async () => {
    const prisma = getPrisma();
    const cat = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    categoryId = cat.id;
    const sys = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    relatedSystemId = sys.id;

    const [u1, u2, st, ad] = await Promise.all([
      prisma.user.create({
        data: {
          name: `Req 1 ${marker}`,
          email: `req1-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "REQUESTER",
        },
      }),
      prisma.user.create({
        data: {
          name: `Req 2 ${marker}`,
          email: `req2-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "REQUESTER",
        },
      }),
      prisma.user.create({
        data: {
          name: `Staff ${marker}`,
          email: `staff-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "IT_STAFF",
        },
      }),
      prisma.user.create({
        data: {
          name: `Admin ${marker}`,
          email: `admin-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "ADMINISTRATOR",
        },
      }),
    ]);

    requester1Id = u1.id;
    requester2Id = u2.id;
    staffId = st.id;
    adminId = ad.id;

    [requester1Agent, requester2Agent, staffAgent, adminAgent] = await Promise.all([
      authenticatedAgentFor(app, requester1Id),
      authenticatedAgentFor(app, requester2Id),
      authenticatedAgentFor(app, staffId),
      authenticatedAgentFor(app, adminId),
    ]);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    for (const file of createdFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch {}
      }
    }
    if (createdTicketIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.session.deleteMany({
      where: { userId: { in: [requester1Id, requester2Id, staffId, adminId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [requester1Id, requester2Id, staffId, adminId] } },
    });
  });

  const createTestTicket = async (requesterId: number, suffix: string) => {
    const prisma = getPrisma();
    const t = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${marker}-${suffix}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `Summary ${marker} ${suffix}`,
        description: `Description text for ${marker} ${suffix}`,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status: "NEW",
        version: 0,
      },
    });
    createdTicketIds.push(t.id);
    return t;
  };

  it("API-23: upload and removal increment ticket version and return complete AttachmentMetadata without filePath", async () => {
    const ticket = await createTestTicket(requester1Id, "ver-coord");
    expect(ticket.version).toBe(0);

    // 1. Upload an attachment
    const testFilePath = createTempFile("doc.pdf");
    const uploadRes = await requester1Agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", testFilePath, { filename: "report.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.id).toBeDefined();
    expect(uploadRes.body.ticketId).toBe(ticket.id);
    expect(uploadRes.body.fileName).toBeDefined();
    expect(uploadRes.body.originalName).toBe("report.pdf");
    expect(uploadRes.body.mimeType).toBe("application/pdf");
    expect(uploadRes.body.fileSize).toBeGreaterThan(0);
    expect(uploadRes.body.isRemoved).toBe(false);
    expect(uploadRes.body.removalReason).toBeNull();
    expect(uploadRes.body.removedAt).toBeNull();
    expect(uploadRes.body.createdAt).toBeDefined();
    expect(uploadRes.body.downloadUrl).toBe(`/api/tickets/${ticket.id}/attachments/${uploadRes.body.id}`);
    expect(uploadRes.body.filePath).toBeUndefined(); // NEVER expose filePath

    // Check that ticket version was incremented to 1
    const prisma = getPrisma();
    const tAfterUpload = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(tAfterUpload.version).toBe(1);

    const attachmentId = uploadRes.body.id;

    // 2. Metadata read verifies safe shape
    const metaRes = await requester1Agent
      .get(`/api/tickets/${ticket.id}/attachments/${attachmentId}/metadata`);
    expect(metaRes.status).toBe(200);
    expect(metaRes.body.filePath).toBeUndefined();
    expect(metaRes.body.downloadUrl).toBe(`/api/tickets/${ticket.id}/attachments/${attachmentId}`);

    // 3. Remove the attachment
    const removeRes = await requester1Agent
      .post(`/api/tickets/${ticket.id}/attachments/${attachmentId}/remove`)
      .send({ removalReason: "Obsolete document replaced" });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.id).toBe(attachmentId);
    expect(removeRes.body.ticketId).toBe(ticket.id);
    expect(removeRes.body.isRemoved).toBe(true);
    expect(removeRes.body.removalReason).toBe("Obsolete document replaced");
    expect(removeRes.body.removedAt).toBeDefined();
    expect(removeRes.body.downloadUrl).toBeNull(); // null when removed
    expect(removeRes.body.filePath).toBeUndefined(); // NEVER expose filePath

    // Check that ticket version was incremented to 2
    const tAfterRemove = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(tAfterRemove.version).toBe(2);
  });

  it("API-23: removed download returns 403 ATTACHMENT_REMOVED; missing file returns 404", async () => {
    const ticket = await createTestTicket(requester1Id, "download-rules");
    const prisma = getPrisma();

    // Create a removed attachment in DB
    const removedAtt = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        fileName: "removed.png",
        originalName: "removed.png",
        mimeType: "image/png",
        fileSize: 100,
        filePath: "/nonexistent/path/removed.png",
        isRemoved: true,
        removalReason: "Privacy concerns",
        removedAt: new Date(),
      },
    });

    // Active attachment with missing file on storage
    const missingFileAtt = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        fileName: "missing.png",
        originalName: "missing.png",
        mimeType: "image/png",
        fileSize: 100,
        filePath: "/nonexistent/path/missing.png",
        isRemoved: false,
      },
    });

    // Removed download attempt by owner -> 403 ATTACHMENT_REMOVED
    const resRemoved = await requester1Agent
      .get(`/api/tickets/${ticket.id}/attachments/${removedAtt.id}`);
    expect(resRemoved.status).toBe(403);
    expect(resRemoved.body.error.code).toBe("ATTACHMENT_REMOVED");
    expect(resRemoved.body.error.message).toBe("Cannot download a removed attachment");

    // Removed download attempt by Staff -> 403 ATTACHMENT_REMOVED
    const resStaffRemoved = await staffAgent
      .get(`/api/tickets/${ticket.id}/attachments/${removedAtt.id}`);
    expect(resStaffRemoved.status).toBe(403);
    expect(resStaffRemoved.body.error.code).toBe("ATTACHMENT_REMOVED");

    // Missing file on storage -> 404 NOT_FOUND
    const resMissing = await requester1Agent
      .get(`/api/tickets/${ticket.id}/attachments/${missingFileAtt.id}`);
    expect(resMissing.status).toBe(404);
    expect(resMissing.body.error.code).toBe("NOT_FOUND");
    expect(resMissing.body.error.message).toBe("File not found on storage");
  });

  it("API-23: rejects mismatched ticket/attachment IDs with non-disclosing 404", async () => {
    const ticket1 = await createTestTicket(requester1Id, "t1");
    const ticket2 = await createTestTicket(requester1Id, "t2");
    const prisma = getPrisma();

    const att = await prisma.attachment.create({
      data: {
        ticketId: ticket1.id,
        fileName: "t1-att.png",
        originalName: "t1-att.png",
        mimeType: "image/png",
        fileSize: 100,
        filePath: "/nonexistent/path.png",
        isRemoved: false,
      },
    });

    // Access attachment of ticket1 using ticket2's path
    const resGet = await requester1Agent
      .get(`/api/tickets/${ticket2.id}/attachments/${att.id}`);
    expect(resGet.status).toBe(404);
    expect(resGet.body.error.code).toBe("NOT_FOUND");

    const resMeta = await requester1Agent
      .get(`/api/tickets/${ticket2.id}/attachments/${att.id}/metadata`);
    expect(resMeta.status).toBe(404);
    expect(resMeta.body.error.code).toBe("NOT_FOUND");

    const resRemove = await requester1Agent
      .post(`/api/tickets/${ticket2.id}/attachments/${att.id}/remove`)
      .send({ removalReason: "Attempt mismatched remove" });
    expect(resRemove.status).toBe(404);
    expect(resRemove.body.error.code).toBe("NOT_FOUND");
  });

  it("API-23: denies IT Staff and Administrator for upload, removal, and rollback (Requester-only)", async () => {
    const ticket = await createTestTicket(requester1Id, "staff-denial");
    const testFilePath = createTempFile("staff-test.pdf");

    // Staff upload -> 403
    const staffUpload = await staffAgent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", testFilePath, { filename: "staff.pdf", contentType: "application/pdf" });
    expect(staffUpload.status).toBe(403);

    // Admin upload -> 403
    const adminUpload = await adminAgent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", testFilePath, { filename: "admin.pdf", contentType: "application/pdf" });
    expect(adminUpload.status).toBe(403);

    // Staff remove -> 403
    const staffRemove = await staffAgent
      .post(`/api/tickets/${ticket.id}/attachments/1/remove`)
      .send({ removalReason: "Staff attempt" });
    expect(staffRemove.status).toBe(403);

    // Admin remove -> 403
    const adminRemove = await adminAgent
      .post(`/api/tickets/${ticket.id}/attachments/1/remove`)
      .send({ removalReason: "Admin attempt" });
    expect(adminRemove.status).toBe(403);

    // Staff rollback -> 403
    const staffRollback = await staffAgent.delete(`/api/tickets/${ticket.id}`);
    expect(staffRollback.status).toBe(403);

    // Admin rollback -> 403
    const adminRollback = await adminAgent.delete(`/api/tickets/${ticket.id}`);
    expect(adminRollback.status).toBe(403);
  });

  it("API-23: preserves Unicode filenames in upload and Content-Disposition inline header", async () => {
    const ticket = await createTestTicket(requester1Id, "unicode-file");
    const testFilePath = createTempFile("unicode.pdf");
    const unicodeName = "รายงานการทำงาน_และ_เอกสารแนบ.pdf";

    const uploadRes = await requester1Agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", testFilePath, { filename: unicodeName, contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.originalName).toBe(unicodeName);

    // Download stream should contain safe Content-Disposition
    const dlRes = await requester1Agent
      .get(`/api/tickets/${ticket.id}/attachments/${uploadRes.body.id}`);
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers["content-disposition"]).toBeDefined();
    expect(dlRes.headers["content-disposition"]).toContain("inline");
  });

  it("API-24: failed upload cleans temporary file and does NOT increment ticket version", async () => {
    const ticket = await createTestTicket(requester1Id, "failed-upload");
    const prisma = getPrisma();
    expect(ticket.version).toBe(0);

    const testFilePath = createTempFile("invalid.exe", "binary bytes");
    const uploadRes = await requester1Agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach("file", testFilePath, { filename: "invalid.exe", contentType: "application/octet-stream" });

    expect(uploadRes.status).toBe(400);

    // Version remains 0
    const tAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(tAfter.version).toBe(0);
  });

  it("API-24: enforces maximum 5 active attachments limit concurrently via row locking", async () => {
    const ticket = await createTestTicket(requester1Id, "concurrent-max-5");
    const prisma = getPrisma();

    // 1. Seed 4 active attachments
    for (let i = 1; i <= 4; i++) {
      const f = createTempFile(`seed-${i}.png`);
      const res = await requester1Agent
        .post(`/api/tickets/${ticket.id}/attachments`)
        .attach("file", f, { filename: `seed-${i}.png`, contentType: "image/png" });
      expect(res.status).toBe(201);
    }

    const tAfter4 = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(tAfter4.version).toBe(4);

    // 2. Issue two simultaneous uploads using Promise.all
    const fileA = createTempFile("simul-A.png");
    const fileB = createTempFile("simul-B.png");

    const [resA, resB] = await Promise.all([
      requester1Agent
        .post(`/api/tickets/${ticket.id}/attachments`)
        .attach("file", fileA, { filename: "simul-A.png", contentType: "image/png" }),
      requester1Agent
        .post(`/api/tickets/${ticket.id}/attachments`)
        .attach("file", fileB, { filename: "simul-B.png", contentType: "image/png" }),
    ]);

    const statuses = [resA.status, resB.status];
    // Exactly one should succeed with 201, and the other should fail with 400
    expect(statuses.sort()).toEqual([201, 400]);

    const failedRes = resA.status === 400 ? resA : resB;
    expect(failedRes.body.error.message).toMatch(/limit|5/i);

    // 3. Assert final active count is exactly 5
    const activeAttachments = await prisma.attachment.findMany({
      where: { ticketId: ticket.id, isRemoved: false },
    });
    expect(activeAttachments).toHaveLength(5);

    // 4. Ticket version was incremented to 5 by the winning upload
    const tFinal = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(tFinal.version).toBe(5);
  });

  it("API-24 / BR-30: compensation rollback cannot delete a ticket after staff work, comments, or notes exist", async () => {
    const ticket = await createTestTicket(requester1Id, "rollback-guard");
    const prisma = getPrisma();

    // 1. Add a public comment -> ticket can no longer be rolled back
    await prisma.publicComment.create({
      data: {
        ticketId: ticket.id,
        authorId: requester1Id,
        content: "Draft comment",
      },
    });

    const rollbackRes = await requester1Agent.delete(`/api/tickets/${ticket.id}`);
    expect(rollbackRes.status).toBe(409);
    expect(rollbackRes.body.error.code).toBe("ROLLBACK_NOT_ALLOWED");

    // Ticket still exists
    const tExists = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(tExists).not.toBeNull();
  });
});
