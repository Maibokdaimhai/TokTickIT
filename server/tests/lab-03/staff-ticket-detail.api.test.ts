import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { authenticatedAgentFor, testPasswordHash } from "../authenticated-request.js";

describe("API-08, API-09, API-10, API-18, API-21: Staff Ticket Detail Operations and Sequential Mutation", () => {
  const marker = randomUUID();
  let requesterId: number;
  let staffAId: number;
  let staffBId: number;
  let adminId: number;
  let inactiveStaffId: number;

  let requester: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staffA: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staffB: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let admin: Awaited<ReturnType<typeof authenticatedAgentFor>>;

  let categoryId: number;
  let systemId: number;
  let relatedSystemId: number;
  let testTicketId: number;
  let tempFilePath: string;
  let activeAttachmentId: number;
  let removedAttachmentId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    categoryId = category.id;
    systemId = system.id;
    relatedSystemId = system.id;

    const [uReq, uStaffA, uStaffB, uAdmin, uInactiveStaff] = await Promise.all([
      prisma.user.create({ data: { name: "Requester Oper", email: `req-${marker}@example.com`, passwordHash: testPasswordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Staff Alpha", email: `staffA-${marker}@example.com`, passwordHash: testPasswordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Staff Beta", email: `staffB-${marker}@example.com`, passwordHash: testPasswordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Admin Oper", email: `admin-${marker}@example.com`, passwordHash: testPasswordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Inactive Staff", email: `inactivestaff-${marker}@example.com`, passwordHash: testPasswordHash, role: "IT_STAFF", isActive: false, mustChangePassword: false } }),
    ]);
    requesterId = uReq.id;
    staffAId = uStaffA.id;
    staffBId = uStaffB.id;
    adminId = uAdmin.id;
    inactiveStaffId = uInactiveStaff.id;

    [requester, staffA, staffB, admin] = await Promise.all([
      authenticatedAgentFor(app, requesterId),
      authenticatedAgentFor(app, staffAId),
      authenticatedAgentFor(app, staffBId),
      authenticatedAgentFor(app, adminId),
    ]);

    tempFilePath = path.join(os.tmpdir(), `toktickit-staff-ops-${marker}.pdf`);
    fs.writeFileSync(tempFilePath, Buffer.from("%PDF-1.4 staff ticket detail evidence"));

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-OPS-${marker.substring(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId: systemId,
        summary: `[Ops Test] Ticket for staff detail operations ${marker}`,
        description: "Testing staff operations and ticket mutation lifecycle.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status: "NEW",
        version: 0,
      },
    });
    testTicketId = ticket.id;

    const [att1, att2] = await Promise.all([
      prisma.attachment.create({
        data: {
          ticketId: testTicketId,
          fileName: `active-${marker}.pdf`,
          originalName: "active.pdf",
          mimeType: "application/pdf",
          fileSize: 20,
          filePath: tempFilePath,
          isRemoved: false,
        },
      }),
      prisma.attachment.create({
        data: {
          ticketId: testTicketId,
          fileName: `removed-${marker}.pdf`,
          originalName: "removed.pdf",
          mimeType: "application/pdf",
          fileSize: 20,
          filePath: tempFilePath,
          isRemoved: true,
          removalReason: "Obsolete attachment",
          removedAt: new Date(),
        },
      }),
    ]);
    activeAttachmentId = att1.id;
    removedAttachmentId = att2.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
    const tickets = await prisma.ticket.findMany({ where: { summary: { contains: marker } }, select: { id: true } });
    const ticketIds = [testTicketId, ...tickets.map((t) => t.id)].filter((id): id is number => typeof id === "number");
    if (ticketIds.length > 0) {
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [requesterId, staffAId, staffBId, adminId, inactiveStaffId].filter((id): id is number => typeof id === "number") } } });
  });

  describe("API-08: Staff Ticket Detail GET", () => {
    it("returns complete StaffTicketDetail for IT Staff and Administrator", async () => {
      const res = await staffA.get(`/api/staff/tickets/${testTicketId}`);
      expect(res.status).toBe(200);
      const data = res.body;

      expect(data.id).toBe(testTicketId);
      expect(data.ticketNumber).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.description).toBeDefined();
      expect(data.status).toBe("NEW");
      expect(data.owner).toBeNull();
      expect(data.requester).toEqual({
        id: requesterId,
        name: "Requester Oper",
        email: `req-${marker}@example.com`,
        role: "REQUESTER",
        isActive: true,
      });
      expect(data.category).toHaveProperty("id", categoryId);
      expect(data.relatedSystem).toHaveProperty("id", systemId);
      expect(data.attachments).toHaveLength(2);
      const activeAtt = data.attachments.find((a: any) => a.id === activeAttachmentId);
      const removedAtt = data.attachments.find((a: any) => a.id === removedAttachmentId);
      expect(activeAtt.downloadUrl).toBe(`/api/tickets/${testTicketId}/attachments/${activeAttachmentId}`);
      expect(removedAtt.downloadUrl).toBeNull();
      expect(data.publicComments).toEqual([]);
      expect(data.internalNotes).toEqual([]);
      expect(data.version).toBe(0);
      expect(data.problemAppearsResolvedAt).toBeNull();
      expect(data.problemAppearsResolvedById).toBeNull();
    });

    it("denies Requester with 403 FORBIDDEN before ticket query", async () => {
      const res = await requester.get(`/api/staff/tickets/${testTicketId}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 for non-existent ticket", async () => {
      const res = await staffA.get(`/api/staff/tickets/99999999`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("allows Staff and Admin to download active attachment, denying removed with ATTACHMENT_REMOVED", async () => {
      const dlActive = await staffA.get(`/api/tickets/${testTicketId}/attachments/${activeAttachmentId}`);
      expect(dlActive.status).toBe(200);
      expect(dlActive.header["content-type"]).toContain("application/pdf");

      const dlRemoved = await staffA.get(`/api/tickets/${testTicketId}/attachments/${removedAttachmentId}`);
      expect(dlRemoved.status).toBe(403);
      expect(dlRemoved.body.error.code).toBe("ATTACHMENT_REMOVED");
    });
  });

  describe("API-09: Claim Ticket", () => {
    let claimTicketId: number;

    beforeAll(async () => {
      const prisma = getPrisma();
      const t = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-CLAIM-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Claim Test] ${marker}`,
          description: "Testing claim ticket",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "NEW",
          version: 0,
        },
      });
      claimTicketId = t.id;
    });

    it("claims unassigned NEW ticket, setting owner and atomically changing status to OPEN with version increment", async () => {
      const res = await staffA
        .post(`/api/staff/tickets/${claimTicketId}/claim`)
        .send({ expectedVersion: 0 });

      expect(res.status).toBe(200);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.ticket.owner).toEqual({
        id: staffAId,
        name: "Staff Alpha",
        email: `staffA-${marker}@example.com`,
        role: "IT_STAFF",
      });
      expect(res.body.ticket.status).toBe("OPEN"); // NEW -> OPEN transition on claim
      expect(res.body.ticket.version).toBe(1);
    });

    it("rejects claiming an already-assigned ticket with 409 CONFLICT (ALREADY_ASSIGNED)", async () => {
      const res = await staffB
        .post(`/api/staff/tickets/${claimTicketId}/claim`)
        .send({ expectedVersion: 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ALREADY_ASSIGNED");
    });

    it("rejects claim with stale expectedVersion with 409 CONFLICT (VERSION_CONFLICT)", async () => {
      const prisma = getPrisma();
      const unassigned = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-CLAIM-STALE-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Claim Stale Test] ${marker}`,
          description: "Stale claim test",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "NEW",
          version: 2,
        },
      });

      const res = await staffA
        .post(`/api/staff/tickets/${unassigned.id}/claim`)
        .send({ expectedVersion: 0 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("VERSION_CONFLICT");
    });

    it("coordinates concurrent claim race so exactly one wins and the other receives 409", async () => {
      const prisma = getPrisma();
      const raceTicket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-RACE-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Race Test] ${marker}`,
          description: "Race test",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "NEW",
          version: 0,
        },
      });

      const [resA, resB] = await Promise.all([
        staffA.post(`/api/staff/tickets/${raceTicket.id}/claim`).send({ expectedVersion: 0 }),
        staffB.post(`/api/staff/tickets/${raceTicket.id}/claim`).send({ expectedVersion: 0 }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });

  describe("API-10: Update Owner", () => {
    let ownerTicketId: number;

    beforeAll(async () => {
      const prisma = getPrisma();
      const t = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-OWNER-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Owner Test] ${marker}`,
          description: "Testing update owner",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "OPEN",
          version: 0,
        },
      });
      ownerTicketId = t.id;
    });

    it("reassigns ticket to another active IT Staff member", async () => {
      const res = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: staffBId, expectedVersion: 0 });

      expect(res.status).toBe(200);
      expect(res.body.ticket.owner).toEqual({
        id: staffBId,
        name: "Staff Beta",
        email: `staffB-${marker}@example.com`,
        role: "IT_STAFF",
      });
      expect(res.body.ticket.version).toBe(1);
    });

    it("allows unassigning ticket by setting ownerId to null without changing status", async () => {
      const res = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: null, expectedVersion: 1 });

      expect(res.status).toBe(200);
      expect(res.body.ticket.owner).toBeNull();
      expect(res.body.ticket.status).toBe("OPEN"); // Owner update does not change status
      expect(res.body.ticket.version).toBe(2);
    });

    it("rejects ineligible owner (inactive staff, requester, or nonexistent user) with 400 INVALID_OWNER", async () => {
      // Inactive staff
      const inactiveRes = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: inactiveStaffId, expectedVersion: 2 });
      expect(inactiveRes.status).toBe(400);
      expect(inactiveRes.body.error.code).toBe("INVALID_OWNER");

      // Requester
      const reqRes = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: requesterId, expectedVersion: 2 });
      expect(reqRes.status).toBe(400);
      expect(reqRes.body.error.code).toBe("INVALID_OWNER");

      // Nonexistent user
      const nonExistentRes = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: 9999999, expectedVersion: 2 });
      expect(nonExistentRes.status).toBe(400);
      expect(nonExistentRes.body.error.code).toBe("INVALID_OWNER");
    });

    it("rejects string representation of number like '7' with 400", async () => {
      const strRes = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: `${staffBId}`, expectedVersion: 2 });
      expect(strRes.status).toBe(400);
    });

    it("rejects update with stale expectedVersion with 409", async () => {
      const staleRes = await staffA
        .patch(`/api/staff/tickets/${ownerTicketId}/owner`)
        .send({ ownerId: staffAId, expectedVersion: 0 });
      expect(staleRes.status).toBe(409);
      expect(staleRes.body.error.code).toBe("VERSION_CONFLICT");
    });
  });

  describe("API-18: Update IT Priority", () => {
    let priorityTicketId: number;

    beforeAll(async () => {
      const prisma = getPrisma();
      const t = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-PRIO-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Priority Test] ${marker}`,
          description: "Testing update IT Priority",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "OPEN",
          version: 0,
        },
      });
      priorityTicketId = t.id;
    });

    it("updates IT Priority while leaving requestedPriority unchanged", async () => {
      const res = await staffA
        .patch(`/api/staff/tickets/${priorityTicketId}/it-priority`)
        .send({ itPriority: "URGENT", expectedVersion: 0 });

      expect(res.status).toBe(200);
      expect(res.body.ticket.itPriority).toBe("URGENT");
      expect(res.body.ticket.requestedPriority).toBe("LOW"); // Unchanged
      expect(res.body.ticket.version).toBe(1);
    });

    it("rejects invalid priority values with 400", async () => {
      const res = await staffA
        .patch(`/api/staff/tickets/${priorityTicketId}/it-priority`)
        .send({ itPriority: "SUPER_URGENT", expectedVersion: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects update with stale expectedVersion with 409", async () => {
      const res = await staffA
        .patch(`/api/staff/tickets/${priorityTicketId}/it-priority`)
        .send({ itPriority: "HIGH", expectedVersion: 0 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("VERSION_CONFLICT");
    });
  });

  describe("API-21: Update Status and Confirmation Policy", () => {
    let statusTicketId: number;

    beforeAll(async () => {
      const prisma = getPrisma();
      const t = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-STATUS-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Status Test] ${marker}`,
          description: "Testing status transitions",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "NEW",
          ownerId: staffAId, // Pre-assign owner
          version: 0,
        },
      });
      statusTicketId = t.id;
    });

    it("enforces status transition matrix; rejects illegal transition with 400", async () => {
      // NEW -> CLOSED is illegal
      const illegalRes = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "CLOSED", expectedStatus: "NEW", expectedVersion: 0, confirmed: true });
      expect(illegalRes.status).toBe(400);
      expect(illegalRes.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("requires confirmed: true for confirmation statuses (RESOLVED, CLOSED, CANCELLED, REOPENED)", async () => {
      // Move to OPEN first (unconfirmed is fine for OPEN)
      const openRes = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "OPEN", expectedStatus: "NEW", expectedVersion: 0 });
      expect(openRes.status).toBe(200);
      expect(openRes.body.ticket.status).toBe("OPEN");
      expect(openRes.body.ticket.version).toBe(1);

      // OPEN -> RESOLVED requires confirmation
      const unconfirmedRes = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1 });
      expect(unconfirmedRes.status).toBe(400);
      expect(unconfirmedRes.body.error.code).toBe("CONFIRMATION_REQUIRED");

      // Non-boolean confirmed (e.g. "true") is rejected
      const nonBoolRes = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: "true" });
      expect(nonBoolRes.status).toBe(400);

      // confirmed: true succeeds
      const resolvedRes = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: true });
      expect(resolvedRes.status).toBe(200);
      expect(resolvedRes.body.ticket.status).toBe("RESOLVED");
      expect(resolvedRes.body.ticket.version).toBe(2);
    });

    it("requires eligible owner for IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED", async () => {
      const prisma = getPrisma();
      const unownedTicket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-NOOWNER-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[No Owner Test] ${marker}`,
          description: "No owner test",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "OPEN",
          ownerId: null, // Unassigned
          version: 0,
        },
      });

      const res = await staffA
        .patch(`/api/staff/tickets/${unownedTicket.id}/status`)
        .send({ status: "IN_PROGRESS", expectedStatus: "OPEN", expectedVersion: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("OWNER_REQUIRED");
    });

    it("clears problemAppearsResolved indication atomically when transitioning to REOPENED", async () => {
      const prisma = getPrisma();
      // Set resolved ticket with resolution indication
      const now = new Date();
      await prisma.ticket.update({
        where: { id: statusTicketId },
        data: {
          problemAppearsResolvedAt: now,
          problemAppearsResolvedById: requesterId,
        },
      });

      // RESOLVED -> REOPENED (requires confirmed: true)
      const reopenRes = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "REOPENED", expectedStatus: "RESOLVED", expectedVersion: 2, confirmed: true });

      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.ticket.status).toBe("REOPENED");
      expect(reopenRes.body.ticket.problemAppearsResolvedAt).toBeNull();
      expect(reopenRes.body.ticket.problemAppearsResolvedById).toBeNull();
      expect(reopenRes.body.ticket.version).toBe(3);
    });

    it("rejects status update with stale expectedStatus or expectedVersion with 409", async () => {
      const staleStatus = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "OPEN", expectedStatus: "NEW", expectedVersion: 3 });
      expect(staleStatus.status).toBe(409);
      expect(staleStatus.body.error.code).toBe("STATUS_CONFLICT");

      const staleVersion = await staffA
        .patch(`/api/staff/tickets/${statusTicketId}/status`)
        .send({ status: "OPEN", expectedStatus: "REOPENED", expectedVersion: 0 });
      expect(staleVersion.status).toBe(409);
      expect(staleVersion.body.error.code).toBe("VERSION_CONFLICT");
    });
  });

  describe("Sequential mutation after comment/note regression test", () => {
    it("handles sequence: create (v0) -> internal note (v1) -> stale claim (409) -> claim (v2) -> comment (v3) -> stale status (409) -> status (v4)", async () => {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-SEQ-${marker.substring(0, 8)}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `[Sequential Regression] ${marker}`,
          description: "Testing sequential mutations across operations",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          status: "NEW",
          version: 0,
        },
      });
      const seqTicketId = ticket.id;

      // 1. Post internal note -> version increments to 1
      const noteRes = await staffA
        .post(`/api/staff/tickets/${seqTicketId}/internal-notes`)
        .send({ content: "Initial triage note" });
      expect(noteRes.status).toBe(201);

      const afterNote = await prisma.ticket.findUniqueOrThrow({ where: { id: seqTicketId } });
      expect(afterNote.version).toBe(1);

      // 2. Claim with expectedVersion 0 fails with 409 VERSION_CONFLICT
      const staleClaim = await staffA
        .post(`/api/staff/tickets/${seqTicketId}/claim`)
        .send({ expectedVersion: 0 });
      expect(staleClaim.status).toBe(409);
      expect(staleClaim.body.error.code).toBe("VERSION_CONFLICT");

      // 3. Claim with expectedVersion 1 succeeds -> status OPEN, version 2
      const goodClaim = await staffA
        .post(`/api/staff/tickets/${seqTicketId}/claim`)
        .send({ expectedVersion: 1 });
      expect(goodClaim.status).toBe(200);
      expect(goodClaim.body.ticket.status).toBe("OPEN");
      expect(goodClaim.body.ticket.version).toBe(2);

      // 4. Post public comment -> version increments to 3
      const commentRes = await requester
        .post(`/api/tickets/${seqTicketId}/public-comments`)
        .send({ content: "Requester following up" });
      expect(commentRes.status).toBe(201);

      const afterComment = await prisma.ticket.findUniqueOrThrow({ where: { id: seqTicketId } });
      expect(afterComment.version).toBe(3);

      // 5. Change status with expectedVersion 2 fails with 409 VERSION_CONFLICT
      const staleStatus = await staffA
        .patch(`/api/staff/tickets/${seqTicketId}/status`)
        .send({ status: "IN_PROGRESS", expectedStatus: "OPEN", expectedVersion: 2 });
      expect(staleStatus.status).toBe(409);
      expect(staleStatus.body.error.code).toBe("VERSION_CONFLICT");

      // 6. Change status with expectedVersion 3 succeeds -> status IN_PROGRESS, version 4
      const goodStatus = await staffA
        .patch(`/api/staff/tickets/${seqTicketId}/status`)
        .send({ status: "IN_PROGRESS", expectedStatus: "OPEN", expectedVersion: 3 });
      expect(goodStatus.status).toBe(200);
      expect(goodStatus.body.ticket.status).toBe("IN_PROGRESS");
      expect(goodStatus.body.ticket.version).toBe(4);
    });
  });
});
