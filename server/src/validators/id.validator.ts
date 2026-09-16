import { ApiError } from "../errors/api-error.js";

export function isValidIntegerId(val: unknown): boolean {
  if (typeof val === "number") {
    return Number.isSafeInteger(val) && val > 0 && val <= 2_147_483_647;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    return /^[1-9]\d*$/.test(trimmed) && BigInt(trimmed) <= 2_147_483_647n;
  }
  return false;
}

export function requireIntegerId(value: unknown, message: string): number {
  if (!isValidIntegerId(value)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message });
  }
  return Number(value);
}

export function parseTicketId(ticketId: unknown): number {
  return requireIntegerId(ticketId, "Ticket ID parameter must be a valid positive integer");
}

export function parseAttachmentIds(ticketId: unknown, attachmentId: unknown) {
  return {
    ticketId: parseTicketId(ticketId),
    attachmentId: requireIntegerId(attachmentId, "Attachment ID parameter must be a valid positive integer"),
  };
}
