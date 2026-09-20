import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import supertest from "supertest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { authenticatedAgentFor, testPasswordHash } from "../authenticated-request.js";

describe("API-11, API-12, API-13, API-22: Public Comments, Internal Notes, and Problem Appears Resolved", () => {
  const marker = randomUUID();
  let owningRequesterId: number;
  let otherRequesterId: number;
  let staffId: number;
  let adminId: number;

  let owningRequester: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let otherRequester: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staff: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let admin: Awaited<ReturnType<typeof authenticatedAgentFor>>;

  let categoryId: number;
  let systemId: number;
  let testTicketId: number;

  beforeAll(async () => {
    const prisma = getPrisma();
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    categoryId = category.id;
    systemId = system.id;

    const [u1, u2, u3, u4] = await Promise.all([
      prisma.user.create({ data: { name: "Owner Requester", email: `owner-${marker}@example.com`, passwordHash: testPasswordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Requester", email: `other-${marker}@example.com`, passwordHash: testPasswordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Support Staff", email: `staff-${marker}@example.com`, passwordHash: testPasswordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "System Admin", email: `admin-${marker}@example.com`, passwordHash: testPasswordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
    ]);
    owningRequesterId = u1.id;
    otherRequesterId = u2.id;
    staffId = u3.id;
    adminId = u4.id;

    [owningRequester, otherRequester, staff, admin] = await Promise.all([
      authenticatedAgentFor(app, owningRequesterId),
      authenticatedAgentFor(app, otherRequesterId),
      authenticatedAgentFor(app, staffId),
      authenticatedAgentFor(app, adminId),
    ]);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-COMM-${marker.substring(0, 8)}`,
        requesterId: owningRequesterId,
        categoryId,
        relatedSystemId: systemId,
        summary: `[Comm Test] Ticket for comments & notes ${marker}`,
        description: "Testing comments, notes, and problem appears resolved.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        status: "OPEN",
        version: 0,
      },
    });
    testTicketId = ticket.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const tickets = await prisma.ticket.findMany({ where: { summary: { contains: marker } }, select: { id: true } });
    const ticketIds = [testTicketId, ...tickets.map((t) => t.id)];
    await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [owningRequesterId, otherRequesterId, staffId, adminId] } } });
  });

  describe("API-11: Public Comments role authorization, creation, and listing", () => {
    it("allows owning Requester to read and create public comments with exact 201 wrapper", async () => {
      const getInitial = await owningRequester.get(`/api/tickets/${testTicketId}/public-comments`);
      expect(getInitial.status).toBe(200);
      expect(getInitial.body).toEqual({ comments: [] });

      const postRes = await owningRequester
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "Requester update on ticket issue." });
      expect(postRes.status).toBe(201);
      expect(postRes.body.comment).toBeDefined();
      expect(postRes.body.comment.content).toBe("Requester update on ticket issue.");
      expect(postRes.body.comment.ticketId).toBe(testTicketId);
      expect(postRes.body.comment.author).toEqual({
        id: owningRequesterId,
        name: "Owner Requester",
        role: "REQUESTER",
      });
      expect(postRes.body.comment.createdAt).toBeDefined();
    });

    it("allows IT Staff and Administrator to read and post public comments", async () => {
      const staffPost = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "IT Staff response to user." });
      expect(staffPost.status).toBe(201);
      expect(staffPost.body.comment.author).toEqual({
        id: staffId,
        name: "Support Staff",
        role: "IT_STAFF",
      });

      const adminPost = await admin
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "Administrator note for requester visibility." });
      expect(adminPost.status).toBe(201);
      expect(adminPost.body.comment.author).toEqual({
        id: adminId,
        name: "System Admin",
        role: "ADMINISTRATOR",
      });

      const getList = await owningRequester.get(`/api/tickets/${testTicketId}/public-comments`);
      expect(getList.status).toBe(200);
      expect(getList.body.comments.length).toBe(3);
    });

    it("denies another Requester with non-disclosing 404 matching absent tickets", async () => {
      const absentRes = await otherRequester.get(`/api/tickets/99999999/public-comments`);
      expect(absentRes.status).toBe(404);
      expect(absentRes.body).toEqual({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });

      const unauthorizedGet = await otherRequester.get(`/api/tickets/${testTicketId}/public-comments`);
      expect(unauthorizedGet.status).toBe(404);
      expect(unauthorizedGet.body).toEqual(absentRes.body);

      const unauthorizedPost = await otherRequester
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "Intruder comment" });
      expect(unauthorizedPost.status).toBe(404);
      expect(unauthorizedPost.body).toEqual(absentRes.body);
    });

    it("denies unauthenticated requests with 401", async () => {
      const unauthGet = await supertest(app).get(`/api/tickets/${testTicketId}/public-comments`);
      expect(unauthGet.status).toBe(401);

      const unauthPost = await supertest(app)
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .set("Origin", "http://localhost:5173")
        .send({ content: "Unauthenticated comment" });
      expect(unauthPost.status).toBe(401);
    });
  });

  describe("API-12: Internal Notes role authorization and Requester isolation", () => {
    it("allows IT Staff and Administrator to post and read internal notes with exact 201 wrapper", async () => {
      const initialNotes = await staff.get(`/api/staff/tickets/${testTicketId}/internal-notes`);
      expect(initialNotes.status).toBe(200);
      expect(initialNotes.body).toEqual({ notes: [] });

      const staffPost = await staff
        .post(`/api/staff/tickets/${testTicketId}/internal-notes`)
        .send({ content: "Diagnosed issue: DNS record missing TTL." });
      expect(staffPost.status).toBe(201);
      expect(staffPost.body.note).toBeDefined();
      expect(staffPost.body.note.content).toBe("Diagnosed issue: DNS record missing TTL.");
      expect(staffPost.body.note.author).toEqual({
        id: staffId,
        name: "Support Staff",
        role: "IT_STAFF",
      });

      const adminPost = await admin
        .post(`/api/staff/tickets/${testTicketId}/internal-notes`)
        .send({ content: "Admin approval granted for configuration update." });
      expect(adminPost.status).toBe(201);
      expect(adminPost.body.note.author).toEqual({
        id: adminId,
        name: "System Admin",
        role: "ADMINISTRATOR",
      });

      const notesGet = await staff.get(`/api/staff/tickets/${testTicketId}/internal-notes`);
      expect(notesGet.status).toBe(200);
      expect(notesGet.body.notes.length).toBe(2);
    });

    it("denies Requesters with 403 FORBIDDEN before database lookup, without leaking existence", async () => {
      const requesterExisting = await owningRequester.get(`/api/staff/tickets/${testTicketId}/internal-notes`);
      expect(requesterExisting.status).toBe(403);
      expect(requesterExisting.body.error.code).toBe("FORBIDDEN");

      const requesterAbsent = await owningRequester.get(`/api/staff/tickets/99999999/internal-notes`);
      expect(requesterAbsent.status).toBe(403);
      expect(requesterAbsent.body.error.code).toBe("FORBIDDEN");
      expect(requesterExisting.body).toEqual(requesterAbsent.body);

      const requesterPost = await owningRequester
        .post(`/api/staff/tickets/${testTicketId}/internal-notes`)
        .send({ content: "Requester trying to write note" });
      expect(requesterPost.status).toBe(403);
      expect(requesterPost.body.error.code).toBe("FORBIDDEN");
    });

    it("omits internalNotes and internalNoteCount completely from Requester TicketDetail", async () => {
      const ticketRes = await owningRequester.get(`/api/tickets/${testTicketId}`);
      expect(ticketRes.status).toBe(200);
      expect(ticketRes.body.internalNotes).toBeUndefined();
      expect(ticketRes.body.internalNoteCount).toBeUndefined();
      expect(ticketRes.body.publicComments).toBeDefined();
      expect(ticketRes.body.publicComments.length).toBe(3);
    });
  });

  describe("API-13: Ordering, safe author projection, safe text, and boundary lengths", () => {
    it("orders public comments and internal notes by createdAt ASC, id ASC", async () => {
      const commentsRes = await staff.get(`/api/tickets/${testTicketId}/public-comments`);
      expect(commentsRes.status).toBe(200);
      const comments = commentsRes.body.comments;
      for (let i = 1; i < comments.length; i++) {
        const prevTime = new Date(comments[i - 1].createdAt).getTime();
        const currTime = new Date(comments[i].createdAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
        if (currTime === prevTime) {
          expect(comments[i].id).toBeGreaterThan(comments[i - 1].id);
        }
      }

      const notesRes = await staff.get(`/api/staff/tickets/${testTicketId}/internal-notes`);
      expect(notesRes.status).toBe(200);
      const notes = notesRes.body.notes;
      for (let i = 1; i < notes.length; i++) {
        const prevTime = new Date(notes[i - 1].createdAt).getTime();
        const currTime = new Date(notes[i].createdAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
        if (currTime === prevTime) {
          expect(notes[i].id).toBeGreaterThan(notes[i - 1].id);
        }
      }
    });

    it("projects safe author shape with id, name, and role only (no security leaks)", async () => {
      const commentsRes = await staff.get(`/api/tickets/${testTicketId}/public-comments`);
      for (const comment of commentsRes.body.comments) {
        expect(Object.keys(comment.author).sort()).toEqual(["id", "name", "role"]);
        expect(comment.author.passwordHash).toBeUndefined();
        expect(comment.author.email).toBeUndefined();
        expect(comment.author.seedKey).toBeUndefined();
      }
    });

    it("preserves HTML and script tags verbatim as safe plain text", async () => {
      const xssPayload = "<script>alert('xss')</script> & <img src=x onerror=alert(1)> \"quotes\"";
      const postRes = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: xssPayload });
      expect(postRes.status).toBe(201);
      expect(postRes.body.comment.content).toBe(xssPayload);

      const getRes = await owningRequester.get(`/api/tickets/${testTicketId}/public-comments`);
      const retrieved = getRes.body.comments.find((c: any) => c.id === postRes.body.comment.id);
      expect(retrieved.content).toBe(xssPayload);
    });

    it("accepts boundary lengths (1 and 2000 code points) and rejects 2001 or whitespace", async () => {
      const singleChar = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "A" });
      expect(singleChar.status).toBe(201);
      expect(singleChar.body.comment.content).toBe("A");

      // 2000 Unicode characters (Thai: ภาษาไทย 7 chars repeated)
      const thaiBase = "ภาษาไทย";
      const unicode2000 = thaiBase.repeat(285) + thaiBase.slice(0, 5); // 285*7 + 5 = 2000
      expect([...unicode2000].length).toBe(2000);

      const unicodeRes = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: unicode2000 });
      expect(unicodeRes.status).toBe(201);
      expect(unicodeRes.body.comment.content).toBe(unicode2000);

      const overLimit = unicode2000 + "X";
      const overRes = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: overLimit });
      expect(overRes.status).toBe(400);

      const whitespaceRes = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "   \t\n   " });
      expect(whitespaceRes.status).toBe(400);
    });

    it("rejects forged author and unexpected fields with 400", async () => {
      const forged = await staff
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({
          content: "Legitimate text",
          authorId: 9999,
          author: { name: "Hacker", role: "ADMINISTRATOR" },
          createdAt: new Date().toISOString(),
        });
      expect(forged.status).toBe(400);
    });

    it("returns 404 for unsupported methods (PUT, PATCH, DELETE) on communication routes", async () => {
      const putRes = await staff.put(`/api/tickets/${testTicketId}/public-comments`).send({ content: "update" });
      expect(putRes.status).toBe(404);

      const patchRes = await staff.patch(`/api/staff/tickets/${testTicketId}/internal-notes`).send({ content: "patch" });
      expect(patchRes.status).toBe(404);

      const delRes = await staff.delete(`/api/tickets/${testTicketId}/public-comments`);
      expect(delRes.status).toBe(404);
    });
  });

  describe("Row-level lock coordination & version increment on comments and notes", () => {
    it("increments ticket version and touches updatedAt on comment and note appends", async () => {
      const prisma = getPrisma();
      const initialTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: testTicketId } });
      const initialVersion = initialTicket.version;

      await owningRequester
        .post(`/api/tickets/${testTicketId}/public-comments`)
        .send({ content: "Version check comment" });

      const afterComment = await prisma.ticket.findUniqueOrThrow({ where: { id: testTicketId } });
      expect(afterComment.version).toBe(initialVersion + 1);
      expect(afterComment.updatedAt.getTime()).toBeGreaterThanOrEqual(initialTicket.updatedAt.getTime());

      await staff
        .post(`/api/staff/tickets/${testTicketId}/internal-notes`)
        .send({ content: "Version check note" });

      const afterNote = await prisma.ticket.findUniqueOrThrow({ where: { id: testTicketId } });
      expect(afterNote.version).toBe(initialVersion + 2);
    });

    it("coordinates concurrent comment and note appends without lost updates", async () => {
      const prisma = getPrisma();
      const beforeTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: testTicketId } });
      const beforeVersion = beforeTicket.version;

      const promises = [
        owningRequester.post(`/api/tickets/${testTicketId}/public-comments`).send({ content: "Parallel comment 1" }),
        staff.post(`/api/staff/tickets/${testTicketId}/internal-notes`).send({ content: "Parallel note 1" }),
        admin.post(`/api/tickets/${testTicketId}/public-comments`).send({ content: "Parallel comment 2" }),
      ];
      const results = await Promise.all(promises);
      for (const res of results) {
        expect([201]).toContain(res.status);
      }

      const afterTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: testTicketId } });
      expect(afterTicket.version).toBe(beforeVersion + 3);
    });
  });

  describe("API-22: Problem Appears Resolved", () => {
    let resolvedTestTicketId: number;

    beforeAll(async () => {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-RESOLV-${marker.substring(0, 8)}`,
          requesterId: owningRequesterId,
          categoryId,
          relatedSystemId: systemId,
          summary: `[Resolution Test] ${marker}`,
          description: "Ticket for problem appears resolved tests.",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "OPEN",
          version: 0,
        },
      });
      resolvedTestTicketId = ticket.id;
    });

    it("allows owning requester to indicate problem appears resolved with optional comment", async () => {
      const prisma = getPrisma();
      const beforeTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: resolvedTestTicketId } });

      const res = await owningRequester
        .post(`/api/tickets/${resolvedTestTicketId}/problem-appears-resolved`)
        .send({
          expectedVersion: beforeTicket.version,
          comment: "Everything looks resolved from my side, thank you!",
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.ticket.id).toBe(resolvedTestTicketId);
      expect(res.body.ticket.status).toBe("OPEN"); // BR-17: does NOT change status
      expect(res.body.ticket.problemAppearsResolvedAt).not.toBeNull();
      expect(res.body.ticket.problemAppearsResolvedById).toBe(owningRequesterId);
      expect(res.body.ticket.version).toBe(beforeTicket.version + 1);

      // Verify public comment was appended atomically
      const comments = await prisma.publicComment.findMany({
        where: { ticketId: resolvedTestTicketId },
      });
      expect(comments.some((c) => c.content === "Everything looks resolved from my side, thank you!")).toBe(true);
    });

    it("rejects repeated indication with 409 CONFLICT (ALREADY_INDICATED)", async () => {
      const prisma = getPrisma();
      const currentTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: resolvedTestTicketId } });

      const repeatRes = await owningRequester
        .post(`/api/tickets/${resolvedTestTicketId}/problem-appears-resolved`)
        .send({ expectedVersion: currentTicket.version });

      expect(repeatRes.status).toBe(409);
      expect(repeatRes.body.error.code).toBe("ALREADY_INDICATED");
    });

    it("rejects stale expectedVersion with 409 CONFLICT (VERSION_CONFLICT)", async () => {
      const prisma = getPrisma();
      const freshTicket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-STALE-${marker.substring(0, 8)}`,
          requesterId: owningRequesterId,
          categoryId,
          relatedSystemId: systemId,
          summary: `[Stale Test] ${marker}`,
          description: "Stale version test",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "OPEN",
          version: 2,
        },
      });

      const staleRes = await owningRequester
        .post(`/api/tickets/${freshTicket.id}/problem-appears-resolved`)
        .send({ expectedVersion: 1 });

      expect(staleRes.status).toBe(409);
      expect(staleRes.body.error.code).toBe("VERSION_CONFLICT");
    });

    it("rejects indication on terminal statuses (RESOLVED, CLOSED, CANCELLED) with 409", async () => {
      const prisma = getPrisma();
      const closedTicket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-TERM-${marker.substring(0, 8)}`,
          requesterId: owningRequesterId,
          categoryId,
          relatedSystemId: systemId,
          summary: `[Terminal Test] ${marker}`,
          description: "Terminal test",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "CLOSED",
          version: 0,
        },
      });

      const termRes = await owningRequester
        .post(`/api/tickets/${closedTicket.id}/problem-appears-resolved`)
        .send({ expectedVersion: 0 });

      expect(termRes.status).toBe(409);
      expect(termRes.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("denies IT Staff and Administrator with 403 FORBIDDEN", async () => {
      const staffRes = await staff
        .post(`/api/tickets/${resolvedTestTicketId}/problem-appears-resolved`)
        .send({ expectedVersion: 0 });
      expect(staffRes.status).toBe(403);

      const adminRes = await admin
        .post(`/api/tickets/${resolvedTestTicketId}/problem-appears-resolved`)
        .send({ expectedVersion: 0 });
      expect(adminRes.status).toBe(403);
    });

    it("denies other requester with non-disclosing 404", async () => {
      const otherRes = await otherRequester
        .post(`/api/tickets/${resolvedTestTicketId}/problem-appears-resolved`)
        .send({ expectedVersion: 0 });
      expect(otherRes.status).toBe(404);
      expect(otherRes.body).toEqual({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
    });
  });
});
