import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { generateTicketNumber } from "../../src/utils/ticket-number.js";

describe("Create Ticket API & Reference Endpoints (Lab 2)", () => {
  let activeRequesterId: number;
  let inactiveRequesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const prisma = getPrisma();

    // Cleanup previous test users/tickets if existing
    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[Test Ticket]" },
      },
    });

    await prisma.requesterUser.deleteMany({
      where: {
        email: { in: ["active.ticket.test@example.com", "inactive.ticket.test@example.com"] },
      },
    });

    // Create Active Test Requester
    const activeRequester = await prisma.requesterUser.create({
      data: {
        name: "Active Ticket Tester",
        email: "active.ticket.test@example.com",
        department: "Quality Assurance",
        isActive: true,
      },
    });
    activeRequesterId = activeRequester.id;

    // Create Inactive Test Requester
    const inactiveRequester = await prisma.requesterUser.create({
      data: {
        name: "Inactive Ticket Tester",
        email: "inactive.ticket.test@example.com",
        department: "Quality Assurance",
        isActive: false,
      },
    });
    inactiveRequesterId = inactiveRequester.id;

    // Get Category & Related System IDs
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const relatedSystem = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    categoryId = category ? category.id : 1;
    relatedSystemId = relatedSystem ? relatedSystem.id : 1;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[Test Ticket]" },
      },
    });
    await prisma.requesterUser.deleteMany({
      where: {
        email: { in: ["active.ticket.test@example.com", "inactive.ticket.test@example.com"] },
      },
    });
    await prisma.$disconnect();
  });

  describe("UNIT-01: Ticket Number Generator Utility", () => {
    it("generates sequential annual ticket string TKT-YYYY-XXXXXX", async () => {
      const prisma = getPrisma();
      const ticketNum = await generateTicketNumber(prisma);
      const currentYear = new Date().getFullYear();
      expect(ticketNum).toMatch(new RegExp(`^TKT-${currentYear}-\\d{6}$`));
    });
  });

  describe("GET /api/related-systems", () => {
    it("returns 200 OK with list of active related systems", async () => {
      const res = await supertest(app).get("/api/related-systems");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name");
    });
  });

  describe("API-02 & API-03: POST /api/tickets", () => {
    it("returns 201 Created with generated ticket number and status NEW on valid input", async () => {
      const payload = {
        requesterId: activeRequesterId,
        categoryId,
        relatedSystemId,
        summary: "[Test Ticket] Cannot connect to campus Wi-Fi in lab",
        description: "[Test Ticket] Experienced connection timeout error when trying to authenticate with LEB2 account.",
        requestedPriority: "HIGH",
      };

      const res = await supertest(app).post("/api/tickets").send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("ticketNumber");
      expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
      expect(res.body.status).toBe("NEW");
      expect(res.body.summary).toBe(payload.summary);
      expect(res.body.requestedPriority).toBe("HIGH");
      expect(res.body.requester.id).toBe(activeRequesterId);
    });

    it("returns 400 Bad Request with field validation details when inputs are invalid", async () => {
      const invalidPayload = {
        requesterId: activeRequesterId,
        categoryId,
        relatedSystemId,
        summary: "Tiny", // < 5 chars
        description: "Short", // < 10 chars
        requestedPriority: "SUPER_URGENT", // invalid enum
      };

      const res = await supertest(app).post("/api/tickets").send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it("returns 403 Forbidden when requester account is inactive (BR-13)", async () => {
      const payload = {
        requesterId: inactiveRequesterId,
        categoryId,
        relatedSystemId,
        summary: "[Test Ticket] Inactive user request test",
        description: "[Test Ticket] Attempting ticket creation from inactive account",
        requestedPriority: "LOW",
      };

      const res = await supertest(app).post("/api/tickets").send(payload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects fractional numeric IDs (e.g. categoryId: 1.5) with 400 Bad Request instead of 500", async () => {
      const payload = {
        requesterId: 1.5,
        categoryId: 2.7,
        relatedSystemId: 3.14,
        summary: "[Test Ticket] Fractional ID validation test",
        description: "[Test Ticket] Testing that fractional IDs are caught by integer validation",
        requestedPriority: "LOW",
      };

      const res = await supertest(app).post("/api/tickets").send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.details).toContain("Category ID must be a valid positive integer.");
      expect(res.body.error.details).toContain("Related System ID must be a valid positive integer.");
      expect(res.body.error.details).toContain("Requester ID must be a valid positive integer.");
    });

    it("safely handles parallel ticket creation requests without duplicate ticketNumber collisions", async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        supertest(app)
          .post("/api/tickets")
          .send({
            requesterId: activeRequesterId,
            categoryId,
            relatedSystemId,
            summary: `[Test Ticket] Concurrency creation test ticket ${i + 1}`,
            description: `[Test Ticket] Testing parallel creation to ensure unique sequential ticket numbers ${i + 1}`,
            requestedPriority: "LOW",
          })
      );

      const responses = await Promise.all(requests);

      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("ticketNumber");
        expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
      }

      const ticketNumbers = responses.map((r) => r.body.ticketNumber);
      const uniqueNumbers = new Set(ticketNumbers);
      expect(uniqueNumbers.size).toBe(ticketNumbers.length);
    });
  });

  describe("API-11: DELETE /api/tickets/:id (Compensation Rollback)", () => {
    it("deletes draft ticket and returns 200 OK during compensation rollback", async () => {
      // 1. Create a draft ticket
      const createRes = await supertest(app).post("/api/tickets").send({
        requesterId: activeRequesterId,
        categoryId,
        relatedSystemId,
        summary: "[Test Ticket] Draft ticket for rollback test",
        description: "[Test Ticket] Will be deleted during compensation rollback test",
        requestedPriority: "MEDIUM",
      });

      expect(createRes.status).toBe(201);
      const ticketId = createRes.body.id;

      // 2. Call compensation rollback DELETE endpoint
      const deleteRes = await supertest(app)
        .delete(`/api/tickets/${ticketId}?requesterId=${activeRequesterId}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe("ok");

      // 3. Verify ticket is removed from DB
      const findTicket = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
      expect(findTicket).toBeNull();
    });

    it("uploads initial attachment to draft ticket and cleans up physical file on rollback", async () => {
      // 1. Create a draft ticket
      const createRes = await supertest(app).post("/api/tickets").send({
        requesterId: activeRequesterId,
        categoryId,
        relatedSystemId,
        summary: "[Test Ticket] Draft ticket for file rollback test",
        description: "[Test Ticket] Testing physical file cleanup on compensation rollback",
        requestedPriority: "LOW",
      });

      expect(createRes.status).toBe(201);
      const ticketId = createRes.body.id;

      // 2. Upload an attachment via POST /api/tickets/:id/attachments
      const uploadRes = await supertest(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .field("requesterId", activeRequesterId)
        .attach("file", Buffer.from("dummy pdf content for testing"), "test-evidence.pdf");

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body).toHaveProperty("id");
      expect(uploadRes.body.originalName).toBe("test-evidence.pdf");
      expect(uploadRes.body.mimeType).toBe("application/pdf");

      const attachmentInDb = await getPrisma().attachment.findUnique({
        where: { id: uploadRes.body.id },
      });
      expect(attachmentInDb).not.toBeNull();

      // 3. Trigger compensation rollback DELETE /api/tickets/:id
      const deleteRes = await supertest(app)
        .delete(`/api/tickets/${ticketId}?requesterId=${activeRequesterId}`);

      expect(deleteRes.status).toBe(200);

      // 4. Verify ticket and attachment record deleted from DB
      const ticketAfterDelete = await getPrisma().ticket.findUnique({ where: { id: ticketId } });
      expect(ticketAfterDelete).toBeNull();

      const attachmentAfterDelete = await getPrisma().attachment.findUnique({
        where: { id: uploadRes.body.id },
      });
      expect(attachmentAfterDelete).toBeNull();
    });

    it("returns 403 Forbidden if attempting rollback on ticket owned by another requester", async () => {
      const createRes = await supertest(app).post("/api/tickets").send({
        requesterId: activeRequesterId,
        categoryId,
        relatedSystemId,
        summary: "[Test Ticket] Rollback ownership test",
        description: "[Test Ticket] Attempting rollback with wrong requesterId",
        requestedPriority: "LOW",
      });

      const ticketId = createRes.body.id;

      const deleteRes = await supertest(app)
        .delete(`/api/tickets/${ticketId}?requesterId=999999`);

      expect(deleteRes.status).toBe(403);
    });
  });
});
