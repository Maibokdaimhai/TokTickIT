import type { PrismaClient } from "@prisma/client";

function requireDisposableDatabase() {
  const name = decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").pathname.slice(1));
  if (process.env.E2E_ALLOW_DB_WRITE !== "1" || name === "toktickit" || !/(test|e2e|disposable)/i.test(name)) throw new Error("Audit fixture cleanup requires an explicitly writable disposable database");
}
// Never disable history triggers or erase audit evidence to satisfy old teardown.
// Audited fixtures live until the disposable database is discarded as a whole.
export async function unauditedFixtureTickets(prisma: PrismaClient, ids: number[]) {
  requireDisposableDatabase();
  return (await prisma.ticket.findMany({ where: { id: { in: ids }, actions: { none: {} }, statusEvents: { none: {} } }, select: { id: true } })).map(t => t.id);
}
export async function removeUnreferencedFixtureUsers(prisma: PrismaClient, ids: number[]) {
  requireDisposableDatabase();
  await prisma.user.deleteMany({ where: { id: { in: ids }, submittedTickets: { none: {} }, ownedTickets: { none: {} }, resolutionTickets: { none: {} },
    publicComments: { none: {} }, internalNotes: { none: {} }, performedActions: { none: {} }, assignedActions: { none: {} }, completedFollowUps: { none: {} }, actionRevisions: { none: {} }, ticketStatusEvents: { none: {} } } });
}
