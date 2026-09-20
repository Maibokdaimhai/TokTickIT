import { describe, expect, it } from "vitest";
import {
  isValidStatusTransition,
  requiresConfirmation,
  requiresEligibleOwner,
  STATUS_TRANSITIONS,
  CONFIRMATION_STATUSES,
  OWNER_REQUIRED_STATUSES,
} from "../../src/utils/ticket-policy.js";
import type { TicketStatus } from "@prisma/client";

describe("UNIT-03: Ticket Policy & Status Transition Matrix", () => {
  const allStatuses: TicketStatus[] = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
    "CANCELLED",
  ];

  const allowedMap: Record<TicketStatus, TicketStatus[]> = {
    NEW: ["OPEN", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    CLOSED: ["REOPENED"],
    CANCELLED: ["REOPENED"],
  };

  it("permits exact valid transitions and rejects all invalid/no-op transitions", () => {
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        const expectedValid = allowedMap[from].includes(to);
        expect(isValidStatusTransition(from, to)).toBe(expectedValid);
      }
    }
  });

  it("rejects same-status (no-op) transitions", () => {
    for (const status of allStatuses) {
      expect(isValidStatusTransition(status, status)).toBe(false);
    }
  });

  it("identifies statuses requiring confirmation", () => {
    const confirmationRequired: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"];
    for (const status of allStatuses) {
      expect(requiresConfirmation(status)).toBe(confirmationRequired.includes(status));
    }
  });

  it("identifies statuses requiring an eligible owner", () => {
    const ownerRequired: TicketStatus[] = ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED"];
    for (const status of allStatuses) {
      expect(requiresEligibleOwner(status)).toBe(ownerRequired.includes(status));
    }
  });

  it("exports constants matching the transition definitions", () => {
    expect(STATUS_TRANSITIONS).toBeDefined();
    expect(CONFIRMATION_STATUSES).toEqual(["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"]);
    expect(OWNER_REQUIRED_STATUSES).toEqual(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED"]);
  });
});
