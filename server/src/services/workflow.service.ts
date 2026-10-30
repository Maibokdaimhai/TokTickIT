import type { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { parseTicketId } from "../validators/id.validator.js";
import { parseActionPage } from "../validators/action.validator.js";
import type { AuthenticatedActor } from "../types/auth.js";

export async function resolutionBlockers(tx: Prisma.TransactionClient, ticketId: number) {
  // All action writers and status transitions hold the parent Ticket lock. The
  // aggregate therefore observes a stable child set without loading action text.
  const [counts] = await tx.$queryRaw<{ completed: number; active: number; followUp: number }[]>`
    SELECT
      count(*) FILTER (WHERE status = 'COMPLETED' AND result IS NOT NULL AND result ~ '[^[:space:]]')::int AS completed,
      count(*) FILTER (WHERE status IN ('PLANNED', 'IN_PROGRESS'))::int AS active,
      count(*) FILTER (WHERE status <> 'CANCELLED' AND "followUpRequired" = true)::int AS "followUp"
    FROM "ActionTaken" WHERE "ticketId" = ${ticketId}`;
  const details: { field: string; message: string }[] = [];
  if (!counts.completed) details.push({ field: "completedAction", message: "Record at least one completed Action with a result before resolving this Ticket." });
  if (counts.active) details.push({ field: "activeActions", message: "Complete or cancel the remaining planned and in-progress Actions." });
  if (counts.followUp) details.push({ field: "followUp", message: "Finish outstanding follow-up. For completed Actions, use Record Follow-up Completion." });
  return details;
}

export async function listStatusHistory(idParam: unknown, query: Record<string, unknown>, actor: AuthenticatedActor) {
  const id = parseTicketId(idParam), { page, limit } = parseActionPage(query);
  return getPrisma().$transaction(async tx => {
    const ticket = await tx.ticket.findUnique({ where: { id }, select: { requesterId: true } });
    if (!ticket || (actor.role === "REQUESTER" && ticket.requesterId !== actor.id)) throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    const marker = await tx.labMetadata.findUnique({ where: { key: "lab4-history-start" } });
    if (!marker) throw new Error("Lab 4 history migration has not been applied");
    const total = await tx.ticketStatusEvent.count({ where: { ticketId: id } }), offset = (page - 1) * limit;
    const events = offset >= total ? [] : await tx.ticketStatusEvent.findMany({ where: { ticketId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: offset, take: limit,
      select: { id: true, ticketId: true, fromStatus: true, toStatus: true, ticketVersion: true, createdAt: true, actor: { select: { id: true, name: true, role: true, isActive: true } } } });
    return { events: events.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })), pagination: { page, limit, totalItems: total, totalPages: Math.ceil(total / limit) }, historyStartsAt: marker.recordedAt.toISOString() };
  }, { isolationLevel: "RepeatableRead" });
}
