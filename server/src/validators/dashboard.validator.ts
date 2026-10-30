import type { Prisma, TicketStatus } from "@prisma/client";
import { ApiError } from "../errors/api-error.js";
import { parseActionPage } from "./action.validator.js";

export const activeStatuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const invalid = (message = "Invalid query parameters"): never => { throw new ApiError(400, { code: "BAD_REQUEST", message }); };
function instant(value: unknown): Date {
  if (typeof value !== "string") return invalid("Resolution bounds must be ISO instants with offsets");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return invalid("Resolution bounds must be ISO instants with offsets");
  const [, year, month, day, hour, minute, second, offset] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`), date = new Date(value);
  if (+year < 1 || calendar.getUTCMonth() + 1 !== +month || calendar.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59 ||
      (offset !== "Z" && (+offset.slice(1, 3) > 23 || +offset.slice(4) > 59)) || !Number.isFinite(date.getTime())) return invalid("Invalid resolution date range");
  return date;
}
// Shared by both retained Ticket lists, so dashboard predicates cannot be dropped.
export function dashboardTicketFilters(query: Record<string, unknown>): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};
  if (query.statusGroup !== undefined) {
    if (query.statusGroup !== "active" || query.status !== undefined) invalid("statusGroup must be active and cannot be combined with status");
    where.status = { in: activeStatuses };
  }
  if (query.resolvedFrom !== undefined || query.resolvedTo !== undefined) {
    const from = instant(query.resolvedFrom), to = instant(query.resolvedTo);
    if (from > to) invalid("resolvedFrom must not be after resolvedTo");
    where.AND = [{ status: { in: ["RESOLVED", "CLOSED"] } }, { resolvedAt: { gte: from, lte: to } }];
  }
  return where;
}
export function noDashboardQuery(query: Record<string, unknown>) { if (Object.keys(query).length) invalid(); }
export function parseMyActions(query: Record<string, unknown>) {
  if (query.assignee !== "me" || query.statusGroup !== "active") invalid("assignee=me and statusGroup=active are required");
  const { assignee: _assignee, statusGroup: _group, ...page } = query;
  return parseActionPage(page);
}
