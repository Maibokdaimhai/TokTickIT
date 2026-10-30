import "../../src/config.js";
import { validateDatabaseUrl } from "../../../e2e/lab-03/db-guard.js";
import { PrismaClient, type Prisma } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { vi } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";
import * as database from "../../src/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { digest, newSessionToken } from "../../src/utils/session.js";

export function disposableUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || process.env.E2E_ALLOW_DB_WRITE !== "1") throw new Error("Lab 4 DB tests require DATABASE_URL and explicit E2E_ALLOW_DB_WRITE=1");
  if (!validateDatabaseUrl(raw, process.env.E2E_ALLOW_DB_WRITE).valid) throw new Error("Lab 4 DB tests refuse a non-disposable database");
  return new URL(raw);
}
export async function fixture(migrate = true) {
  const base = disposableUrl();
  const admin = new PrismaClient({ datasources: { db: { url: base.toString() } } });
  const schema = `lab4_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(base); url.searchParams.set("schema", schema);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const migrations = fs.readdirSync("prisma/migrations").filter(x => /^\d/.test(x)).sort();
  const runMigration = (name: string) => {
    try {
      execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "execute", "--url", url.toString(), "--file", `prisma/migrations/${name}/migration.sql`], { stdio: "pipe" });
    } catch { throw new Error(`Disposable migration failed: ${name}`); }
  };
  const close = async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
    // Only the UUID schema created by this fixture may be cleaned up.
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  };
  try { if (migrate) migrations.forEach(runMigration); } catch (error) { await close(); throw error; }
  vi.spyOn(database, "getPrisma").mockReturnValue(prisma);
  const passwordHash = await hashPassword("Lab4-test-fixture-only1!");
  const user = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", extra: Partial<Prisma.UserUncheckedCreateInput> = {}) => prisma.user.create({ data: {
    name: `Fixture ${role}`, email: `${randomUUID()}@lab4.example`, passwordHash, role, mustChangePassword: false, ...extra,
  } });
  const agent = async (userId: number) => {
    const token = newSessionToken();
    await prisma.session.create({ data: { userId, tokenDigest: digest(token), expiresAt: new Date(Date.now() + 3600000) } });
    return supertest.agent(app).set("Origin", "http://localhost:5173").set("Cookie", `toktickit_session=${token}`);
  };
  const ticket = async (requesterId: number, extra: Partial<Prisma.TicketUncheckedCreateInput> = {}) => {
    const category = await prisma.category.upsert({ where: { name: "Lab 4 test" }, update: {}, create: { name: "Lab 4 test" } });
    const system = await prisma.relatedSystem.upsert({ where: { name: "Lab 4 system" }, update: {}, create: { name: "Lab 4 system" } });
    return prisma.ticket.create({ data: { ticketNumber: `TEST-${randomUUID()}`, requesterId, categoryId: category.id, relatedSystemId: system.id,
      summary: "Lab 4 fixture", description: "Test issue", requestedPriority: "MEDIUM", itPriority: "MEDIUM", createdAt: new Date("2026-01-01T00:00:00Z"), ...extra } });
  };
  return { prisma, schema, url, migrations, runMigration, close, user, agent, ticket };
}
export function createBody(assigneeId: number, expectedTicketVersion = 0) {
  return { clientRequestId: randomUUID(), expectedTicketVersion, actionAt: "2026-01-02T10:00:00+07:00", description: "Inspect network equipment", assigneeId, followUpRequired: false, status: "IN_PROGRESS" };
}
