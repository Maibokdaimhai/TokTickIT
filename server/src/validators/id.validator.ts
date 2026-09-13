import { ApiError } from "../errors/api-error.js";

export function isValidIntegerId(val: unknown): boolean {
  if (typeof val === "number") {
    return Number.isInteger(val) && val > 0;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    return /^[1-9]\d*$/.test(trimmed);
  }
  return false;
}

export function requireIntegerId(value: unknown, message: string): number {
  if (!isValidIntegerId(value)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message });
  }
  return Number(value);
}

export function parseTicketIdentity(ticketId: unknown, requesterId: unknown, source: "query" | "body" = "query") {
  return {
    ticketId: requireIntegerId(ticketId, "Ticket ID parameter must be a valid positive integer"),
    requesterId: requireIntegerId(requesterId, source === "query"
      ? "requesterId query parameter must be a valid positive integer"
      : "requesterId must be a valid positive integer"),
  };
}

export function parseAttachmentIdentity(ticketId: unknown, attachmentId: unknown, requesterId: unknown, source: "query" | "body" = "query") {
  return {
    ticketId: requireIntegerId(ticketId, "Ticket ID parameter must be a valid positive integer"),
    attachmentId: requireIntegerId(attachmentId, "Attachment ID parameter must be a valid positive integer"),
    requesterId: requireIntegerId(requesterId, source === "query"
      ? "requesterId query parameter must be a valid positive integer"
      : "requesterId must be a valid positive integer"),
  };
}
