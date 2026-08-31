import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/requesters — Development Requester Selector API", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    // Ensure test data exists in database
    await prisma.requesterUser.upsert({
      where: { email: "test.active@example.com" },
      update: { isActive: true },
      create: {
        name: "Test Active User",
        email: "test.active@example.com",
        department: "Engineering",
        isActive: true,
      },
    });

    await prisma.requesterUser.upsert({
      where: { email: "test.inactive@example.com" },
      update: { isActive: false },
      create: {
        name: "Test Inactive User",
        email: "test.inactive@example.com",
        department: "Administration",
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.requesterUser.deleteMany({
      where: {
        email: { in: ["test.active@example.com", "test.inactive@example.com"] },
      },
    });
    await prisma.$disconnect();
  });

  it("should return 200 OK with list of active development requesters", async () => {
    const res = await supertest(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Each object must have id, name, email, department
    const user = res.body[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("department");
  });

  it("should exclude inactive requesters from the selection list", async () => {
    const res = await supertest(app).get("/api/requesters");

    expect(res.status).toBe(200);
    const emails = res.body.map((u: { email: string }) => u.email);
    expect(emails).toContain("test.active@example.com");
    expect(emails).not.toContain("test.inactive@example.com");
  });
});
