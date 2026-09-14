import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { isValidIntegerId, parseTicketIdentity } from "../validators/id.validator.js";
import { generateTicketNumber } from "../utils/ticket-number.js";
import { parseCreateTicket, parseTicketFilters } from "../validators/ticket.validator.js";
import type { Priority } from "@prisma/client";
import { removeUploadedFile } from "../storage/attachments.js";

export async function createTicket(body: Record<string, unknown>) {
  const prisma = getPrisma();
  const { parsedCategoryId, parsedRelatedSystemId, parsedRequesterId, trimmedSummary, trimmedDescription, requestedPriority } = parseCreateTicket(body);

  // BR-13 Check if Requester exists and is ACTIVE
  const requester = await prisma.requesterUser.findUnique({
    where: { id: parsedRequesterId },
  });
  if (!requester || !requester.isActive) {
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "Requester account is inactive or not found",
    });
  }
  // Check if Category exists & is active
  const category = await prisma.category.findUnique({
    where: { id: parsedCategoryId },
  });
  if (!category || !category.isActive) {
    throw new ApiError(400, {
      code: "BAD_REQUEST",
      message: "Invalid or inactive Category selected",
    });
  }
  // Check if Related System exists & is active
  const relatedSystem = await prisma.relatedSystem.findUnique({
    where: { id: parsedRelatedSystemId },
  });
  if (!relatedSystem || !relatedSystem.isActive) {
    throw new ApiError(400, {
      code: "BAD_REQUEST",
      message: "Invalid or inactive Related System selected",
    });
  }
  // BR-01 Concurrency-safe Ticket Number generation with optimistic retry loop & transaction advisory lock
  let retries = 5;
  let ticket = null;
  while (retries > 0) {
    try {
      ticket = await prisma.$transaction(async (tx) => {
        try {
          // PostgreSQL transaction-level advisory lock serializes ticket number allocation under parallel load
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_number_generation'))`;
        } catch {
          // Fallback gracefully if mock DB doesn't support pg_advisory_xact_lock
        }
        const ticketNumber = await generateTicketNumber(tx);
        return await tx.ticket.create({
          data: {
            ticketNumber,
            requesterId: parsedRequesterId,
            categoryId: parsedCategoryId,
            relatedSystemId: parsedRelatedSystemId,
            summary: trimmedSummary,
            description: trimmedDescription,
            requestedPriority: requestedPriority as Priority,
            status: "NEW",
          },
          include: {
            requester: { select: { id: true, name: true, email: true, department: true } },
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
          },
        });
      });
      break;
    } catch (err: any) {
      if (err?.code === "P2002" &&
        (err?.meta?.target?.includes("ticketNumber") || String(err?.message).includes("ticketNumber"))) {
        retries--;
        if (retries === 0)
          throw err;
        // Jittered backoff before retrying ticket number allocation
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 + 10));
        continue;
      }
      throw err;
    }
  }
  return ticket;
}

export async function listTickets(query: Record<string, unknown>) {
  const prisma = getPrisma();
  const requesterIdParam = query.requesterId;
  if (!requesterIdParam) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "requesterId query parameter is required" });
  }
  if (!isValidIntegerId(requesterIdParam)) {
    throw new ApiError(400, { code: "BAD_REQUEST", message: "requesterId query parameter must be a valid positive integer" });
  }
  const requesterId = Number(requesterIdParam);
  // Verify requester existence and active status (BR-04, BR-05)
  const requester = await prisma.requesterUser.findUnique({
    where: { id: requesterId },
  });
  if (!requester || !requester.isActive) {
    throw new ApiError(403, { code: "FORBIDDEN", message: "Requester is invalid, missing, or inactive" });
  }
  const { page, limit, where, orderBy } = parseTicketFilters(query, requesterId);

  // Query total count and paginated records
  const [totalItems, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        ticketNumber: true,
        createdAt: true,
        summary: true,
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requestedPriority: true,
        itPriority: true,
        status: true,
        updatedAt: true,
        attachments: {
          where: { isRemoved: false },
          select: { id: true },
        },
      },
    }),
  ]);
  const formattedTickets = tickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    createdAt: t.createdAt.toISOString(),
    summary: t.summary,
    category: t.category,
    relatedSystem: t.relatedSystem,
    requestedPriority: t.requestedPriority,
    itPriority: t.itPriority,
    status: t.status,
    updatedAt: t.updatedAt.toISOString(),
    attachmentCount: t.attachments.length,
  }));
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return {
    tickets: formattedTickets,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getTicket(input: { ticketId: unknown }, query: Record<string, unknown>) {
  const prisma = getPrisma();
  const { ticketId, requesterId } = parseTicketIdentity(input.ticketId, query.requesterId);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      requester: {
        select: { id: true, name: true, email: true, department: true },
      },
      category: {
        select: { id: true, name: true },
      },
      relatedSystem: {
        select: { id: true, name: true },
      },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          ticketId: true,
          fileName: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          isRemoved: true,
          removalReason: true,
          removedAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!ticket) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  // BR-05 / AC-03 Requester ownership isolation check
  if (ticket.requesterId !== requesterId) {
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "Access denied: ticket is owned by another requester",
    });
  }
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    requesterId: ticket.requesterId,
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    summary: ticket.summary,
    description: ticket.description,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    attachments: ticket.attachments.map((att) => ({
      id: att.id,
      ticketId: att.ticketId,
      fileName: att.fileName,
      originalName: att.originalName,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      isRemoved: att.isRemoved,
      removalReason: att.removalReason,
      removedAt: att.removedAt ? att.removedAt.toISOString() : null,
      createdAt: att.createdAt.toISOString(),
    })),
  };
}

export async function rollbackTicket(input: { ticketId: unknown }, query: Record<string, unknown>) {
  const prisma = getPrisma();
  const { ticketId, requesterId } = parseTicketIdentity(input.ticketId, query.requesterId);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  // BR-05 Ownership isolation check
  if (ticket.requesterId !== requesterId) {
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "Access denied: ticket is owned by another requester",
    });
  }
  // Clean up physical files from disk under server/uploads/
  const attachments = await prisma.attachment.findMany({
    where: { ticketId },
    select: { filePath: true },
  });
  for (const att of attachments) {
    removeUploadedFile(att.filePath);
  }
  // Delete ticket record (cascades to delete attachment records in DB)
  await prisma.ticket.delete({
    where: { id: ticketId },
  });
  return {
    status: "ok",
    message: "Draft ticket rolled back successfully",
  };
}
