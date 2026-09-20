import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import supertest from "supertest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { authenticatedAgentFor, testPasswordHash } from "../authenticated-request.js";

describe("Issue #29: IT Staff Ticket Queue & Eligible Owners (API-07 & API-17)", () => {
  const marker = randomUUID().slice(0, 8);
  let requesterId: number;
  let staffId: number;
  let adminId: number;
  let passwordChangeStaffId: number;
  let inactiveStaffId: number;

  let requesterAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staffAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let adminAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let passwordChangeAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;

  let testCategory1Id: number;
  let testCategory2Id: number;
  let testSystemId: number;
  const createdTicketIds: number[] = [];

  beforeAll(async () => {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({ where: { isActive: true }, take: 2 });
    testCategory1Id = categories[0].id;
    testCategory2Id = categories[1]?.id ?? testCategory1Id;
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    testSystemId = system.id;

    // Create test personas
    const [requesterUser, staffUser, adminUser, pwChangeUser, inactiveStaffUser] = await Promise.all([
      prisma.user.create({
        data: {
          name: `Queue Test Requester ${marker}`,
          email: `queue-req-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "REQUESTER",
        },
      }),
      prisma.user.create({
        data: {
          name: `Queue Test Staff ${marker}`,
          email: `queue-staff-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "IT_STAFF",
        },
      }),
      prisma.user.create({
        data: {
          name: `Queue Test Admin ${marker}`,
          email: `queue-admin-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          role: "ADMINISTRATOR",
        },
      }),
      prisma.user.create({
        data: {
          name: `Queue Test PwChange ${marker}`,
          email: `queue-pwchange-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: true,
          role: "IT_STAFF",
        },
      }),
      prisma.user.create({
        data: {
          name: `Queue Test Inactive Staff ${marker}`,
          email: `queue-inactive-${marker}@example.com`,
          passwordHash: testPasswordHash,
          mustChangePassword: false,
          isActive: false,
          role: "IT_STAFF",
        },
      }),
    ]);

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    adminId = adminUser.id;
    passwordChangeStaffId = pwChangeUser.id;
    inactiveStaffId = inactiveStaffUser.id;

    [requesterAgent, staffAgent, adminAgent, passwordChangeAgent] = await Promise.all([
      authenticatedAgentFor(app, requesterId),
      authenticatedAgentFor(app, staffId),
      authenticatedAgentFor(app, adminId),
      authenticatedAgentFor(app, passwordChangeStaffId),
    ]);

    // Create controlled test tickets to verify priority ordering, filters, search, and counts
    // Priorities: URGENT, HIGH, MEDIUM, LOW
    const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
    const statuses = [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
      "CANCELLED",
    ] as const;

    for (let i = 0; i < 8; i++) {
      const isAssignedToMe = i % 2 === 0;
      const t = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-Q-${marker}-${String(i + 1).padStart(3, "0")}`,
          requesterId,
          categoryId: i < 4 ? testCategory1Id : testCategory2Id,
          relatedSystemId: testSystemId,
          summary: `[QueueTest-${marker}] Item ${i + 1} summary keyword`,
          description: `Detailed description for test ticket ${i + 1}`,
          requestedPriority: priorities[i % 4],
          itPriority: priorities[3 - (i % 4)], // 0: URGENT, 1: HIGH, 2: MEDIUM, 3: LOW...
          status: statuses[i],
          ownerId: isAssignedToMe ? staffId : null,
          createdAt: new Date(Date.now() - (10 - i) * 60000),
          updatedAt: new Date(Date.now() - (10 - i) * 30000),
        },
      });
      createdTicketIds.push(t.id);
    }

    // Add 1 active and 1 removed attachment to first ticket
    await prisma.attachment.create({
      data: {
        ticketId: createdTicketIds[0],
        fileName: `file-active-${marker}.txt`,
        originalName: "active.txt",
        mimeType: "text/plain",
        fileSize: 120,
        filePath: `/tmp/test-file-${marker}.txt`,
        isRemoved: false,
      },
    });
    await prisma.attachment.create({
      data: {
        ticketId: createdTicketIds[0],
        fileName: `file-removed-${marker}.txt`,
        originalName: "removed.txt",
        mimeType: "text/plain",
        fileSize: 100,
        filePath: `/tmp/test-file-removed-${marker}.txt`,
        isRemoved: true,
        removalReason: "Deleted in test",
        removedAt: new Date(),
      },
    });

    // Add 2 public comments to first ticket
    await prisma.publicComment.create({
      data: {
        ticketId: createdTicketIds[0],
        authorId: staffId,
        content: `Public comment 1 on ticket ${marker}`,
      },
    });
    await prisma.publicComment.create({
      data: {
        ticketId: createdTicketIds[0],
        authorId: requesterId,
        content: `Public comment 2 on ticket ${marker}`,
      },
    });

    // Add 1 internal note to first ticket (must not leak into queue publicCommentCount or counts)
    await prisma.internalNote.create({
      data: {
        ticketId: createdTicketIds[0],
        authorId: staffId,
        content: `Internal note on ticket ${marker}`,
      },
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (createdTicketIds.length > 0) {
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.attachment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.user.deleteMany({
      where: {
        id: { in: [requesterId, staffId, adminId, passwordChangeStaffId, inactiveStaffId] },
      },
    });
  });

  describe("API-07: GET /api/staff/tickets Authorization & Access Control", () => {
    it("allows IT_STAFF to access the queue", async () => {
      const res = await staffAgent.get("/api/staff/tickets");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tickets)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it("allows ADMINISTRATOR to access the queue", async () => {
      const res = await adminAgent.get("/api/staff/tickets");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tickets)).toBe(true);
    });

    it("rejects REQUESTER with 403 FORBIDDEN", async () => {
      const res = await requesterAgent.get("/api/staff/tickets");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
      const res = await supertest(app).get("/api/staff/tickets");
      expect(res.status).toBe(401);
    });

    it("rejects users with mustChangePassword=true with 403 PASSWORD_CHANGE_REQUIRED", async () => {
      const res = await passwordChangeAgent.get("/api/staff/tickets");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });
  });

  describe("API-07: Search Functionality", () => {
    it("searches case-insensitively by summary", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: `queuetest-${marker}`,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(8);
      for (const t of res.body.tickets) {
        expect(t.summary.toLowerCase()).toContain(`queuetest-${marker}`);
      }
    });

    it("searches case-insensitively by ticketNumber", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: `tkt-q-${marker}-001`,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(1);
      expect(res.body.tickets[0].ticketNumber).toBe(`TKT-Q-${marker}-001`);
    });

    it("trims search input and ignores leading/trailing whitespace", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: `   TKT-Q-${marker}-002   `,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(1);
      expect(res.body.tickets[0].ticketNumber).toBe(`TKT-Q-${marker}-002`);
    });

    it("rejects search longer than 150 characters with 400 BAD_REQUEST", async () => {
      const longSearch = "a".repeat(151);
      const res = await staffAgent.get("/api/staff/tickets").query({ search: longSearch });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("API-07: Filtering Functionality", () => {
    it("filters by category", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        category: testCategory1Id,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(4);
      for (const t of res.body.tickets) {
        expect(t.category.id).toBe(testCategory1Id);
      }
    });

    it("filters by requestedPriority", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        requestedPriority: "LOW",
      });
      expect(res.status).toBe(200);
      for (const t of res.body.tickets) {
        expect(t.requestedPriority).toBe("LOW");
      }
    });

    it("filters by itPriority", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        itPriority: "URGENT",
      });
      expect(res.status).toBe(200);
      for (const t of res.body.tickets) {
        expect(t.itPriority).toBe("URGENT");
      }
    });

    it("filters by status", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        status: "NEW",
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(1);
      expect(res.body.tickets[0].status).toBe("NEW");
    });

    it("filters by owner=unassigned", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        owner: "unassigned",
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(4);
      for (const t of res.body.tickets) {
        expect(t.owner).toBeNull();
      }
    });

    it("filters by owner=me", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        owner: "me",
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(4);
      for (const t of res.body.tickets) {
        expect(t.owner?.id).toBe(staffId);
      }
    });

    it("filters by owner=positive userId", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        owner: staffId,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(4);
      for (const t of res.body.tickets) {
        expect(t.owner?.id).toBe(staffId);
      }
    });

    it("combines multiple filters with AND", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        category: testCategory1Id,
        status: "NEW",
        owner: "me",
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(1);
      expect(res.body.tickets[0].ticketNumber).toBe(`TKT-Q-${marker}-001`);
    });

    it("treats empty optional query parameters as no filter", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        category: "",
        requestedPriority: "",
        itPriority: "",
        status: "",
        owner: "",
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(8);
    });

    it("returns empty results for valid but nonexistent category ID", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        category: 2147483640,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets).toEqual([]);
      expect(res.body.pagination.totalItems).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
    });

    it("returns empty results for valid but nonexistent owner ID", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        owner: 2147483640,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets).toEqual([]);
      expect(res.body.pagination.totalItems).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
    });
  });

  describe("API-07: Sorting", () => {
    it("sorts by itPriority_desc (URGENT -> HIGH -> MEDIUM -> LOW, then updatedAt desc, id asc)", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        sort: "itPriority_desc",
      });
      expect(res.status).toBe(200);
      const priorities = res.body.tickets.map((t: { itPriority: string }) => t.itPriority);
      const orderRank: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(orderRank[priorities[i]]).toBeGreaterThanOrEqual(orderRank[priorities[i + 1]]);
      }
    });

    it("sorts by ticketNumber_asc with stable tie-breaker", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        sort: "ticketNumber_asc",
      });
      expect(res.status).toBe(200);
      const numbers = res.body.tickets.map((t: { ticketNumber: string }) => t.ticketNumber);
      const sorted = [...numbers].sort();
      expect(numbers).toEqual(sorted);
    });

    it("sorts by ticketNumber_desc with stable tie-breaker", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        sort: "ticketNumber_desc",
      });
      expect(res.status).toBe(200);
      const numbers = res.body.tickets.map((t: { ticketNumber: string }) => t.ticketNumber);
      const sorted = [...numbers].sort().reverse();
      expect(numbers).toEqual(sorted);
    });

    it("sorts by createdAt_desc and createdAt_asc", async () => {
      const descRes = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        sort: "createdAt_desc",
      });
      expect(descRes.status).toBe(200);
      const descDates = descRes.body.tickets.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
      for (let i = 0; i < descDates.length - 1; i++) {
        expect(descDates[i]).toBeGreaterThanOrEqual(descDates[i + 1]);
      }

      const ascRes = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        sort: "createdAt_asc",
      });
      expect(ascRes.status).toBe(200);
      const ascDates = ascRes.body.tickets.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
      for (let i = 0; i < ascDates.length - 1; i++) {
        expect(ascDates[i]).toBeLessThanOrEqual(ascDates[i + 1]);
      }
    });
  });

  describe("API-07: Pagination & Query Validation", () => {
    it("supports limits 10, 20, 50 and rejects other limits with 400", async () => {
      for (const limit of [10, 20, 50]) {
        const res = await staffAgent.get("/api/staff/tickets").query({ limit });
        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(limit);
      }

      for (const invalidLimit of [5, 15, 25, 100, 0, -1, "abc"]) {
        const res = await staffAgent.get("/api/staff/tickets").query({ limit: invalidLimit });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("BAD_REQUEST");
      }
    });

    it("rejects invalid page parameters with 400", async () => {
      for (const invalidPage of [0, -1, "abc", 1.5]) {
        const res = await staffAgent.get("/api/staff/tickets").query({ page: invalidPage });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("BAD_REQUEST");
      }
    });

    it("returns empty tickets array retaining requested page when page is out of range", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: marker,
        page: 999,
        limit: 10,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets).toEqual([]);
      expect(res.body.pagination.page).toBe(999);
      expect(res.body.pagination.totalItems).toBe(8);
      expect(res.body.pagination.totalPages).toBe(1);
    });

    it("sets totalPages=0 when totalItems=0", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: "nonexistent-keyword-impossible-match-xyz",
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets).toEqual([]);
      expect(res.body.pagination.totalItems).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
    });

    it("rejects unknown query parameters with 400", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({ unknownField: "bad" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("rejects array query parameters with 400", async () => {
      const res = await staffAgent.get("/api/staff/tickets?status=NEW&status=OPEN");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("rejects malformed enum values with 400", async () => {
      expect((await staffAgent.get("/api/staff/tickets").query({ status: "INVALID_STATUS" })).status).toBe(400);
      expect((await staffAgent.get("/api/staff/tickets").query({ requestedPriority: "INVALID_PRIORITY" })).status).toBe(400);
      expect((await staffAgent.get("/api/staff/tickets").query({ itPriority: "INVALID_PRIORITY" })).status).toBe(400);
      expect((await staffAgent.get("/api/staff/tickets").query({ sort: "invalid_sort" })).status).toBe(400);
      expect((await staffAgent.get("/api/staff/tickets").query({ owner: "bad_owner_string" })).status).toBe(400);
    });
  });

  describe("API-07: Safe Response Contract", () => {
    it("returns only specified safe fields and counts", async () => {
      const res = await staffAgent.get("/api/staff/tickets").query({
        search: `tkt-q-${marker}-001`,
      });
      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBe(1);
      const t = res.body.tickets[0];

      // Exact safe fields present
      expect(typeof t.id).toBe("number");
      expect(typeof t.ticketNumber).toBe("string");
      expect(typeof t.createdAt).toBe("string");
      expect(typeof t.updatedAt).toBe("string");
      expect(typeof t.summary).toBe("string");
      expect(t.category).toEqual({ id: expect.any(Number), name: expect.any(String) });
      expect(t.relatedSystem).toEqual({ id: expect.any(Number), name: expect.any(String) });
      expect(["LOW", "MEDIUM", "HIGH", "URGENT"]).toContain(t.requestedPriority);
      expect(["LOW", "MEDIUM", "HIGH", "URGENT"]).toContain(t.itPriority);
      expect(typeof t.status).toBe("string");
      expect(typeof t.version).toBe("number");

      // Owner shape
      expect(t.owner).toEqual({
        id: staffId,
        name: expect.any(String),
        email: expect.any(String),
        role: "IT_STAFF",
      });

      // Active attachment count only (excludes soft-removed file)
      expect(t.attachmentCount).toBe(1);

      // Public comment count (excludes internal notes)
      expect(t.publicCommentCount).toBe(2);

      // Explicitly excluded fields MUST NOT be present
      expect(t.description).toBeUndefined();
      expect(t.requester).toBeUndefined();
      expect(t.requesterId).toBeUndefined();
      expect(t.internalNotes).toBeUndefined();
      expect(t.internalNoteCount).toBeUndefined();
      expect(t.filePath).toBeUndefined();
      expect(t.passwordHash).toBeUndefined();
      expect(t.tokenDigest).toBeUndefined();
    });
  });

  describe("API-17: GET /api/staff/eligible-owners", () => {
    it("allows IT_STAFF and ADMINISTRATOR to retrieve eligible owners", async () => {
      const staffRes = await staffAgent.get("/api/staff/eligible-owners");
      expect(staffRes.status).toBe(200);
      expect(Array.isArray(staffRes.body.owners)).toBe(true);

      const adminRes = await adminAgent.get("/api/staff/eligible-owners");
      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body.owners)).toBe(true);
    });

    it("rejects REQUESTER with 403 FORBIDDEN", async () => {
      const res = await requesterAgent.get("/api/staff/eligible-owners");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns only active IT_STAFF and ADMINISTRATOR users, excluding inactive and Requesters", async () => {
      const res = await staffAgent.get("/api/staff/eligible-owners");
      expect(res.status).toBe(200);
      const owners = res.body.owners as Array<{ id: number; name: string; email: string; role: string }>;

      const ownerIds = owners.map((o) => o.id);
      expect(ownerIds).toContain(staffId);
      expect(ownerIds).toContain(adminId);
      expect(ownerIds).not.toContain(requesterId);
      expect(ownerIds).not.toContain(inactiveStaffId);

      for (const o of owners) {
        expect(["IT_STAFF", "ADMINISTRATOR"]).toContain(o.role);
        expect(typeof o.id).toBe("number");
        expect(typeof o.name).toBe("string");
        expect(typeof o.email).toBe("string");
        // Ensure no sensitive fields
        expect((o as any).passwordHash).toBeUndefined();
        expect((o as any).seedKey).toBeUndefined();
      }
    });

    it("sorts eligible owners case-insensitively by name and then id", async () => {
      const res = await staffAgent.get("/api/staff/eligible-owners");
      expect(res.status).toBe(200);
      const owners = res.body.owners as Array<{ id: number; name: string }>;

      for (let i = 0; i < owners.length - 1; i++) {
        const comp = owners[i].name.localeCompare(owners[i + 1].name, undefined, { sensitivity: "base" });
        if (comp === 0) {
          expect(owners[i].id).toBeLessThan(owners[i + 1].id);
        } else {
          expect(comp).toBeLessThan(0);
        }
      }
    });

    it("rejects unexpected query parameters on eligible-owners with 400", async () => {
      const res = await staffAgent.get("/api/staff/eligible-owners").query({ foo: "bar" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });
  });
});
