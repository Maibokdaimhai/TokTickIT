import type { ActionStatus, ActionTaken, Prisma, User } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import type { AuthenticatedActor } from "../types/auth.js";
import { parseTicketId, requireIntegerId } from "../validators/id.validator.js";
import { parseActionCreate, parseActionPatch, parseActionPage, parseCompletion, validateActionState, type ActionFields } from "../validators/action.validator.js";

const identity = { id: true, name: true, role: true, isActive: true } as const;
export const actionPeople = { performedBy: { select: identity }, assignee: { select: identity }, followUpCompletedBy: { select: identity } } as const;
const include = actionPeople;
type ActionWithPeople = Prisma.ActionTakenGetPayload<{ include: typeof include }>;
const writable = new Set(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"]);
const transitions: Record<ActionStatus, readonly ActionStatus[]> = { PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
const fail = (status: number, code: string, message: string): never => { throw new ApiError(status, { code, message }); };

export function actionSnapshot(action: ActionTaken): Prisma.InputJsonObject {
  return {
    actionAt: action.actionAt.toISOString(), description: action.description, result: action.result,
    performedById: action.performedById, assigneeId: action.assigneeId, status: action.status,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes, followUpCompletedAt: action.followUpCompletedAt?.toISOString() ?? null,
    followUpCompletedById: action.followUpCompletedById, followUpCompletionNote: action.followUpCompletionNote,
  };
}
export function formatAction(action: ActionWithPeople) {
  return {
    id: action.id, ticketId: action.ticketId, actionAt: action.actionAt.toISOString(),
    description: action.description, result: action.result, performedBy: action.performedBy, assignee: action.assignee,
    status: action.status, version: action.version, followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes,
    followUpCompletedAt: action.followUpCompletedAt?.toISOString() ?? null,
    followUpCompletedBy: action.followUpCompletedBy, followUpCompletionNote: action.followUpCompletionNote,
    createdAt: action.createdAt.toISOString(), updatedAt: action.updatedAt.toISOString(),
  };
}
function ensureStaff(actor: AuthenticatedActor) {
  if (!["IT_STAFF", "ADMINISTRATOR"].includes(actor.role)) fail(403, "FORBIDDEN", "Access denied");
}
async function ticketForRead(tx: Prisma.TransactionClient, id: number, actor: AuthenticatedActor) {
  const ticket = await tx.ticket.findUnique({ where: { id }, select: { id: true, requesterId: true, version: true } });
  if (!ticket || (actor.role === "REQUESTER" && ticket.requesterId !== actor.id)) fail(404, "NOT_FOUND", "Ticket not found");
  return ticket!;
}
const pageInfo = (page: number, limit: number, totalItems: number) => ({ page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) });
export async function listActions(idParam: unknown, query: Record<string, unknown>, actor: AuthenticatedActor) {
  const id = parseTicketId(idParam), { page, limit } = parseActionPage(query);
  return getPrisma().$transaction(async tx => {
    const ticket = await ticketForRead(tx, id, actor);
    const total = await tx.actionTaken.count({ where: { ticketId: id } });
    const offset = (page - 1) * limit;
    const actions = offset >= total ? [] : await tx.actionTaken.findMany({ where: { ticketId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: offset, take: limit, include });
    return { actions: actions.map(formatAction), pagination: pageInfo(page, limit, total), ticketVersion: ticket.version };
  }, { isolationLevel: "RepeatableRead" });
}
function actionId(value: unknown) { return requireIntegerId(value, "Action ID must be a positive integer"); }
export async function getAction(idParam: unknown, actionParam: unknown, query: Record<string, unknown>, actor: AuthenticatedActor) {
  const id = parseTicketId(idParam), aid = actionId(actionParam);
  if (Object.keys(query).length) fail(400, "BAD_REQUEST", "Invalid query parameters");
  return getPrisma().$transaction(async tx => {
    const ticket = await ticketForRead(tx, id, actor);
    const action = await tx.actionTaken.findFirst({ where: { id: aid, ticketId: id }, include });
    if (!action) fail(404, "NOT_FOUND", "Action not found");
    return { action: formatAction(action!), ticketVersion: ticket.version };
  }, { isolationLevel: "RepeatableRead" });
}
export async function listRevisions(idParam: unknown, actionParam: unknown, query: Record<string, unknown>, actor: AuthenticatedActor) {
  const id = parseTicketId(idParam), aid = actionId(actionParam), { page, limit } = parseActionPage(query);
  return getPrisma().$transaction(async tx => {
    await ticketForRead(tx, id, actor);
    if (!await tx.actionTaken.findFirst({ where: { id: aid, ticketId: id }, select: { id: true } })) fail(404, "NOT_FOUND", "Action not found");
    const total = await tx.actionTakenRevision.count({ where: { actionId: aid } });
    const offset = (page - 1) * limit;
    const revisions = offset >= total ? [] : await tx.actionTakenRevision.findMany({ where: { actionId: aid }, orderBy: { version: "asc" }, skip: offset, take: limit,
      select: { id: true, actionId: true, version: true, snapshot: true, createdAt: true, editor: { select: identity } } });
    return { revisions: revisions.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })), pagination: pageInfo(page, limit, total) };
  }, { isolationLevel: "RepeatableRead" });
}
async function lockUsers(tx: Prisma.TransactionClient, actor: AuthenticatedActor, ids: number[]) {
  for (const id of [...new Set([actor.id, ...ids])].sort((a, b) => a - b)) await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
  const current = await tx.user.findUnique({ where: { id: actor.id } });
  if (!current?.isActive) fail(401, "UNAUTHORIZED", "Please sign in");
  if (current!.mustChangePassword) fail(403, "PASSWORD_CHANGE_REQUIRED", "Change your initial password to continue");
  if (!["IT_STAFF", "ADMINISTRATOR"].includes(current!.role) || current!.role !== actor.role) fail(403, "FORBIDDEN", "Access denied");
}
function eligible(user: User | null) {
  if (!user?.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(user.role)) fail(400, "INVALID_ASSIGNEE", "Assignee must be active IT Staff or Administrator");
}
async function lockTicket(tx: Prisma.TransactionClient, id: number) {
  await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
  const ticket = await tx.ticket.findUnique({ where: { id } });
  if (!ticket) fail(404, "NOT_FOUND", "Ticket not found");
  return ticket!;
}
function version(actual: number, expected: number) {
  if (actual !== expected) fail(409, "VERSION_CONFLICT", "Ticket or action version has changed");
}
function writableTicket(status: string) { if (!writable.has(status)) fail(409, "TICKET_READ_ONLY", "Reopen the Ticket before recording more work"); }
function canonical(id: number, data: ActionFields) {
  return JSON.stringify({ ticketId: id, actionAt: data.actionAt.toISOString(), description: data.description, result: data.result,
    assigneeId: data.assigneeId, followUpRequired: data.followUpRequired, followUpNote: data.followUpNote, attachmentNotes: data.attachmentNotes, status: data.status });
}
async function revision(tx: Prisma.TransactionClient, action: ActionTaken, actorId: number) {
  await tx.actionTakenRevision.create({ data: { actionId: action.id, version: action.version, editorId: actorId, snapshot: actionSnapshot(action) } });
}
export async function createAction(idParam: unknown, body: unknown, actor: AuthenticatedActor) {
  ensureStaff(actor);
  const id = parseTicketId(idParam), input = parseActionCreate(body), now = new Date();
  const { expectedTicketVersion, clientRequestId, ...data } = input;
  const canonicalRequest = canonical(id, data);
  return getPrisma().$transaction(async tx => {
    // Serialize a retry identity across Tickets before acquiring any row locks.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${actor.id}:${clientRequestId}`}, 0))`;
    await lockUsers(tx, actor, [data.assigneeId]);
    const ticket = await lockTicket(tx, id);
    const replay = await tx.actionTaken.findUnique({ where: { performedById_clientRequestId: { performedById: actor.id, clientRequestId } }, include });
    if (replay) {
      if (replay.canonicalRequest !== canonicalRequest) fail(409, "IDEMPOTENCY_CONFLICT", "Retry key already used for different work");
      return { action: formatAction(replay), ticketVersion: ticket.version, replayed: true };
    }
    version(ticket.version, expectedTicketVersion); writableTicket(ticket.status);
    eligible(await tx.user.findUnique({ where: { id: data.assigneeId } }));
    validateActionState(data, ticket.createdAt, now);
    const action = await tx.actionTaken.create({ data: { ...data, ticketId: id, performedById: actor.id, clientRequestId, canonicalRequest }, include });
    await revision(tx, action, actor.id);
    const updated = await tx.ticket.update({ where: { id }, data: { version: { increment: 1 }, updatedAt: new Date() } });
    return { action: formatAction(action), ticketVersion: updated.version, replayed: false };
  }, { timeout: 10000 });
}
export async function updateAction(idParam: unknown, actionParam: unknown, body: unknown, actor: AuthenticatedActor) {
  ensureStaff(actor);
  const id = parseTicketId(idParam), aid = actionId(actionParam), input = parseActionPatch(body), now = new Date();
  const prisma = getPrisma();
  // Discover which User row to lock before Ticket; stale discovery is caught by versions.
  const observed = await prisma.actionTaken.findFirst({ where: { id: aid, ticketId: id }, select: { assigneeId: true } });
  const target = input.patch.assigneeId ?? observed?.assigneeId;
  return prisma.$transaction(async tx => {
    await lockUsers(tx, actor, target ? [target] : []);
    const ticket = await lockTicket(tx, id);
    await tx.$executeRaw`SELECT id FROM "ActionTaken" WHERE id = ${aid} AND "ticketId" = ${id} FOR UPDATE`;
    const action = await tx.actionTaken.findFirst({ where: { id: aid, ticketId: id } });
    if (!action) fail(404, "NOT_FOUND", "Action not found");
    version(ticket.version, input.expectedTicketVersion); version(action!.version, input.expectedActionVersion); writableTicket(ticket.status);
    if (["COMPLETED", "CANCELLED"].includes(action!.status)) fail(409, "ACTION_READ_ONLY", "Completed or cancelled work is read-only");
    const merged: ActionFields = { ...action!, ...input.patch };
    if (!merged.followUpRequired) merged.followUpNote = null;
    if (target !== merged.assigneeId) fail(409, "VERSION_CONFLICT", "Assignee changed; refresh the action");
    eligible(await tx.user.findUnique({ where: { id: merged.assigneeId } }));
    if (merged.status !== action!.status && !transitions[action!.status].includes(merged.status)) fail(400, "INVALID_ACTION_TRANSITION", "Invalid action status transition");
    validateActionState(merged, ticket.createdAt, now);
    if (canonical(id, merged) === canonical(id, action!)) fail(400, "INVALID_ACTION_TRANSITION", "Action has not changed");
    const updated = await tx.actionTaken.update({ where: { id: aid }, data: { ...input.patch, followUpNote: merged.followUpNote, version: { increment: 1 } }, include });
    await revision(tx, updated, actor.id);
    const parent = await tx.ticket.update({ where: { id }, data: { version: { increment: 1 }, updatedAt: new Date() } });
    return { action: formatAction(updated), ticketVersion: parent.version };
  }, { timeout: 10000 });
}
export async function completeFollowUp(idParam: unknown, actionParam: unknown, body: unknown, actor: AuthenticatedActor) {
  ensureStaff(actor);
  const id = parseTicketId(idParam), aid = actionId(actionParam), input = parseCompletion(body);
  return getPrisma().$transaction(async tx => {
    await lockUsers(tx, actor, []);
    const ticket = await lockTicket(tx, id);
    await tx.$executeRaw`SELECT id FROM "ActionTaken" WHERE id = ${aid} AND "ticketId" = ${id} FOR UPDATE`;
    const action = await tx.actionTaken.findFirst({ where: { id: aid, ticketId: id } });
    if (!action) fail(404, "NOT_FOUND", "Action not found");
    version(ticket.version, input.expectedTicketVersion); version(action!.version, input.expectedActionVersion); writableTicket(ticket.status);
    if (action!.status !== "COMPLETED" || !action!.followUpRequired || action!.followUpCompletedAt) fail(409, "FOLLOW_UP_NOT_PENDING", "No completed action follow-up is pending");
    const updated = await tx.actionTaken.update({ where: { id: aid }, data: { followUpRequired: false, followUpCompletedAt: new Date(), followUpCompletedById: actor.id, followUpCompletionNote: input.completionNote, version: { increment: 1 } }, include });
    await revision(tx, updated, actor.id);
    const parent = await tx.ticket.update({ where: { id }, data: { version: { increment: 1 }, updatedAt: new Date() } });
    return { action: formatAction(updated), ticketVersion: parent.version };
  }, { timeout: 10000 });
}
