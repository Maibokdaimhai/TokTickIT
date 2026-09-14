import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPrisma } from "../../src/prisma.js";
import { bootstrapPasswords } from "../../prisma/bootstrap-passwords.js";
import { seedData } from "../../prisma/seed-data.js";
import { ensureAuthReady, login } from "../../src/services/auth.service.js";
import { verifyPassword, hashPassword } from "../../src/utils/password.js";
import * as database from "../../src/prisma.js";

// Real SQL rehearsal in a unique schema of the configured disposable test database.
// Every target below is created here; ordinary application schemas are never reset.
const schema = `migration_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("schema", schema);
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = "Migration-test-only1!";
let directory: string;
let fileHash: string;
let migrated = false;
const migrations = fs.readdirSync("prisma/migrations").filter(value => /^\d/.test(value)).sort();
const runMigration = (name: string) => execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "execute", "--url", url.toString(), "--file", `prisma/migrations/${name}/migration.sql`], { stdio: "pipe" });
const checksum = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
beforeAll(async () => {
  await getPrisma().$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "toktickit-migration-"));
  fs.writeFileSync(path.join(directory, "legacy.pdf"), "%PDF-1.4 preserved attachment bytes");
  fileHash = checksum(path.join(directory, "legacy.pdf"));
  for (const name of migrations.slice(0, -1)) runMigration(name);
  await prisma.$executeRaw`INSERT INTO "RequesterUser" (id,name,email,department,"isActive","createdAt","updatedAt") VALUES
    (41,'Migrated active','  MIGRATED@example.com  ','Support',true,'2026-01-01','2026-02-01'),
    (42,'Migrated inactive','inactive@example.com','Support',false,'2026-01-01','2026-02-01')`;
  await prisma.$executeRaw`INSERT INTO "Category" (id,name) VALUES (1,'Account and Access')`;
  await prisma.$executeRaw`INSERT INTO "RelatedSystem" (id,name) VALUES (1,'Email')`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Category"','id'), 1), setval(pg_get_serial_sequence('"RelatedSystem"','id'), 1)`;
  await prisma.$executeRaw`INSERT INTO "Ticket" (id,"ticketNumber","requesterId","categoryId","relatedSystemId",summary,description,"requestedPriority","itPriority",status,"createdAt","updatedAt") VALUES
    (1,'TKT-2026-000001',41,1,1,'Legacy ticket one','Original details','HIGH',NULL,'NEW','2026-01-01','2026-02-01'),
    (2,'TKT-2026-000002',42,1,1,'Legacy ticket two','Original details','LOW','URGENT','CLOSED','2026-01-01','2026-02-01')`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Ticket"','id'), 2)`;
  await prisma.$executeRaw`INSERT INTO "Attachment" (id,"ticketId","fileName","originalName","mimeType","fileSize","filePath") VALUES (1,1,'legacy.pdf','รายงาน.pdf','application/pdf',34,${path.join(directory, "legacy.pdf")})`;
}, 30000);
afterAll(async () => {
  await prisma.$disconnect();
  await getPrisma().$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

describe.sequential("Lab 2 migration and idempotent Lab 3 fixtures", () => {
  it("replays on an empty installation with the final non-null constraint", async () => {
    const replaySchema = `${schema}_empty`;
    const replayUrl = new URL(url); replayUrl.searchParams.set("schema", replaySchema);
    await getPrisma().$executeRawUnsafe(`CREATE SCHEMA "${replaySchema}"`);
    const replay = new PrismaClient({ datasources: { db: { url: replayUrl.toString() } } });
    try {
      for (const name of migrations) execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "execute", "--url", replayUrl.toString(), "--file", `prisma/migrations/${name}/migration.sql`], { stdio: "pipe" });
      await ensureAuthReady(replay);
      const columns = await replay.$queryRaw<{ is_nullable: string }[]>`SELECT is_nullable FROM information_schema.columns WHERE table_schema=${replaySchema} AND table_name='User' AND column_name='passwordHash'`;
      expect(columns).toEqual([{ is_nullable: "NO" }]);
    } finally {
      await replay.$disconnect(); await getPrisma().$executeRawUnsafe(`DROP SCHEMA "${replaySchema}" CASCADE`);
    }
  }, 30000);
  it("aborts normalized email collisions without partial changes", async () => {
    await prisma.$executeRaw`INSERT INTO "RequesterUser" (id,name,email,department,"updatedAt") VALUES (43,'Collision','migrated@example.com','Support',now())`;
    expect(() => runMigration(migrations.at(-1)!)).toThrow();
    expect(await prisma.$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = ${schema} AND table_name = 'User'`).toEqual([]);
    const before = await prisma.$queryRaw<{ itPriority: string | null }[]>`SELECT "itPriority" FROM "Ticket" WHERE id=1`;
    expect(before[0].itPriority).toBeNull();
    await prisma.$executeRaw`DELETE FROM "RequesterUser" WHERE id=43`;
  });
  it("preserves identities/tickets/files, fills only null priority, fails closed then bootstraps once", async () => {
    runMigration(migrations.at(-1)!); migrated = true;
    await expect(ensureAuthReady(prisma)).rejects.toThrow("bootstrap");
    expect(await bootstrapPasswords(password, prisma)).toBe(2); await ensureAuthReady(prisma);
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    expect(users.map(u => [u.id, u.email, u.isActive, u.role, u.mustChangePassword])).toEqual([[41,"migrated@example.com",true,"REQUESTER",true],[42,"inactive@example.com",false,"REQUESTER",true]]);
    expect(users[0].createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z"); expect(users[0].updatedAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(await verifyPassword(password, users[0].passwordHash)).toBe(true); expect(users[0].passwordHash).not.toBe(users[1].passwordHash);
    const tickets = await prisma.ticket.findMany({ orderBy: { id: "asc" } });
    expect(tickets.map(t => [t.id,t.ticketNumber,t.requesterId,t.status,t.itPriority,t.ownerId,t.version])).toEqual([[1,"TKT-2026-000001",41,"NEW","HIGH",null,0],[2,"TKT-2026-000002",42,"CLOSED","URGENT",null,0]]);
    expect(tickets[0].summary).toBe("Legacy ticket one"); expect(tickets[0].updatedAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: 1 } });
    expect(attachment.originalName).toBe("รายงาน.pdf"); expect(attachment.ticketId).toBe(1); expect(checksum(attachment.filePath)).toBe(fileHash);
    expect(await prisma.$queryRaw`SELECT id FROM "RequesterUser" ORDER BY id`).toEqual([{ id: 41 }, { id: 42 }]);
    expect(await bootstrapPasswords("Another-test-pass2!", prisma)).toBe(0);
    expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(users);
    vi.spyOn(database, "getPrisma").mockReturnValue(prisma);
    try {
      const signed = await login({ email: "migrated@example.com", password });
      expect(signed.result.user.id).toBe(41); expect(signed.result.mustChangePassword).toBe(true);
      await expect(login({ email: "inactive@example.com", password })).rejects.toMatchObject({ status: 403 });
    } finally { vi.restoreAllMocks(); }
  }, 30000);
  it("covers seed counts, statuses, ownership, authorship and preserves intentional edits on rerun", async () => {
    expect(migrated).toBe(true);
    const collision = await prisma.user.create({ data: { name: "Unrelated account", email: "alex.thompson@example.com", passwordHash: await hashPassword(password) } });
    await expect(seedData(password, prisma)).rejects.toThrow("collision");
    expect(await prisma.user.count()).toBe(3); expect(await prisma.ticket.count()).toBe(2);
    await prisma.user.delete({ where: { id: collision.id } });
    await seedData(password, prisma);
    const users = await prisma.user.findMany({ where: { seedKey: { not: null } }, orderBy: { id: "asc" } });
    expect(users).toHaveLength(10); expect(users.every(u => u.id > 42)).toBe(true);
    for (const [role, active, count] of [["REQUESTER",true,4],["REQUESTER",false,1],["IT_STAFF",true,3],["IT_STAFF",false,1],["ADMINISTRATOR",true,1]] as const) expect(users.filter(u => u.role === role && u.isActive === active)).toHaveLength(count);
    expect(new Set(users.map(u => u.passwordHash)).size).toBe(10);
    const tickets = await prisma.ticket.findMany({ where: { seedKey: { not: null } }, orderBy: { id: "asc" } }); expect(tickets).toHaveLength(24);
    expect(new Set(tickets.map(t => t.status)).size).toBe(8); for (const status of new Set(tickets.map(t => t.status))) expect(tickets.filter(t => t.status === status)).toHaveLength(3);
    expect(new Set(tickets.map(t => t.requesterId)).size).toBe(4); expect(new Set(tickets.map(t => t.requestedPriority)).size).toBe(4); expect(new Set(tickets.map(t => t.itPriority)).size).toBe(4);
    expect(tickets.some(t => t.itPriority !== t.requestedPriority)).toBe(true); expect(tickets.some(t => t.ownerId === null)).toBe(true); expect(tickets.some(t => t.ownerId !== null)).toBe(true);
    const comments = await prisma.publicComment.findMany({ include: { author: true, ticket: true } }); expect(comments).toHaveLength(8);
    for (const c of comments) expect(c.author.role !== "REQUESTER" || c.authorId === c.ticket.requesterId).toBe(true);
    const notes = await prisma.internalNote.findMany({ include: { author: true } }); expect(notes).toHaveLength(4); for (const n of notes) expect(n.author.role).not.toBe("REQUESTER");
    const changed = await prisma.user.update({ where: { id: users[0].id }, data: { name: "Edited fixture", email: "edited@example.com", passwordHash: await hashPassword("Intentionally-changed3!"), role: "IT_STAFF", isActive: false, mustChangePassword: false } });
    const editedTicket = await prisma.ticket.update({ where: { id: tickets[0].id }, data: { summary: "Edited fixture ticket", itPriority: "URGENT", status: "CANCELLED" } });
    const editedComment = await prisma.publicComment.update({ where: { id: comments[0].id }, data: { content: "Preserve edited comment" } });
    const editedNote = await prisma.internalNote.update({ where: { id: notes[0].id }, data: { content: "Preserve edited note" } });
    await seedData("Different-test-pass2!", prisma);
    expect(await prisma.user.count()).toBe(12); expect(await prisma.ticket.count()).toBe(26); expect(await prisma.publicComment.count()).toBe(8); expect(await prisma.internalNote.count()).toBe(4);
    expect(await prisma.user.findUnique({ where: { id: changed.id } })).toEqual(changed);
    expect(await prisma.ticket.findUnique({ where: { id: editedTicket.id } })).toEqual(editedTicket);
    expect(await prisma.publicComment.findUnique({ where: { id: editedComment.id } })).toEqual(editedComment);
    expect(await prisma.internalNote.findUnique({ where: { id: editedNote.id } })).toEqual(editedNote);
  }, 30000);
});
