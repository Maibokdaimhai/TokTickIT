import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("My Tickets API Endpoint GET /api/tickets (Lab 2)", () => {
  let requesterAId: number;
  let requesterBId: number;
  let inactiveRequesterId: number;
  let category1Id: number;
  let category2Id: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    const prisma = getPrisma();

    // Clean up any stale test data
    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[MyTickets Test]" },
      },
    });

    await prisma.requesterUser.deleteMany({
      where: {
        email: {
          in: [
            "mytickets.userA@example.com",
            "mytickets.userB@example.com",
            "mytickets.inactive@example.com",
          ],
        },
      },
    });

    // Create 2 active requesters and 1 inactive requester
    const userA = await prisma.requesterUser.create({
      data: {
        name: "MyTickets User A",
        email: "mytickets.userA@example.com",
        department: "Engineering",
        isActive: true,
      },
    });
    requesterAId = userA.id;

    const userB = await prisma.requesterUser.create({
      data: {
        name: "MyTickets User B",
        email: "mytickets.userB@example.com",
        department: "Product",
        isActive: true,
      },
    });
    requesterBId = userB.id;

    const inactiveUser = await prisma.requesterUser.create({
      data: {
        name: "MyTickets Inactive",
        email: "mytickets.inactive@example.com",
        department: "Operations",
        isActive: false,
      },
    });
    inactiveRequesterId = inactiveUser.id;

    // Get categories and related systems
    const categories = await prisma.category.findMany({ where: { isActive: true }, take: 2 });
    category1Id = categories[0].id;
    category2Id = categories.length > 1 ? categories[1].id : categories[0].id;

    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    relatedSystemId = system ? system.id : 1;

    // Seed 12 tickets for Requester A across various categories, priorities, and statuses
    // to test pagination, sorting, searching, and filtering
    for (let i = 1; i <= 12; i++) {
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-TEST-2026-${String(i).padStart(4, "0")}`,
          requesterId: requesterAId,
          categoryId: i % 2 === 0 ? category1Id : category2Id,
          relatedSystemId,
          summary: i === 5 ? "[MyTickets Test] Urgent Laptop WiFi issue" : `[MyTickets Test] Ticket ${i} for Requester A`,
          description: `Detailed description for test ticket number ${i}`,
          requestedPriority: i === 5 ? "URGENT" : i % 3 === 0 ? "HIGH" : "MEDIUM",
          status: i === 7 ? "RESOLVED" : i % 4 === 0 ? "IN_PROGRESS" : "NEW",
          createdAt: new Date(Date.now() - (15 - i) * 60000), // sequential timestamps
        },
      });

      // Add attachment to ticket 1
      if (i === 1) {
        await prisma.attachment.create({
          data: {
            ticketId: ticket.id,
            fileName: "evidence-1.pdf",
            originalName: "evidence.pdf",
            mimeType: "application/pdf",
            fileSize: 1024,
            filePath: "server/uploads/evidence-1.pdf",
            isRemoved: false,
          },
        });
      }
    }

    // Seed 2 tickets for Requester B to test ownership isolation
    for (let j = 1; j <= 2; j++) {
      await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-TEST-USERB-${String(j).padStart(3, "0")}`,
          requesterId: requesterBId,
          categoryId: category1Id,
          relatedSystemId,
          summary: `[MyTickets Test] Private Ticket ${j} for Requester B`,
          description: "Private description for Requester B",
          requestedPriority: "LOW",
          status: "NEW",
        },
      });
    }
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[MyTickets Test]" },
      },
    });

    await prisma.requesterUser.deleteMany({
      where: {
        email: {
          in: [
            "mytickets.userA@example.com",
            "mytickets.userB@example.com",
            "mytickets.inactive@example.com",
          ],
        },
      },
    });
  });

  it("API-04 / AC-10: returns paginated list of tickets owned by requester with correct pagination metadata", async () => {
    // Page 1 (limit 5)
    const resPage1 = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, page: 1, limit: 5 });

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.tickets).toHaveLength(5);
    expect(resPage1.body.pagination).toEqual({
      page: 1,
      limit: 5,
      totalItems: 12,
      totalPages: 3,
    });

    // Check ticket item structure
    const firstTicket = resPage1.body.tickets[0];
    expect(firstTicket).toHaveProperty("id");
    expect(firstTicket).toHaveProperty("ticketNumber");
    expect(firstTicket).toHaveProperty("summary");
    expect(firstTicket).toHaveProperty("category");
    expect(firstTicket).toHaveProperty("relatedSystem");
    expect(firstTicket).toHaveProperty("requestedPriority");
    expect(firstTicket).toHaveProperty("status");
    expect(firstTicket).toHaveProperty("attachmentCount");
    expect(typeof firstTicket.attachmentCount).toBe("number");

    // Page 3 (limit 5 -> should return remaining 2 tickets)
    const resPage3 = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, page: 3, limit: 5 });

    expect(resPage3.status).toBe(200);
    expect(resPage3.body.tickets).toHaveLength(2);
    expect(resPage3.body.pagination.page).toBe(3);
  });

  it("API-04 / AC-09: supports case-insensitive search by summary and ticketNumber", async () => {
    // Search by summary keyword "wifi"
    const resSearchSummary = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, search: "wifi" });

    expect(resSearchSummary.status).toBe(200);
    expect(resSearchSummary.body.tickets.length).toBe(1);
    expect(resSearchSummary.body.tickets[0].summary).toContain("Urgent Laptop WiFi issue");

    // Search by ticketNumber
    const resSearchTicketNo = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, search: "2026-0005" });

    expect(resSearchTicketNo.status).toBe(200);
    expect(resSearchTicketNo.body.tickets.length).toBe(1);
    expect(resSearchTicketNo.body.tickets[0].ticketNumber).toBe("TKT-TEST-2026-0005");
  });

  it("API-04: filters tickets by category, priority, and status", async () => {
    // Filter by priority URGENT
    const resPriority = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, priority: "URGENT" });

    expect(resPriority.status).toBe(200);
    expect(resPriority.body.tickets.length).toBe(1);
    expect(resPriority.body.tickets[0].requestedPriority).toBe("URGENT");

    // Filter by status RESOLVED
    const resStatus = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, status: "RESOLVED" });

    expect(resStatus.status).toBe(200);
    expect(resStatus.body.tickets.length).toBe(1);
    expect(resStatus.body.tickets[0].status).toBe("RESOLVED");

    // Filter by Category
    const resCat = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, category: category1Id });

    expect(resCat.status).toBe(200);
    expect(resCat.body.tickets.every((t: any) => t.category.id === category1Id)).toBe(true);
  });

  it("API-05 / AC-03: enforces requester ownership isolation", async () => {
    // Requester B requests their tickets
    const resUserB = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterBId });

    expect(resUserB.status).toBe(200);
    expect(resUserB.body.pagination.totalItems).toBe(2);
    // Requester B must NOT see any tickets from Requester A
    const allRequesterBTickets = resUserB.body.tickets;
    for (const ticket of allRequesterBTickets) {
      expect(ticket.summary).toContain("Requester B");
      expect(ticket.summary).not.toContain("Requester A");
    }
  });

  it("API-10 / AC-16: sorts tickets by createdAt (desc/asc) and ticketNumber (desc/asc)", async () => {
    // Default createdAt_desc
    const resDesc = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, sort: "createdAt_desc", limit: 12 });
    expect(resDesc.status).toBe(200);
    const descDates = resDesc.body.tickets.map((t: any) => new Date(t.createdAt).getTime());
    for (let i = 0; i < descDates.length - 1; i++) {
      expect(descDates[i]).toBeGreaterThanOrEqual(descDates[i + 1]);
    }

    // createdAt_asc
    const resAsc = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, sort: "createdAt_asc", limit: 12 });
    expect(resAsc.status).toBe(200);
    const ascDates = resAsc.body.tickets.map((t: any) => new Date(t.createdAt).getTime());
    for (let i = 0; i < ascDates.length - 1; i++) {
      expect(ascDates[i]).toBeLessThanOrEqual(ascDates[i + 1]);
    }

    // ticketNumber_asc
    const resTicketAsc = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, sort: "ticketNumber_asc", limit: 12 });
    expect(resTicketAsc.status).toBe(200);
    expect(resTicketAsc.body.tickets[0].ticketNumber).toBe("TKT-TEST-2026-0001");
    expect(resTicketAsc.body.tickets[11].ticketNumber).toBe("TKT-TEST-2026-0012");
  });

  it("validates query parameters and rejects invalid or unauthorized requests", async () => {
    // Missing requesterId -> 400
    const resMissingRequester = await supertest(app).get("/api/tickets");
    expect(resMissingRequester.status).toBe(400);

    // Fractional requesterId -> 400
    const resFractional = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: 1.5 });
    expect(resFractional.status).toBe(400);

    // Inactive requester -> 403 Forbidden
    const resInactive = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: inactiveRequesterId });
    expect(resInactive.status).toBe(403);

    // Non-existent requester -> 403 Forbidden
    const resNonExistent = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: 999999 });
    expect(resNonExistent.status).toBe(403);

    // Invalid sort option -> 400
    const resInvalidSort = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, sort: "invalid_sort" });
    expect(resInvalidSort.status).toBe(400);

    // Invalid priority -> 400
    const resInvalidPriority = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, priority: "SUPER_URGENT" });
    expect(resInvalidPriority.status).toBe(400);

    // Limit > 50 -> 400
    const resLimitTooLarge = await supertest(app)
      .get("/api/tickets")
      .query({ requesterId: requesterAId, limit: 100 });
    expect(resLimitTooLarge.status).toBe(400);
  });
});
