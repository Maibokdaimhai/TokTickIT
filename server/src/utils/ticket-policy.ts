import type { TicketStatus } from "@prisma/client";

export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"],
  CANCELLED: ["REOPENED"],
};

export const CONFIRMATION_STATUSES: readonly TicketStatus[] = [
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
  "REOPENED",
];

export const OWNER_REQUIRED_STATUSES: readonly TicketStatus[] = [
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
];

export function isValidStatusTransition(current: TicketStatus, next: TicketStatus): boolean {
  if (current === next) return false;
  const allowed = STATUS_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export function requiresConfirmation(status: TicketStatus): boolean {
  return CONFIRMATION_STATUSES.includes(status);
}

export function requiresEligibleOwner(status: TicketStatus): boolean {
  return OWNER_REQUIRED_STATUSES.includes(status);
}
