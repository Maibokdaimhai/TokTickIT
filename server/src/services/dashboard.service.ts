import { Priority, TicketStatus, type Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { activeStatuses, noDashboardQuery, parseMyActions } from "../validators/dashboard.validator.js";
import { formatAction, actionPeople } from "./action.service.js";

const ticketPreview = { id: true, ticketNumber: true, summary: true, status: true, itPriority: true, owner: { select: { id: true, name: true } }, updatedAt: true } as const;
const recentOrder = [{ updatedAt: "desc" }, { id: "asc" }] as const;
const active: Prisma.TicketWhereInput = { status: { in: activeStatuses } };
const myActionsWhere = (id: number): Prisma.ActionTakenWhereInput => ({ assigneeId: id, status: { in: ["PLANNED", "IN_PROGRESS"] }, ticket: active });
const preview = (ticket: Prisma.TicketGetPayload<{ select: typeof ticketPreview }>) => ({ ...ticket, updatedAt: ticket.updatedAt.toISOString() });
const actionInclude = { ...actionPeople, ticket: { select: ticketPreview } } as const;
const actionPreview = (action: Prisma.ActionTakenGetPayload<{ include: typeof actionInclude }>) => ({ ...formatAction(action), ticket: preview(action.ticket) });

export function dashboardWindow(asOf = new Date()) {
  // Bangkok has a fixed UTC+07 offset and no daylight-saving transitions.
  const local = new Date(asOf.getTime() + 7 * 3600000);
  const windowStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - 6) - 7 * 3600000);
  return { asOf: asOf.toISOString(), timeZone: "Asia/Bangkok" as const, windowStart: windowStart.toISOString() };
}
export async function requesterDashboard(query: Record<string, unknown>, id: number) {
  noDashboardQuery(query);
  return getPrisma().$transaction(async tx => {
    const window = dashboardWindow();
    const recent: Prisma.TicketWhereInput = { requesterId: id, status: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: { gte: window.windowStart, lte: window.asOf } };
    const [activeTickets, waitingForRequester, recentlyResolved, estimates, tickets] = await Promise.all([
      tx.ticket.count({ where: { ...active, requesterId: id } }),
      tx.ticket.count({ where: { requesterId: id, status: "WAITING_FOR_REQUESTER" } }),
      tx.ticket.count({ where: recent }), tx.ticket.count({ where: { ...recent, resolvedAtEstimated: true } }),
      tx.ticket.findMany({ where: { requesterId: id }, select: ticketPreview, orderBy: [...recentOrder], take: 5 }),
    ]);
    return { ...window, metrics: { activeTickets, waitingForRequester, recentlyResolved }, recentlyResolvedIncludesEstimates: estimates > 0, recentTickets: tickets.map(preview) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function staffDashboard(query: Record<string, unknown>, id: number) {
  noDashboardQuery(query);
  return getPrisma().$transaction(async tx => {
    const window = dashboardWindow();
    const [unassignedTickets, myTickets, myActiveActions, statuses, priorities, tickets, actions] = await Promise.all([
      tx.ticket.count({ where: { ...active, ownerId: null } }), tx.ticket.count({ where: { ...active, ownerId: id } }),
      tx.actionTaken.count({ where: myActionsWhere(id) }),
      tx.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
      tx.ticket.groupBy({ by: ["itPriority"], where: active, _count: { _all: true } }),
      tx.ticket.findMany({ select: ticketPreview, orderBy: [...recentOrder], take: 5 }),
      tx.actionTaken.findMany({ where: myActionsWhere(id), include: actionInclude, orderBy: [...recentOrder], take: 5 }),
    ]);
    const byStatus = Object.fromEntries(Object.values(TicketStatus).map(s => [s, 0])) as Record<TicketStatus, number>;
    const byItPriority = Object.fromEntries(Object.values(Priority).map(p => [p, 0])) as Record<Priority, number>;
    for (const row of statuses) byStatus[row.status] = row._count._all;
    for (const row of priorities) byItPriority[row.itPriority] = row._count._all;
    return { ...window, metrics: { unassignedTickets, myTickets, myActiveActions }, byStatus, byItPriority, recentTickets: tickets.map(preview), myActions: actions.map(actionPreview) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function myActiveActions(query: Record<string, unknown>, id: number) {
  const { page, limit } = parseMyActions(query);
  return getPrisma().$transaction(async tx => {
    const where = myActionsWhere(id), totalItems = await tx.actionTaken.count({ where }), offset = (page - 1) * limit;
    const actions = offset >= totalItems ? [] : await tx.actionTaken.findMany({ where, include: actionInclude, orderBy: [...recentOrder], skip: offset, take: limit });
    return { actions: actions.map(actionPreview), pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) } };
  }, { isolationLevel: "RepeatableRead" });
}
