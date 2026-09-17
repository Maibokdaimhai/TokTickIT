import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/errors/api-error.js";
import { parseCreateTicket, parseTicketFilters } from "../../src/validators/ticket.validator.js";
import { parseAttachmentIds } from "../../src/validators/id.validator.js";
import { listTickets } from "../../src/services/ticket.service.js";
import { uploadAttachment } from "../../src/services/attachment.service.js";
import * as database from "../../src/prisma.js";
import * as storage from "../../src/storage/attachments.js";

afterEach(() => vi.restoreAllMocks());

describe("Issue #26: validators independent of HTTP and database", () => {
  it("normalizes valid creation input without changing requested priority", () => {
    expect(parseCreateTicket({
      requesterId: "1", categoryId: 2, relatedSystemId: "3",
      summary: "  Printer failure  ", description: "  Printer fails to print documents.  ", requestedPriority: "HIGH",
    })).toEqual({
      parsedCategoryId: 2, parsedRelatedSystemId: 3,
      trimmedSummary: "Printer failure", trimmedDescription: "Printer fails to print documents.", requestedPriority: "HIGH",
    });
  });

  it("preserves all five creation errors and their order", () => {
    try {
      parseCreateTicket({});
      expect.fail("Invalid input must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).error.details).toEqual([
        "Summary is required and must be between 5 and 150 characters.",
        "Description is required and must be between 10 and 3000 characters.",
        "Requested Priority must be one of LOW, MEDIUM, HIGH, or URGENT.",
        "Category ID must be a valid positive integer.",
        "Related System ID must be a valid positive integer.",
      ]);
    }
  });

  it("combines requester scope, filters, search, sort and pagination", () => {
    const parsed = parseTicketFilters({
      category: "2", priority: "HIGH", status: "NEW",
      search: "  WIFI  ", sort: "ticketNumber_asc", page: "2", limit: "20"
    }, 7);
    expect(parsed).toEqual({
      page: 2, limit: 20, orderBy: { ticketNumber: "asc" }, where: {
        requesterId: 7, categoryId: 2, requestedPriority: "HIGH", status: "NEW",
        OR: [{ summary: { contains: "WIFI", mode: "insensitive" } }, { ticketNumber: { contains: "WIFI", mode: "insensitive" } }],
      }
    });
  });

  it.each(["1.5", "-1", "2147483648", ["1", "2"]])("rejects invalid attachment ID %s before requester validation", (value) => {
      expect(() => parseAttachmentIds("1", value)).toThrow("Attachment ID parameter must be a valid positive integer");
  });
});

describe("Issue #26: service boundaries", () => {
  it("derives requester scope from the authenticated actor while ignoring a forged legacy ID", async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    vi.spyOn(database, "getPrisma").mockReturnValue({ ticket: { count, findMany } } as unknown as ReturnType<typeof database.getPrisma>);
    await listTickets({ requesterId: "999" }, 7);
    expect(count).toHaveBeenCalledWith({ where: { requesterId: 7 } });
  });

  it("removes an uploaded file when database persistence fails", async () => {
    const failure = new Error("database write failed");
    const prisma = {
      ticket: { findUnique: vi.fn().mockResolvedValue({ requesterId: 1 }) },
      attachment: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockRejectedValue(failure) },
    };
    vi.spyOn(database, "getPrisma").mockReturnValue(prisma as unknown as ReturnType<typeof database.getPrisma>);
    const cleanup = vi.spyOn(storage, "removeUploadedFile").mockImplementation(() => { });
    const file = { path: "/test-only/upload.pdf", filename: "upload.pdf", originalname: "report.pdf", mimetype: "application/pdf", size: 20 };
    await expect(uploadAttachment({ ticketId: "1" }, {}, 1, file)).rejects.toBe(failure);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledWith(file.path);
  });

  it("cleans invalid uploads before any ticket lookup", async () => {
    const findUnique = vi.fn();
    vi.spyOn(database, "getPrisma").mockReturnValue({ ticket: { findUnique } } as unknown as ReturnType<typeof database.getPrisma>);
    const cleanup = vi.spyOn(storage, "removeUploadedFile").mockImplementation(() => { });
    const file = { path: "/test-only/upload.exe", filename: "upload.exe", originalname: "program.exe", mimetype: "application/octet-stream", size: 20 };
    await expect(uploadAttachment({ ticketId: "1" }, {}, 1, file)).rejects.toMatchObject({ status: 400 });
    expect(findUnique).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledWith(file.path);
  });
});

import { parseExpectedVersion } from "../../src/validators/id.validator.js";
import {
  parseClaimTicket,
  parseUpdateOwner,
  parseUpdateItPriority,
  parseUpdateStatus,
} from "../../src/validators/staff.validator.js";
import {
  parseCreateCommunication,
  parseProblemAppearsResolved,
} from "../../src/validators/communication.validator.js";

describe("UNIT-04: Issue #30 staff and communication validators", () => {
  it("validates expectedVersion allowing 0 and safe integers, rejecting strings and invalid values", () => {
    expect(parseExpectedVersion(0)).toBe(0);
    expect(parseExpectedVersion(42)).toBe(42);
    expect(parseExpectedVersion(2_147_483_647)).toBe(2_147_483_647);

    expect(() => parseExpectedVersion("0")).toThrow();
    expect(() => parseExpectedVersion("42")).toThrow();
    expect(() => parseExpectedVersion(-1)).toThrow();
    expect(() => parseExpectedVersion(1.5)).toThrow();
    expect(() => parseExpectedVersion(2_147_483_648)).toThrow();
    expect(() => parseExpectedVersion(null)).toThrow();
    expect(() => parseExpectedVersion(undefined)).toThrow();
  });

  it("validates claim ticket payload strictly", () => {
    expect(parseClaimTicket({ expectedVersion: 0 })).toEqual({ expectedVersion: 0 });
    expect(() => parseClaimTicket({})).toThrow();
    expect(() => parseClaimTicket({ expectedVersion: "0" })).toThrow();
    expect(() => parseClaimTicket({ expectedVersion: 1, extra: true })).toThrow();
    expect(() => parseClaimTicket(null)).toThrow();
  });

  it("validates update owner payload strictly (null or positive integer)", () => {
    expect(parseUpdateOwner({ ownerId: null, expectedVersion: 0 })).toEqual({ ownerId: null, expectedVersion: 0 });
    expect(parseUpdateOwner({ ownerId: 7, expectedVersion: 1 })).toEqual({ ownerId: 7, expectedVersion: 1 });

    expect(() => parseUpdateOwner({ ownerId: "7", expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateOwner({ ownerId: 0, expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateOwner({ ownerId: -5, expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateOwner({ ownerId: 1.5, expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateOwner({ ownerId: 2_147_483_648, expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateOwner({ expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateOwner({ ownerId: 7 })).toThrow();
    expect(() => parseUpdateOwner({ ownerId: 7, expectedVersion: 1, extra: "unknown" })).toThrow();
  });

  it("validates update IT priority strictly", () => {
    expect(parseUpdateItPriority({ itPriority: "HIGH", expectedVersion: 2 })).toEqual({ itPriority: "HIGH", expectedVersion: 2 });
    expect(() => parseUpdateItPriority({ itPriority: "INVALID", expectedVersion: 2 })).toThrow();
    expect(() => parseUpdateItPriority({ itPriority: "HIGH" })).toThrow();
    expect(() => parseUpdateItPriority({ expectedVersion: 2 })).toThrow();
    expect(() => parseUpdateItPriority({ itPriority: "HIGH", expectedVersion: 2, other: 1 })).toThrow();
  });

  it("validates update status strictly including boolean confirmed check", () => {
    expect(parseUpdateStatus({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 3, confirmed: true })).toEqual({
      status: "RESOLVED",
      expectedStatus: "OPEN",
      expectedVersion: 3,
      confirmed: true,
    });
    expect(parseUpdateStatus({ status: "OPEN", expectedStatus: "NEW", expectedVersion: 0 })).toEqual({
      status: "OPEN",
      expectedStatus: "NEW",
      expectedVersion: 0,
      confirmed: undefined,
    });

    // confirmed must be boolean when supplied, not string
    expect(() => parseUpdateStatus({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: "true" })).toThrow();
    expect(() => parseUpdateStatus({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: 1 })).toThrow();

    // missing required fields
    expect(() => parseUpdateStatus({ expectedStatus: "OPEN", expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateStatus({ status: "RESOLVED", expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateStatus({ status: "RESOLVED", expectedStatus: "OPEN" })).toThrow();

    // invalid enum values
    expect(() => parseUpdateStatus({ status: "BOGUS", expectedStatus: "OPEN", expectedVersion: 1 })).toThrow();
    expect(() => parseUpdateStatus({ status: "OPEN", expectedStatus: "BOGUS", expectedVersion: 1 })).toThrow();

    // unknown fields rejected
    expect(() => parseUpdateStatus({ status: "OPEN", expectedStatus: "NEW", expectedVersion: 1, unexpected: "field" })).toThrow();
  });

  it("validates communication content (1-2000 Unicode code points, rejects whitespace and forged fields)", () => {
    expect(parseCreateCommunication({ content: "Single character: a" })).toEqual({ content: "Single character: a" });
    expect(parseCreateCommunication({ content: "x" })).toEqual({ content: "x" });

    const exactly2000 = "ก".repeat(2000);
    expect(parseCreateCommunication({ content: exactly2000 })).toEqual({ content: exactly2000 });

    // 2001 chars
    expect(() => parseCreateCommunication({ content: "a".repeat(2001) })).toThrow();

    // whitespace-only
    expect(() => parseCreateCommunication({ content: "   \n\t  " })).toThrow();
    expect(() => parseCreateCommunication({ content: "" })).toThrow();

    // forged fields
    expect(() => parseCreateCommunication({ content: "Hello", author: "Hacker" })).toThrow();
    expect(() => parseCreateCommunication({ content: "Hello", authorId: 999 })).toThrow();
    expect(() => parseCreateCommunication({ content: "Hello", createdAt: new Date().toISOString() })).toThrow();
    expect(() => parseCreateCommunication({ content: "Hello", seedKey: "key" })).toThrow();
    expect(() => parseCreateCommunication({})).toThrow();
  });

  it("validates problem appears resolved payload", () => {
    expect(parseProblemAppearsResolved({ expectedVersion: 0 })).toEqual({ expectedVersion: 0, comment: undefined });
    expect(parseProblemAppearsResolved({ expectedVersion: 3, comment: "Looks fixed!" })).toEqual({
      expectedVersion: 3,
      comment: "Looks fixed!",
    });

    // whitespace-only comment rejected
    expect(() => parseProblemAppearsResolved({ expectedVersion: 1, comment: "   " })).toThrow();

    // >2000 code points comment rejected
    expect(() => parseProblemAppearsResolved({ expectedVersion: 1, comment: "b".repeat(2001) })).toThrow();

    // missing expectedVersion
    expect(() => parseProblemAppearsResolved({})).toThrow();
    expect(() => parseProblemAppearsResolved({ comment: "Fixed" })).toThrow();

    // unknown fields rejected
    expect(() => parseProblemAppearsResolved({ expectedVersion: 1, extra: 123 })).toThrow();
  });
});
