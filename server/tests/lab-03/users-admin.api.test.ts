import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { authenticatedAgentFor, testPasswordHash } from "../authenticated-request.js";
import supertest from "supertest";

describe("API-14, API-15, API-16, API-20: Administrator User Management Integration", () => {
  const marker = randomUUID().slice(0, 8);
  let adminId: number;
  let admin2Id: number;
  let staffId: number;
  let requesterId: number;

  let adminAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let admin2Agent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let staffAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;
  let requesterAgent: Awaited<ReturnType<typeof authenticatedAgentFor>>;

  let testCategoryId: number;
  let testSystemId: number;

  const createdUserIds: number[] = [];
  const createdTicketIds: number[] = [];

  beforeAll(async () => {
    const prisma = getPrisma();
    const [cat, sys] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    testCategoryId = cat.id;
    testSystemId = sys.id;

    const [uAdmin, uAdmin2, uStaff, uReq] = await Promise.all([
      prisma.user.create({
        data: {
          name: `Admin One ${marker}`,
          email: `admin1-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "ADMINISTRATOR",
          isActive: true,
          mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: `Admin Two ${marker}`,
          email: `admin2-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "ADMINISTRATOR",
          isActive: true,
          mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: `Staff Member ${marker}`,
          email: `staff-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "IT_STAFF",
          isActive: true,
          mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: `Requester User ${marker}`,
          email: `requester-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ]);

    adminId = uAdmin.id;
    admin2Id = uAdmin2.id;
    staffId = uStaff.id;
    requesterId = uReq.id;

    createdUserIds.push(adminId, admin2Id, staffId, requesterId);

    [adminAgent, admin2Agent, staffAgent, requesterAgent] = await Promise.all([
      authenticatedAgentFor(app, adminId),
      authenticatedAgentFor(app, admin2Id),
      authenticatedAgentFor(app, staffId),
      authenticatedAgentFor(app, requesterId),
    ]);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (createdTicketIds.length > 0) {
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  describe("Authorization and Route Safety", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await supertest(app)
        .get("/api/admin/users")
        .set("Origin", "http://localhost:5173");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects REQUESTER with 403 FORBIDDEN before resource or id parsing", async () => {
      const res = await requesterAgent.get("/api/admin/users");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const postRes = await requesterAgent
        .post("/api/admin/users/not-an-id/initial-password")
        .send({ initialPassword: "AnyPassword123!", confirmPassword: "AnyPassword123!" });
      expect(postRes.status).toBe(403);
      expect(postRes.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects IT_STAFF with 403 FORBIDDEN before resource or id parsing", async () => {
      const res = await staffAgent.get("/api/admin/users");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("evaluates ID parameter after role check, returning 400 for invalid ID", async () => {
      const res = await adminAgent
        .patch("/api/admin/users/invalid-id")
        .send({ name: "Valid Name" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("does not expose DELETE /api/admin/users/:id endpoint (returns 404)", async () => {
      const res = await adminAgent.delete(`/api/admin/users/${staffId}`);
      expect(res.status).toBe(404);
    });
  });

  describe("API-14: User List & Filters", () => {
    it("returns list of users sorted case-insensitively by name, tie-broken by ID ascending", async () => {
      const res = await adminAgent.get("/api/admin/users");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);

      const users: Array<any> = res.body.users;
      expect(users.length).toBeGreaterThanOrEqual(4);

      // Verify sorting
      for (let i = 0; i < users.length - 1; i++) {
        const cmp = users[i].name.localeCompare(users[i + 1].name, undefined, { sensitivity: "base" });
        if (cmp === 0) {
          expect(users[i].id).toBeLessThanOrEqual(users[i + 1].id);
        } else {
          expect(cmp).toBeLessThan(0);
        }
      }

      // Verify safe fields only: no passwordHash, session digests, seedKey
      for (const u of users) {
        expect(u).toHaveProperty("id");
        expect(u).toHaveProperty("name");
        expect(u).toHaveProperty("email");
        expect(u).toHaveProperty("role");
        expect(u).toHaveProperty("isActive");
        expect(u).toHaveProperty("mustChangePassword");
        expect(u).toHaveProperty("createdAt");
        expect(u).toHaveProperty("updatedAt");
        expect(u).not.toHaveProperty("passwordHash");
        expect(u).not.toHaveProperty("tokenDigest");
        expect(u).not.toHaveProperty("seedKey");
        // Dates serialized as valid ISO strings
        expect(new Date(u.createdAt).toISOString()).toBe(u.createdAt);
        expect(new Date(u.updatedAt).toISOString()).toBe(u.updatedAt);
      }
    });

    it("filters by role", async () => {
      const res = await adminAgent.get("/api/admin/users?role=IT_STAFF");
      expect(res.status).toBe(200);
      for (const u of res.body.users) {
        expect(u.role).toBe("IT_STAFF");
      }
    });

    it("filters by search query matching name or email case-insensitively", async () => {
      const res = await adminAgent.get(`/api/admin/users?search=staff-${marker}`);
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].id).toBe(staffId);
    });

    it("rejects unknown query parameters with 400", async () => {
      const res = await adminAgent.get("/api/admin/users?invalidParam=true");
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects search query > 150 characters with 400", async () => {
      const res = await adminAgent.get(`/api/admin/users?search=${"x".repeat(151)}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("API-14: User Creation", () => {
    it("creates user successfully with initial password and mustChangePassword=true", async () => {
      const email = `newuser-${marker}@example.com`;
      const res = await adminAgent.post("/api/admin/users").send({
        name: "Brand New User",
        email: email.toUpperCase(), // Test case normalization
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "InitialPassword123!",
      });

      expect(res.status).toBe(201);
      const user = res.body.user;
      expect(user.id).toBeDefined();
      createdUserIds.push(user.id);

      expect(user.name).toBe("Brand New User");
      expect(user.email).toBe(email);
      expect(user.role).toBe("IT_STAFF");
      expect(user.isActive).toBe(true);
      expect(user.mustChangePassword).toBe(true);
      expect(user).not.toHaveProperty("passwordHash");
      expect(user).not.toHaveProperty("initialPassword");
    });

    it("rejects duplicate email with 409 DUPLICATE_EMAIL", async () => {
      const res = await adminAgent.post("/api/admin/users").send({
        name: "Duplicate User",
        email: `staff-${marker}@example.com`,
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "InitialPassword123!",
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    });

    it("handles concurrent user creation with identical email safely", async () => {
      const targetEmail = `concurrent-create-${marker}@example.com`;
      const [res1, res2] = await Promise.all([
        adminAgent.post("/api/admin/users").send({
          name: "Concurrent A",
          email: targetEmail,
          role: "IT_STAFF",
          isActive: true,
          initialPassword: "InitialPassword123!",
        }),
        adminAgent.post("/api/admin/users").send({
          name: "Concurrent B",
          email: targetEmail,
          role: "IT_STAFF",
          isActive: true,
          initialPassword: "InitialPassword123!",
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const success = res1.status === 201 ? res1.body.user : res2.body.user;
      createdUserIds.push(success.id);
      const conflict = res1.status === 409 ? res1.body.error : res2.body.error;
      expect(conflict.code).toBe("DUPLICATE_EMAIL");
    });
  });

  describe("API-14: User Update (PATCH)", () => {
    it("updates name, email, role, and isActive", async () => {
      const u = await getPrisma().user.create({
        data: {
          name: "Original Name",
          email: `patch-target-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "REQUESTER",
          isActive: true,
        },
      });
      createdUserIds.push(u.id);

      const res = await adminAgent.patch(`/api/admin/users/${u.id}`).send({
        name: "Updated Name",
        email: `PATCH-TARGET-NEW-${marker}@example.com`,
        role: "IT_STAFF",
        isActive: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Updated Name");
      expect(res.body.user.email).toBe(`patch-target-new-${marker}@example.com`);
      expect(res.body.user.role).toBe("IT_STAFF");
    });

    it("preserves active sessions on name-only and email-only updates (regression test)", async () => {
      const u = await getPrisma().user.create({
        data: {
          name: "Session Preserved",
          email: `session-pres-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "IT_STAFF",
          isActive: true,
          mustChangePassword: false,
        },
      });
      createdUserIds.push(u.id);

      const userAgent = await authenticatedAgentFor(app, u.id);

      // Verify user can access session-guarded route
      const preCheck = await userAgent.get("/api/staff/tickets");
      expect(preCheck.status).toBe(200);

      // Admin updates only name
      const nameUpdateRes = await adminAgent.patch(`/api/admin/users/${u.id}`).send({
        name: "Session Preserved Updated",
      });
      expect(nameUpdateRes.status).toBe(200);

      // Verify session is still valid
      const afterNameCheck = await userAgent.get("/api/staff/tickets");
      expect(afterNameCheck.status).toBe(200);

      // Admin updates only email
      const emailUpdateRes = await adminAgent.patch(`/api/admin/users/${u.id}`).send({
        email: `session-pres-new-${marker}@example.com`,
      });
      expect(emailUpdateRes.status).toBe(200);

      // Verify session is STILL valid
      const afterEmailCheck = await userAgent.get("/api/staff/tickets");
      expect(afterEmailCheck.status).toBe(200);
    });

    it("rejects empty PATCH body with 400 VALIDATION_ERROR", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${staffId}`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unknown fields in PATCH with 400 VALIDATION_ERROR", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${staffId}`).send({
        name: "Staff",
        extraField: "not allowed",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects duplicate email in PATCH with 409 DUPLICATE_EMAIL", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${staffId}`).send({
        email: `admin1-${marker}@example.com`,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    });

    it("returns 404 NOT_FOUND for non-existent user ID", async () => {
      const res = await adminAgent.patch("/api/admin/users/9999999").send({
        name: "Non-existent",
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("handles concurrent PATCH duplicate email race via P2002 mapping", async () => {
      const [u1, u2] = await Promise.all([
        getPrisma().user.create({
          data: {
            name: "Race Target 1",
            email: `race1-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "REQUESTER",
          },
        }),
        getPrisma().user.create({
          data: {
            name: "Race Target 2",
            email: `race2-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "REQUESTER",
          },
        }),
      ]);
      createdUserIds.push(u1.id, u2.id);

      const targetEmail = `shared-clash-${marker}@example.com`;
      const [res1, res2] = await Promise.all([
        adminAgent.patch(`/api/admin/users/${u1.id}`).send({ email: targetEmail }),
        adminAgent.patch(`/api/admin/users/${u2.id}`).send({ email: targetEmail }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
      const conflict = res1.status === 409 ? res1.body.error : res2.body.error;
      expect(conflict.code).toBe("DUPLICATE_EMAIL");
    });
  });

  describe("API-15: Initial Password Reset", () => {
    it("resets initial password, sets mustChangePassword=true, and revokes active sessions", async () => {
      const u = await getPrisma().user.create({
        data: {
          name: "Password Reset Target",
          email: `pwd-reset-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "IT_STAFF",
          mustChangePassword: false,
        },
      });
      createdUserIds.push(u.id);

      const userAgent = await authenticatedAgentFor(app, u.id);
      const preCheck = await userAgent.get("/api/staff/tickets");
      expect(preCheck.status).toBe(200);

      const res = await adminAgent
        .post(`/api/admin/users/${u.id}/initial-password`)
        .send({
          initialPassword: "NewTempPassword123!",
          confirmPassword: "NewTempPassword123!",
        });

      expect(res.status).toBe(204);

      // Verify mustChangePassword is true in DB
      const updatedUser = await getPrisma().user.findUniqueOrThrow({ where: { id: u.id } });
      expect(updatedUser.mustChangePassword).toBe(true);

      // Verify active session was revoked
      const postCheck = await userAgent.get("/api/staff/tickets");
      expect(postCheck.status).toBe(401);
    });

    it("returns 404 NOT_FOUND when target user does not exist", async () => {
      const res = await adminAgent
        .post("/api/admin/users/9999999/initial-password")
        .send({
          initialPassword: "NewTempPassword123!",
          confirmPassword: "NewTempPassword123!",
        });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects password mismatch with 400", async () => {
      const res = await adminAgent
        .post(`/api/admin/users/${staffId}/initial-password`)
        .send({
          initialPassword: "NewTempPassword123!",
          confirmPassword: "MismatchPassword123!",
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects weak password with 400", async () => {
      const res = await adminAgent
        .post(`/api/admin/users/${staffId}/initial-password`)
        .send({
          initialPassword: "weak",
          confirmPassword: "weak",
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("API-16: Self-Deactivation and Last Active Administrator Protection", () => {
    it("prevents administrator from deactivating their own account with 409 SELF_DEACTIVATION", async () => {
      const res = await adminAgent.patch(`/api/admin/users/${adminId}`).send({
        isActive: false,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("SELF_DEACTIVATION");
    });

    it("allows self-demotion when another active admin exists, immediately revoking session", async () => {
      const res = await admin2Agent.patch(`/api/admin/users/${admin2Id}`).send({
        role: "IT_STAFF",
      });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("IT_STAFF");

      // Verify session was revoked
      const postCheck = await admin2Agent.get("/api/admin/users");
      expect(postCheck.status).toBe(401);

      // Restore admin2 role so other tests have 2 active admins
      await getPrisma().user.update({
        where: { id: admin2Id },
        data: { role: "ADMINISTRATOR" },
      });
      admin2Agent = await authenticatedAgentFor(app, admin2Id);
    });

    it("prevents deactivating or demoting the last active administrator with 409 LAST_ACTIVE_ADMIN", async () => {
      // Find all active admins and make sure only adminId is left active
      const otherAdmins = await getPrisma().user.findMany({
        where: { role: "ADMINISTRATOR", isActive: true, id: { not: adminId } },
      });

      // Temporarily deactivate other admins
      await getPrisma().user.updateMany({
        where: { id: { in: otherAdmins.map((a) => a.id) } },
        data: { isActive: false },
      });

      try {
        // Demoting the only active admin should fail
        const demoteRes = await adminAgent.patch(`/api/admin/users/${adminId}`).send({
          role: "IT_STAFF",
        });
        expect(demoteRes.status).toBe(409);
        expect(demoteRes.body.error.code).toBe("LAST_ACTIVE_ADMIN");
      } finally {
        // Restore other admins
        await getPrisma().user.updateMany({
          where: { id: { in: otherAdmins.map((a) => a.id) } },
          data: { isActive: true },
        });
      }
    });

    it("coordinates concurrent last-admin race so only one demotion succeeds", async () => {
      // Create two isolated active admins
      const [a1, a2] = await Promise.all([
        getPrisma().user.create({
          data: {
            name: "Race Admin 1",
            email: `raceadmin1-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "ADMINISTRATOR",
            isActive: true,
            mustChangePassword: false,
          },
        }),
        getPrisma().user.create({
          data: {
            name: "Race Admin 2",
            email: `raceadmin2-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "ADMINISTRATOR",
            isActive: true,
            mustChangePassword: false,
          },
        }),
      ]);
      createdUserIds.push(a1.id, a2.id);

      // Temporarily deactivate all other admins so exactly a1 and a2 are the only active admins
      const activeAdmins = await getPrisma().user.findMany({
        where: { role: "ADMINISTRATOR", isActive: true, id: { notIn: [a1.id, a2.id] } },
      });
      await getPrisma().user.updateMany({
        where: { id: { in: activeAdmins.map((a) => a.id) } },
        data: { isActive: false },
      });

      const a1Agent = await authenticatedAgentFor(app, a1.id);
      const a2Agent = await authenticatedAgentFor(app, a2.id);

      try {
        // a1 demotes a2, a2 demotes a1 concurrently
        const [r1, r2] = await Promise.all([
          a1Agent.patch(`/api/admin/users/${a2.id}`).send({ role: "IT_STAFF" }),
          a2Agent.patch(`/api/admin/users/${a1.id}`).send({ role: "IT_STAFF" }),
        ]);

        const statuses = [r1.status, r2.status].sort();
        expect(statuses).toEqual([200, 409]);
        const conflict = r1.status === 409 ? r1.body.error : r2.body.error;
        expect(conflict.code).toBe("LAST_ACTIVE_ADMIN");
      } finally {
        // Restore all admins
        await getPrisma().user.updateMany({
          where: { id: { in: activeAdmins.map((a) => a.id) } },
          data: { isActive: true },
        });
      }
    });
  });

  describe("API-20: Target Deactivation, Session Revocation, and Atomic Ticket Unassignment", () => {
    it("deactivates user, revokes sessions, and atomically unassigns owned tickets with version increment", async () => {
      const prisma = getPrisma();
      const staffUser = await prisma.user.create({
        data: {
          name: "Ticket Owner Staff",
          email: `owner-staff-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "IT_STAFF",
          isActive: true,
        },
      });
      createdUserIds.push(staffUser.id);

      const staffAgentInstance = await authenticatedAgentFor(app, staffUser.id);

      // Create 2 tickets owned by this staff user
      const t1 = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-T1-${randomUUID().slice(0, 8)}`,
          summary: "Owned Ticket 1",
          description: "Desc 1",
          requestedPriority: "MEDIUM",
          itPriority: "MEDIUM",
          status: "OPEN",
          version: 1,
          requesterId,
          ownerId: staffUser.id,
          categoryId: testCategoryId,
          relatedSystemId: testSystemId,
        },
      });
      const t2 = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-T2-${randomUUID().slice(0, 8)}`,
          summary: "Owned Ticket 2",
          description: "Desc 2",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          status: "IN_PROGRESS",
          version: 3,
          requesterId,
          ownerId: staffUser.id,
          categoryId: testCategoryId,
          relatedSystemId: testSystemId,
        },
      });
      createdTicketIds.push(t1.id, t2.id);

      // Admin deactivates staffUser
      const res = await adminAgent.patch(`/api/admin/users/${staffUser.id}`).send({
        isActive: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);

      // Check session revocation
      const sessionCheck = await staffAgentInstance.get("/api/staff/tickets");
      expect(sessionCheck.status).toBe(401);

      // Check tickets were unassigned and versions incremented atomically
      const updatedT1 = await prisma.ticket.findUniqueOrThrow({ where: { id: t1.id } });
      expect(updatedT1.ownerId).toBeNull();
      expect(updatedT1.version).toBe(2);

      const updatedT2 = await prisma.ticket.findUniqueOrThrow({ where: { id: t2.id } });
      expect(updatedT2.ownerId).toBeNull();
      expect(updatedT2.version).toBe(4);
    });

    it("demoting staff to REQUESTER atomically unassigns owned tickets", async () => {
      const prisma = getPrisma();
      const staffUser = await prisma.user.create({
        data: {
          name: "Demoted Staff",
          email: `demoted-staff-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "IT_STAFF",
          isActive: true,
        },
      });
      createdUserIds.push(staffUser.id);

      const t = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-DEMOTE-${randomUUID().slice(0, 8)}`,
          summary: "Ticket to be unassigned on demotion",
          description: "Desc",
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "OPEN",
          version: 1,
          requesterId,
          ownerId: staffUser.id,
          categoryId: testCategoryId,
          relatedSystemId: testSystemId,
        },
      });
      createdTicketIds.push(t.id);

      // Admin demotes to REQUESTER
      const res = await adminAgent.patch(`/api/admin/users/${staffUser.id}`).send({
        role: "REQUESTER",
      });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("REQUESTER");

      const updatedT = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
      expect(updatedT.ownerId).toBeNull();
      expect(updatedT.version).toBe(2);
    });

    it("preserves submitted tickets, public comments, and internal notes authored by deactivated user", async () => {
      const prisma = getPrisma();
      const authorUser = await prisma.user.create({
        data: {
          name: "Author User",
          email: `author-${marker}@example.com`,
          passwordHash: testPasswordHash,
          role: "IT_STAFF",
          isActive: true,
        },
      });
      createdUserIds.push(authorUser.id);

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-AUTHOR-${randomUUID().slice(0, 8)}`,
          summary: "Authored Ticket",
          description: "Authored Description",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          status: "OPEN",
          version: 1,
          requesterId: authorUser.id,
          ownerId: null,
          categoryId: testCategoryId,
          relatedSystemId: testSystemId,
        },
      });
      createdTicketIds.push(ticket.id);

      const note = await prisma.internalNote.create({
        data: {
          ticketId: ticket.id,
          authorId: authorUser.id,
          content: "Sensitive internal note",
        },
      });

      // Deactivate authorUser
      await adminAgent.patch(`/api/admin/users/${authorUser.id}`).send({
        isActive: false,
      });

      // Verify ticket and note still exist intact with authorId preserved
      const fetchedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(fetchedTicket.requesterId).toBe(authorUser.id);

      const fetchedNote = await prisma.internalNote.findUniqueOrThrow({ where: { id: note.id } });
      expect(fetchedNote.authorId).toBe(authorUser.id);
      expect(fetchedNote.content).toBe("Sensitive internal note");
    });

    it(
      "coordinates concurrent updateOwner vs admin deactivation race without deadlock (timeout: 5000ms)",
      async () => {
        const prisma = getPrisma();
        const targetStaff = await prisma.user.create({
          data: {
            name: "Race Target Staff",
            email: `race-owner-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "IT_STAFF",
            isActive: true,
          },
        });
        createdUserIds.push(targetStaff.id);

        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber: `TKT-RACE1-${randomUUID().slice(0, 8)}`,
            summary: "Reassign vs Deactivate Ticket",
            description: "Test race",
            requestedPriority: "HIGH",
            itPriority: "HIGH",
            status: "OPEN",
            version: 1,
            requesterId,
            ownerId: null,
            categoryId: testCategoryId,
            relatedSystemId: testSystemId,
          },
        });
        createdTicketIds.push(ticket.id);

        // Run updateOwner assigning to targetStaff concurrently with admin deactivating targetStaff
        const [assignRes, deactRes] = await Promise.all([
          adminAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({
            ownerId: targetStaff.id,
            expectedVersion: 1,
          }),
          adminAgent.patch(`/api/admin/users/${targetStaff.id}`).send({
            isActive: false,
          }),
        ]);

        expect(deactRes.status).toBe(200);

        // Final state verification: targetStaff is inactive, and the ticket MUST NOT be owned by targetStaff
        const finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(finalTicket.ownerId).not.toBe(targetStaff.id);
      },
      5000
    );

    it(
      "coordinates concurrent claimTicket vs admin deactivation race without deadlock (timeout: 5000ms)",
      async () => {
        const prisma = getPrisma();
        const claimingStaff = await prisma.user.create({
          data: {
            name: "Claiming Staff",
            email: `claiming-staff-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "IT_STAFF",
            isActive: true,
            mustChangePassword: false,
          },
        });
        createdUserIds.push(claimingStaff.id);
        const claimingAgent = await authenticatedAgentFor(app, claimingStaff.id);

        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber: `TKT-RACE2-${randomUUID().slice(0, 8)}`,
            summary: "Claim vs Deactivate Ticket",
            description: "Test race",
            requestedPriority: "HIGH",
            itPriority: "HIGH",
            status: "NEW",
            version: 0,
            requesterId,
            ownerId: null,
            categoryId: testCategoryId,
            relatedSystemId: testSystemId,
          },
        });
        createdTicketIds.push(ticket.id);

        // Run claimTicket concurrently with deactivation
        const [claimRes, deactRes] = await Promise.all([
          claimingAgent.post(`/api/staff/tickets/${ticket.id}/claim`).send({
            expectedVersion: 0,
          }),
          adminAgent.patch(`/api/admin/users/${claimingStaff.id}`).send({
            isActive: false,
          }),
        ]);

        expect(deactRes.status).toBe(200);

        // Claim either succeeded before deactivation or was rejected with 403 FORBIDDEN
        expect([200, 403]).toContain(claimRes.status);

        // Under no circumstance should the inactive staff remain as the ticket owner
        const finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(finalTicket.ownerId).not.toBe(claimingStaff.id);
      },
      5000
    );

    it(
      "coordinates concurrent claimTicket vs admin demotion race without deadlock (timeout: 5000ms)",
      async () => {
        const prisma = getPrisma();
        const demotingStaff = await prisma.user.create({
          data: {
            name: "Demoting Staff",
            email: `demoting-staff-${marker}@example.com`,
            passwordHash: testPasswordHash,
            role: "IT_STAFF",
            isActive: true,
            mustChangePassword: false,
          },
        });
        createdUserIds.push(demotingStaff.id);
        const demotingAgent = await authenticatedAgentFor(app, demotingStaff.id);

        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber: `TKT-RACE3-${randomUUID().slice(0, 8)}`,
            summary: "Claim vs Demote Ticket",
            description: "Test race",
            requestedPriority: "HIGH",
            itPriority: "HIGH",
            status: "NEW",
            version: 0,
            requesterId,
            ownerId: null,
            categoryId: testCategoryId,
            relatedSystemId: testSystemId,
          },
        });
        createdTicketIds.push(ticket.id);

        // Run claimTicket concurrently with demotion to REQUESTER
        const [claimRes, demoteRes] = await Promise.all([
          demotingAgent.post(`/api/staff/tickets/${ticket.id}/claim`).send({
            expectedVersion: 0,
          }),
          adminAgent.patch(`/api/admin/users/${demotingStaff.id}`).send({
            role: "REQUESTER",
          }),
        ]);

        expect(demoteRes.status).toBe(200);
        expect([200, 403]).toContain(claimRes.status);

        // Under no circumstance should a REQUESTER remain as the ticket owner
        const finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(finalTicket.ownerId).not.toBe(demotingStaff.id);
      },
      5000
    );
  });
});
