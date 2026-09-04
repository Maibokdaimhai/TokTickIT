import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket Detail API Endpoint GET /api/tickets/:id (Lab 2)", () => {
  let userAId: number;
  let userBId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketAId: number;
  let ticketBId: number;
  let activeAttachmentId: number;
  let removedAttachmentId: number;

  beforeAll(async () => {
    const prisma = getPrisma();

    // Clean up any stale test data
    await prisma.attachment.deleteMany({
      where: {
        originalName: { startsWith: "[Detail Test]" },
      },
    });

    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[Detail Test]" },
      },
    });

    await prisma.requesterUser.deleteMany({
      where: {
        email: {
          in: ["detail.userA@example.com", "detail.userB@example.com"],
        },
      },
    });

    // Create 2 test users
    const userA = await prisma.requesterUser.create({
      data: {
        name: "Detail User A",
        email: "detail.userA@example.com",
        department: "Engineering",
        isActive: true,
      },
    });
    userAId = userA.id;

    const userB = await prisma.requesterUser.create({
      data: {
        name: "Detail User B",
        email: "detail.userB@example.com",
        department: "Product",
        isActive: true,
      },
    });
    userBId = userB.id;

    // Get active category & system
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });
    categoryId = category!.id;
    relatedSystemId = system!.id;

    // Create Ticket for User A
    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-990001",
        requesterId: userAId,
        categoryId,
        relatedSystemId,
        requestedPriority: "HIGH",
        status: "NEW",
        summary: "[Detail Test] User A Laptop Issue",
        description: "[Detail Test] My laptop screen is flickering continuously after the latest update.",
      },
    });
    ticketAId = ticketA.id;

    // Attachments for Ticket A: 1 active, 1 removed
    const att1 = await prisma.attachment.create({
      data: {
        ticketId: ticketAId,
        fileName: "test-screen.png",
        originalName: "[Detail Test] screen.png",
        mimeType: "image/png",
        fileSize: 10240,
        filePath: "/tmp/test-screen.png",
        isRemoved: false,
      },
    });
    activeAttachmentId = att1.id;

    const att2 = await prisma.attachment.create({
      data: {
        ticketId: ticketAId,
        fileName: "test-log.pdf",
        originalName: "[Detail Test] error.pdf",
        mimeType: "application/pdf",
        fileSize: 20480,
        filePath: "/tmp/test-log.pdf",
        isRemoved: true,
        removalReason: "Uploaded wrong log file",
        removedAt: new Date(),
      },
    });
    removedAttachmentId = att2.id;

    // Create Ticket for User B
    const ticketB = await prisma.ticket.create({
      data: {
        ticketNumber: "TKT-2026-990002",
        requesterId: userBId,
        categoryId,
        relatedSystemId,
        requestedPriority: "LOW",
        status: "NEW",
        summary: "[Detail Test] User B Wi-Fi Issue",
        description: "[Detail Test] Wi-Fi disconnects intermittently in the cafeteria.",
      },
    });
    ticketBId = ticketB.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.attachment.deleteMany({
      where: {
        originalName: { startsWith: "[Detail Test]" },
      },
    });
    await prisma.ticket.deleteMany({
      where: {
        summary: { startsWith: "[Detail Test]" },
      },
    });
    await prisma.requesterUser.deleteMany({
      where: {
        email: {
          in: ["detail.userA@example.com", "detail.userB@example.com"],
        },
      },
    });
  });

  it("API-06 / BR-05: returns 403 Forbidden when requesting a ticket owned by another requester", async () => {
    // User B tries to view User A's ticket
    const res = await supertest(app)
      .get(`/api/tickets/${ticketAId}`)
      .query({ requesterId: userBId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Access denied");
  });

  it("FR-11 / BR-15: returns 200 OK with full details and attachments for ticket owner", async () => {
    // User A views their own ticket
    const res = await supertest(app)
      .get(`/api/tickets/${ticketAId}`)
      .query({ requesterId: userAId });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketAId);
    expect(res.body.ticketNumber).toBe("TKT-2026-990001");
    expect(res.body.summary).toBe("[Detail Test] User A Laptop Issue");
    expect(res.body.description).toBe("[Detail Test] My laptop screen is flickering continuously after the latest update.");
    expect(res.body.requestedPriority).toBe("HIGH");
    expect(res.body.status).toBe("NEW");

    // Associated models
    expect(res.body.requester.id).toBe(userAId);
    expect(res.body.requester.name).toBe("Detail User A");
    expect(res.body.category.id).toBe(categoryId);
    expect(res.body.relatedSystem.id).toBe(relatedSystemId);

    // Attachments (both active and removed)
    expect(res.body.attachments).toHaveLength(2);

    const activeAtt = res.body.attachments.find((a: any) => a.id === activeAttachmentId);
    expect(activeAtt).toBeDefined();
    expect(activeAtt.isRemoved).toBe(false);
    expect(activeAtt.originalName).toBe("[Detail Test] screen.png");

    const removedAtt = res.body.attachments.find((a: any) => a.id === removedAttachmentId);
    expect(removedAtt).toBeDefined();
    expect(removedAtt.isRemoved).toBe(true);
    expect(removedAtt.removalReason).toBe("Uploaded wrong log file");
    expect(removedAtt.removedAt).toBeDefined();
  });

  it("Defensive Validation: returns 400 Bad Request for non-integer ticket IDs", async () => {
    const res1 = await supertest(app)
      .get("/api/tickets/1.5")
      .query({ requesterId: userAId });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("BAD_REQUEST");

    const res2 = await supertest(app)
      .get("/api/tickets/abc")
      .query({ requesterId: userAId });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("BAD_REQUEST");

    const res3 = await supertest(app)
      .get("/api/tickets/-5")
      .query({ requesterId: userAId });
    expect(res3.status).toBe(400);
    expect(res3.body.error.code).toBe("BAD_REQUEST");
  });

  it("Defensive Validation: returns 400 Bad Request for invalid requesterId query parameter", async () => {
    const res = await supertest(app)
      .get(`/api/tickets/${ticketAId}`)
      .query({ requesterId: "invalid" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 Not Found for non-existent ticket ID", async () => {
    const res = await supertest(app)
      .get("/api/tickets/99999999")
      .query({ requesterId: userAId });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
