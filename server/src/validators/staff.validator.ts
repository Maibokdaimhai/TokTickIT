import type { Priority, TicketStatus } from "@prisma/client";
import { ApiError } from "../errors/api-error.js";
import { isValidIntegerId, parseExpectedVersion } from "./id.validator.js";

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const VALID_STATUSES = new Set([
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
]);
const VALID_SORTS = new Set([
  "updatedAt_desc",
  "createdAt_desc",
  "createdAt_asc",
  "ticketNumber_asc",
  "ticketNumber_desc",
  "itPriority_desc",
]);
const ALLOWED_LIMITS = new Set([10, 20, 50]);

export interface ParsedStaffTicketFilters {
  page: number;
  limit: number;
  search?: string;
  categoryId?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  status?: TicketStatus;
  owner?: { type: "unassigned" } | { type: "me"; userId: number } | { type: "userId"; userId: number };
  sort: string;
}

export function parseStaffTicketFilters(query: Record<string, unknown>, actorId: number): ParsedStaffTicketFilters {
  const permitted = new Set(["search", "category", "requestedPriority", "itPriority", "status", "owner", "sort", "page", "limit"]);

  if (Object.keys(query).some((key) => !permitted.has(key)) ||
      Object.values(query).some((val) => Array.isArray(val))) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "Invalid query parameters" });
  }

  const {
    search,
    category: categoryParam,
    requestedPriority: reqPriorityParam,
    itPriority: itPriorityParam,
    status: statusParam,
    owner: ownerParam,
    sort: sortParam = "updatedAt_desc",
    page: pageParam = "1",
    limit: limitParam = "10",
  } = query;

  // Validate page
  if (pageParam !== undefined && pageParam !== "") {
    if (!isValidIntegerId(pageParam)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "page parameter must be a valid positive integer" });
    }
  }
  const page = pageParam === "" || pageParam === undefined ? 1 : Number(pageParam);

  // Validate limit
  if (limitParam !== undefined && limitParam !== "") {
    if (!isValidIntegerId(limitParam) || !ALLOWED_LIMITS.has(Number(limitParam))) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "limit parameter must be one of: 10, 20, 50" });
    }
  }
  const limit = limitParam === "" || limitParam === undefined ? 10 : Number(limitParam);

  // Validate sort
  const sort = sortParam === "" || sortParam === undefined ? "updatedAt_desc" : String(sortParam);
  if (!VALID_SORTS.has(sort)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: `sort parameter must be one of: ${Array.from(VALID_SORTS).join(", ")}` });
  }

  const result: ParsedStaffTicketFilters = {
    page,
    limit,
    sort,
  };

  // Search filter
  if (search !== undefined && search !== "") {
    if (typeof search !== "string") {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "search parameter must be a string" });
    }
    const trimmed = search.trim();
    if (trimmed.length > 150) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "search parameter cannot exceed 150 characters" });
    }
    if (trimmed.length > 0) {
      result.search = trimmed;
    }
  }

  // Category filter
  if (categoryParam !== undefined && categoryParam !== "") {
    if (!isValidIntegerId(categoryParam)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "category parameter must be a valid positive integer" });
    }
    result.categoryId = Number(categoryParam);
  }

  // Requested priority filter
  if (reqPriorityParam !== undefined && reqPriorityParam !== "") {
    if (typeof reqPriorityParam !== "string" || !VALID_PRIORITIES.has(reqPriorityParam)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "requestedPriority parameter must be one of: LOW, MEDIUM, HIGH, URGENT" });
    }
    result.requestedPriority = reqPriorityParam as Priority;
  }

  // IT priority filter
  if (itPriorityParam !== undefined && itPriorityParam !== "") {
    if (typeof itPriorityParam !== "string" || !VALID_PRIORITIES.has(itPriorityParam)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "itPriority parameter must be one of: LOW, MEDIUM, HIGH, URGENT" });
    }
    result.itPriority = itPriorityParam as Priority;
  }

  // Status filter
  if (statusParam !== undefined && statusParam !== "") {
    if (typeof statusParam !== "string" || !VALID_STATUSES.has(statusParam)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: `status parameter must be one of: ${Array.from(VALID_STATUSES).join(", ")}` });
    }
    result.status = statusParam as TicketStatus;
  }

  // Owner filter
  if (ownerParam !== undefined && ownerParam !== "") {
    if (ownerParam === "unassigned") {
      result.owner = { type: "unassigned" };
    } else if (ownerParam === "me") {
      result.owner = { type: "me", userId: actorId };
    } else if (isValidIntegerId(ownerParam)) {
      result.owner = { type: "userId", userId: Number(ownerParam) };
    } else {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "owner parameter must be a positive integer ID, 'unassigned', or 'me'" });
    }
  }

  return result;
}

export function validateEligibleOwnersQuery(query: Record<string, unknown>) {
  if (Object.keys(query).length > 0) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "Invalid query parameters" });
  }
}

function ensureObjectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a non-empty object" });
  }
  return body as Record<string, unknown>;
}

export function parseClaimTicket(body: unknown): { expectedVersion: number } {
  const obj = ensureObjectBody(body);
  const keys = Object.keys(obj);
  if (keys.some((k) => k !== "expectedVersion") || !("expectedVersion" in obj)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request must only contain expectedVersion" });
  }
  return { expectedVersion: parseExpectedVersion(obj.expectedVersion) };
}

export function parseUpdateOwner(body: unknown): { ownerId: number | null; expectedVersion: number } {
  const obj = ensureObjectBody(body);
  const permitted = new Set(["ownerId", "expectedVersion"]);
  if (Object.keys(obj).some((k) => !permitted.has(k)) || !("ownerId" in obj) || !("expectedVersion" in obj)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "ownerId and expectedVersion are required" });
  }

  let ownerId: number | null;
  if (obj.ownerId === null) {
    ownerId = null;
  } else if (typeof obj.ownerId === "number" && Number.isSafeInteger(obj.ownerId) && obj.ownerId > 0 && obj.ownerId <= 2_147_483_647) {
    ownerId = obj.ownerId;
  } else {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "ownerId must be null or a positive integer within 1 and 2147483647",
    });
  }

  return {
    ownerId,
    expectedVersion: parseExpectedVersion(obj.expectedVersion),
  };
}

export function parseUpdateItPriority(body: unknown): { itPriority: Priority; expectedVersion: number } {
  const obj = ensureObjectBody(body);
  const permitted = new Set(["itPriority", "expectedVersion"]);
  if (Object.keys(obj).some((k) => !permitted.has(k)) || !("itPriority" in obj) || !("expectedVersion" in obj)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "itPriority and expectedVersion are required" });
  }

  if (typeof obj.itPriority !== "string" || !VALID_PRIORITIES.has(obj.itPriority)) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "itPriority must be one of: LOW, MEDIUM, HIGH, URGENT",
    });
  }

  return {
    itPriority: obj.itPriority as Priority,
    expectedVersion: parseExpectedVersion(obj.expectedVersion),
  };
}

export function parseUpdateStatus(body: unknown): {
  status: TicketStatus;
  expectedStatus: TicketStatus;
  expectedVersion: number;
  confirmed?: boolean;
} {
  const obj = ensureObjectBody(body);
  const permitted = new Set(["status", "expectedStatus", "expectedVersion", "confirmed"]);
  if (
    Object.keys(obj).some((k) => !permitted.has(k)) ||
    !("status" in obj) ||
    !("expectedStatus" in obj) ||
    !("expectedVersion" in obj)
  ) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: "status, expectedStatus, and expectedVersion are required",
    });
  }

  if (typeof obj.status !== "string" || !VALID_STATUSES.has(obj.status)) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: `status must be one of: ${Array.from(VALID_STATUSES).join(", ")}`,
    });
  }

  if (typeof obj.expectedStatus !== "string" || !VALID_STATUSES.has(obj.expectedStatus)) {
    throw new ApiError(400, {
      code: "VALIDATION_ERROR",
      message: `expectedStatus must be one of: ${Array.from(VALID_STATUSES).join(", ")}`,
    });
  }

  if ("confirmed" in obj && obj.confirmed !== undefined) {
    if (typeof obj.confirmed !== "boolean") {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "confirmed must be a boolean",
      });
    }
  }

  return {
    status: obj.status as TicketStatus,
    expectedStatus: obj.expectedStatus as TicketStatus,
    expectedVersion: parseExpectedVersion(obj.expectedVersion),
    confirmed: obj.confirmed as boolean | undefined,
  };
}
