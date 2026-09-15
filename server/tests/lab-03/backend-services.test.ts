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
