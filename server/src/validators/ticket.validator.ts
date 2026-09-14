import type { Prisma } from "@prisma/client";
import { Priority, TicketStatus } from "@prisma/client";
import { ApiError } from "../errors/api-error.js";
import { isValidIntegerId } from "./id.validator.js";

export function parseCreateTicket(body: Record<string, unknown>) {
  const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } = body;
  const validationDetails: string[] = [];
  // BR-11 Field Validation Constraints
  const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
  if (!trimmedSummary || trimmedSummary.length < 5 || trimmedSummary.length > 150) {
    validationDetails.push("Summary is required and must be between 5 and 150 characters.");
  }
  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  if (!trimmedDescription || trimmedDescription.length < 10 || trimmedDescription.length > 3000) {
    validationDetails.push("Description is required and must be between 10 and 3000 characters.");
  }
  const validPriorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT];
  if (!requestedPriority || !validPriorities.includes(requestedPriority as Priority)) {
    validationDetails.push("Requested Priority must be one of LOW, MEDIUM, HIGH, or URGENT.");
  }
  if (!isValidIntegerId(categoryId)) {
    validationDetails.push("Category ID must be a valid positive integer.");
  }
  if (!isValidIntegerId(relatedSystemId)) {
    validationDetails.push("Related System ID must be a valid positive integer.");
  }
  if (!isValidIntegerId(requesterId)) {
    validationDetails.push("Requester ID must be a valid positive integer.");
  }
  if (validationDetails.length > 0) {
    throw new ApiError(400, {
      code: "BAD_REQUEST",
      message: "Validation failed",
      details: validationDetails,
    });
  }
  const parsedCategoryId = Number(categoryId);
  const parsedRelatedSystemId = Number(relatedSystemId);
  const parsedRequesterId = Number(requesterId);
  return { parsedCategoryId, parsedRelatedSystemId, parsedRequesterId, trimmedSummary, trimmedDescription, requestedPriority: requestedPriority as Priority };
}

export function parseTicketFilters(query: Record<string, unknown>, requesterId: number) {
  const { search, category: categoryParam, priority, status, sort = "createdAt_desc", page: pageParam = "1", limit: limitParam = "10" } = query;
  // Validate page and limit
  if (!isValidIntegerId(pageParam)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "page parameter must be a valid positive integer" });
  }
  if (!isValidIntegerId(limitParam)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "limit parameter must be a valid positive integer" });
  }
  const page = Number(pageParam);
  const limit = Number(limitParam);
  if (limit > 50) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "limit parameter cannot exceed 50" });
  }
  // Validate sort
  const validSorts = ["createdAt_desc", "createdAt_asc", "ticketNumber_asc", "ticketNumber_desc"];
  if (typeof sort !== "string" || !validSorts.includes(sort)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: `sort parameter must be one of: ${validSorts.join(", ")}` });
  }
  // Build WHERE clause
  const where: Prisma.TicketWhereInput = {
    requesterId,
  };
  // Category filter
  if (categoryParam !== undefined && categoryParam !== "") {
    if (!isValidIntegerId(categoryParam)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: "category parameter must be a valid positive integer" });
    }
    where.categoryId = Number(categoryParam);
  }
  // Priority filter
  if (priority !== undefined && priority !== "") {
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (typeof priority !== "string" || !validPriorities.includes(priority)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: `priority parameter must be one of: ${validPriorities.join(", ")}` });
    }
    where.requestedPriority = priority as Priority;
  }
  // Status filter
  if (status !== undefined && status !== "") {
    const validStatuses = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    if (typeof status !== "string" || !validStatuses.includes(status)) {
      throw new ApiError(400, { code: "BAD_REQUEST", message: `status parameter must be one of: ${validStatuses.join(", ")}` });
    }
    where.status = status as TicketStatus;
  }
  // Search filter (summary or ticketNumber, case-insensitive)
  if (typeof search === "string" && search.trim().length > 0) {
    const trimmedSearch = search.trim();
    where.OR = [
      { summary: { contains: trimmedSearch, mode: "insensitive" } },
      { ticketNumber: { contains: trimmedSearch, mode: "insensitive" } },
    ];
  }
  // Sort order
  let orderBy: Prisma.TicketOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "createdAt_asc")
    orderBy = { createdAt: "asc" };
  else if (sort === "ticketNumber_asc")
    orderBy = { ticketNumber: "asc" };
  else if (sort === "ticketNumber_desc")
    orderBy = { ticketNumber: "desc" };
  return { page, limit, where, orderBy };
}
