import { validateDatabaseUrl } from "../../e2e/lab-03/db-guard.js";
import type { PrismaClient } from "@prisma/client";

function requireDisposableDatabase() {
  if (!validateDatabaseUrl(process.env.DATABASE_URL, process.env.E2E_ALLOW_DB_WRITE).valid) throw new Error("Audit fixture cleanup requires an explicitly writable disposable database");
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
