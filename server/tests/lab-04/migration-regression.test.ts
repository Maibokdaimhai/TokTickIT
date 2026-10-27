import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixture } from "./fixture.js";
import { seedData } from "../../prisma/seed-data.js";
import { seedLab4Data } from "../../prisma/seed-lab4-data.js";

describe.sequential("Lab 4 additive migration, seed and restore rehearsal", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  let before: Record<string, unknown>[];
  let file: string, fileHash: string, directory: string;
  let dump: Buffer | undefined;
  const container = process.env.LAB4_RECOVERY_CONTAINER;
  beforeAll(async () => {
    f = await fixture(false);
    for (const name of f.migrations.filter(x => x < '20261027090000')) f.runMigration(name);
    const requester = await f.user('REQUESTER'), staff = await f.user('IT_STAFF');
    const category = await f.prisma.category.create({ data: { name: 'Legacy category' } });
    const system = await f.prisma.relatedSystem.create({ data: { name: 'Legacy system' } });
    for (const [id, status] of [[1, 'NEW'], [2, 'CLOSED']] as const) {
      await f.prisma.$executeRaw`INSERT INTO "Ticket" (id, "ticketNumber", "requesterId", "categoryId", "relatedSystemId", summary, description, "requestedPriority", "itPriority", status, "createdAt", "updatedAt")
        VALUES (${id}, ${`LEGACY-${id}`}, ${requester.id}, ${category.id}, ${system.id}, 'Original summary', 'Original details', 'HIGH', 'URGENT', ${status}::"TicketStatus", '2026-01-01', '2026-01-02')`;
    }
    await f.prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Ticket"','id'), 2)`;
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toktickit-lab4-migration-'));
    file = path.join(directory, 'legacy.txt'); fs.writeFileSync(file, 'Preserved legacy attachment');
    fileHash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    await f.prisma.attachment.create({ data: { ticketId: 1, fileName: 'legacy.txt', originalName: 'legacy.txt', filePath: file, mimeType: 'text/plain', fileSize: fs.statSync(file).size } });
    await f.prisma.publicComment.create({ data: { ticketId: 1, authorId: requester.id, content: 'Original public comment' } });
    await f.prisma.internalNote.create({ data: { ticketId: 1, authorId: staff.id, content: 'Original private note' } });
    before = await f.prisma.$queryRaw`SELECT * FROM "Ticket" ORDER BY id`;
    if (container) {
      // Only the guarded disposable DB/schema is dumped; credentials never enter output.
      dump = execFileSync('docker', ['exec', container, 'pg_dump', '--username', decodeURIComponent(f.url.username), '--dbname', decodeURIComponent(f.url.pathname.slice(1)), '--schema', f.schema, '--format=custom'], { stdio: ['pipe', 'pipe', 'pipe'] });
    }
  }, 30000);
  afterAll(async () => { if (f) await f.close(); if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
  it("preserves legacy values/relationships/files and invents no action or transition history", async () => {
    f.runMigration('20261027090000_lab4_actions_foundation');
    // A schema-changing migration requires fresh prepared statements, as on app restart.
    await f.prisma.$disconnect();
    const after = await f.prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM "Ticket" ORDER BY id`;
    for (let i = 0; i < before.length; i++) for (const key of Object.keys(before[i])) expect(after[i][key]).toEqual(before[i][key]);
    expect(after[0]).toMatchObject({ resolvedAt: null, resolvedAtEstimated: false });
    expect(after[1]).toMatchObject({ resolvedAt: new Date('2026-01-02T00:00:00Z'), resolvedAtEstimated: true });
    expect(await f.prisma.actionTaken.count()).toBe(0); expect(await f.prisma.actionTakenRevision.count()).toBe(0); expect(await f.prisma.ticketStatusEvent.count()).toBe(0);
    expect(await f.prisma.labMetadata.findUnique({ where: { key: 'lab4-history-start' } })).not.toBeNull();
    expect(await f.prisma.publicComment.count()).toBe(1); expect(await f.prisma.internalNote.count()).toBe(1);
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(fileHash);
  });
  it("seeds repeatably with zero/one/multiple actions and preserves intentional user edits", async () => {
    await seedData('Lab4-test-fixture-only1!', f.prisma);
    const first = await seedLab4Data(f.prisma);
    expect(first).toEqual({ tickets: 16, actions: 15 });
    const actions = await f.prisma.actionTaken.findMany({ orderBy: { id: 'asc' } });
    expect(new Set(actions.map(a => a.status)).size).toBe(4);
    const tickets = await f.prisma.ticket.findMany({ where: { seedKey: { startsWith: 'lab4-ticket-' } }, include: { _count: { select: { actions: true } } } });
    expect(new Set(tickets.map(t => t.status)).size).toBe(8);
    expect(new Set(tickets.map(t => t._count.actions))).toEqual(new Set([0, 1, 2]));
    const edited = await f.prisma.actionTaken.update({ where: { id: actions[0].id }, data: { description: 'Intentional user edit' } });
    const beforeRevisions = await f.prisma.actionTakenRevision.findMany({ orderBy: { id: 'asc' } });
    expect(await seedLab4Data(f.prisma)).toEqual(first);
    expect(await f.prisma.actionTaken.findUnique({ where: { id: edited.id } })).toEqual(edited);
    expect(await f.prisma.actionTakenRevision.findMany({ orderBy: { id: 'asc' } })).toEqual(beforeRevisions);
    expect(await f.prisma.ticketStatusEvent.count()).toBe(0);
    expect(await f.prisma.ticket.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({ summary: 'Original summary' });
  }, 30000);
  it.skipIf(!container)("restores the pre-migration backup into a second disposable database", async () => {
    expect(dump?.length).toBeGreaterThan(0);
    const name = `toktickit_lab4_recovery_test_${randomUUID().replaceAll('-', '')}`;
    const recoveryUrl = new URL(f.url); recoveryUrl.pathname = '/' + name;
    const recovery = new PrismaClient({ datasources: { db: { url: recoveryUrl.toString() } } });
    await f.prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    try {
      execFileSync('docker', ['exec', '-i', container!, 'pg_restore', '--username', decodeURIComponent(f.url.username), '--dbname', name, '--exit-on-error'], { input: dump, stdio: ['pipe', 'pipe', 'pipe'] });
      expect(await recovery.$queryRaw`SELECT * FROM "Ticket" ORDER BY id`).toEqual(before);
      expect(await recovery.publicComment.count()).toBe(1); expect(await recovery.internalNote.count()).toBe(1);
      expect(await recovery.attachment.findFirstOrThrow()).toMatchObject({ ticketId: 1, filePath: file });
      expect(await recovery.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = ${f.schema} AND table_name = 'ActionTaken'`).toEqual([]);
      // Rehearse the restored Lab 3 data path using only its original columns.
      expect(await recovery.$queryRaw`SELECT t.status, u.role FROM "Ticket" t JOIN "User" u ON u.id=t."requesterId" WHERE t.id=1`).toEqual([{ status: 'NEW', role: 'REQUESTER' }]);
      await recovery.$executeRaw`UPDATE "Ticket" SET status='OPEN', version=version+1 WHERE id=1 AND version=0`;
      expect(await recovery.$queryRaw`SELECT status, version FROM "Ticket" WHERE id=1`).toEqual([{ status: 'OPEN', version: 1 }]);
    } finally {
      await recovery.$disconnect();
      await f.prisma.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    }
  }, 30000);
});
