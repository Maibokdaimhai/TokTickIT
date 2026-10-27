import type { ActionStatus } from "@prisma/client";
import { ApiError } from "../errors/api-error.js";
import { isValidIntegerId, parseExpectedVersion } from "./id.validator.js";

export interface ActionFields {
  actionAt: Date; description: string; assigneeId: number; status: ActionStatus;
  result: string | null; followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
}
const fields = ["actionAt", "description", "assigneeId", "status", "result", "followUpRequired", "followUpNote", "attachmentNotes"];
function invalid(message: string): never {
  throw new ApiError(400, { code: "VALIDATION_ERROR", message });
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Request body must be an object");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !keys.includes(key))) invalid("Unexpected request field");
  return input;
}
function text(value: unknown, name: string, max: number, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) invalid(`${name} is required`);
    return null;
  }
  if (typeof value !== "string") invalid(`${name} must be text`);
  const normalized = value.trim();
  if (Array.from(normalized).length > max || (required && !normalized)) invalid(`${name} must contain ${required ? "1" : "0"}-${max} Unicode code points`);
  return normalized || null;
}
function date(value: unknown): Date {
  if (typeof value !== "string") invalid("actionAt must be an ISO date with an offset");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) invalid("actionAt must be an ISO date with an offset");
  const [, y, m, d, h, min, sec, , offset] = match;
  const local = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number(y) < 1 || !Number.isFinite(local.getTime()) || local.getUTCMonth() + 1 !== Number(m) || local.getUTCDate() !== Number(d) || Number(h) > 23 || Number(min) > 59 || Number(sec) > 59 ||
      (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))) invalid("actionAt is not a valid calendar date/time");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) invalid("actionAt is invalid");
  return parsed;
}
function parseFields(input: Record<string, unknown>, partial: boolean): Partial<ActionFields> {
  const result: Partial<ActionFields> = {};
  const has = (key: string) => !partial || Object.hasOwn(input, key);
  if (has("actionAt")) result.actionAt = date(input.actionAt);
  if (has("description")) result.description = text(input.description, "description", 2000, true)!;
  if (has("assigneeId")) {
    if (typeof input.assigneeId !== "number" || !isValidIntegerId(input.assigneeId)) invalid("assigneeId must be a positive integer");
    result.assigneeId = input.assigneeId;
  }
  if (has("status")) {
    if (typeof input.status !== "string" || !["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(input.status)) invalid("Invalid action status");
    result.status = input.status as ActionStatus;
  }
  if (has("followUpRequired")) {
    if (typeof input.followUpRequired !== "boolean") invalid("followUpRequired must be boolean");
    result.followUpRequired = input.followUpRequired;
  }
  for (const [key, max] of [["result", 2000], ["followUpNote", 2000], ["attachmentNotes", 1000]] as const) {
    if (has(key)) result[key] = text(input[key], key, max);
  }
  return result;
}
export function parseActionCreate(body: unknown) {
  const input = object(body, [...fields, "expectedTicketVersion", "clientRequestId"]);
  const parsed = parseFields(input, false) as ActionFields;
  if (!["PLANNED", "IN_PROGRESS"].includes(parsed.status)) invalid("New action status must be PLANNED or IN_PROGRESS");
  if (typeof input.clientRequestId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(input.clientRequestId)) invalid("clientRequestId must be a UUID");
  if (!parsed.followUpRequired) parsed.followUpNote = null;
  return { ...parsed, clientRequestId: input.clientRequestId.toLowerCase(), expectedTicketVersion: parseExpectedVersion(input.expectedTicketVersion) };
}
export function parseActionPatch(body: unknown) {
  const input = object(body, [...fields, "expectedTicketVersion", "expectedActionVersion"]);
  const patch = parseFields(input, true);
  if (!Object.keys(patch).length) invalid("At least one action field is required");
  return { patch, expectedTicketVersion: parseExpectedVersion(input.expectedTicketVersion), expectedActionVersion: parseExpectedVersion(input.expectedActionVersion) };
}
export function parseCompletion(body: unknown) {
  const input = object(body, ["expectedTicketVersion", "expectedActionVersion", "completionNote"]);
  return { completionNote: text(input.completionNote, "completionNote", 2000, true)!, expectedTicketVersion: parseExpectedVersion(input.expectedTicketVersion), expectedActionVersion: parseExpectedVersion(input.expectedActionVersion) };
}
export function validateActionState(state: ActionFields, ticketCreatedAt: Date, now: Date) {
  if (state.actionAt < ticketCreatedAt || state.actionAt > now) invalid("actionAt must be between Ticket creation and request receipt");
  if (state.followUpRequired && !state.followUpNote?.trim()) invalid("Follow-up note is required");
  if (["COMPLETED", "CANCELLED"].includes(state.status) && !state.result?.trim()) invalid("A result is required for completion or cancellation");
}
export function parseActionPage(query: Record<string, unknown>) {
  if (Object.keys(query).some(key => !["page", "limit"].includes(key))) throw new ApiError(400, { code: "BAD_REQUEST", message: "Invalid query parameters" });
  const page = query.page ?? "1", limit = query.limit ?? "10";
  if (typeof page !== "string" || !isValidIntegerId(page) || typeof limit !== "string" || !["10", "20", "50"].includes(limit)) throw new ApiError(400, { code: "BAD_REQUEST", message: "Invalid page or limit" });
  return { page: Number(page), limit: Number(limit) };
}
