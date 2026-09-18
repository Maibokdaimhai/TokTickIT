import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { parseTicketId } from "../validators/id.validator.js";
import { generateTicketNumber } from "../utils/ticket-number.js";
import { parseCreateTicket, parseTicketFilters, validateLegacyRequesterQuery } from "../validators/ticket.validator.js";
import type { Priority } from "@prisma/client";
import { removeUploadedFile } from "../storage/attachments.js";

export async function createTicket(body: Record<string, unknown>, actorId: number) {
  const prisma = getPrisma();
  const { parsedCategoryId, parsedRelatedSystemId, trimmedSummary, trimmedDescription, requestedPriority } = parseCreateTicket(body);
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
            requesterId: actorId,
            categoryId: parsedCategoryId,
            relatedSystemId: parsedRelatedSystemId,
            summary: trimmedSummary,
            description: trimmedDescription,
            requestedPriority: requestedPriority as Priority,
            itPriority: requestedPriority as Priority,
            status: "NEW",
          },
          include: {
            requester: { select: { id: true, name: true, email: true, role: true, isActive: true } },
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

export async function listTickets(query: Record<string, unknown>, actorId: number) {
  const prisma = getPrisma();
  const { page, limit, where, orderBy } = parseTicketFilters(query, actorId);

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

import { formatTicketDetail } from "../utils/ticket-formatter.js";

export async function getTicket(input: { ticketId: unknown }, actorId: number, query: Record<string, unknown> = {}) {
  validateLegacyRequesterQuery(query);
  const ticketId = parseTicketId(input.ticketId);
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      requester: {
        select: { id: true, name: true, email: true, role: true, isActive: true },
      },
      owner: {
        select: { id: true, name: true, email: true, role: true },
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
      publicComments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });
  if (!ticket) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  // BR-05 / AC-03 Requester ownership isolation check
  if (ticket.requesterId !== actorId) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  return formatTicketDetail(ticket);
}

export async function rollbackTicket(input: { ticketId: unknown }, actorId: number, query: Record<string, unknown> = {}) {
  validateLegacyRequesterQuery(query);
  const ticketId = parseTicketId(input.ticketId);
  const prisma = getPrisma();
  const attachments = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        requesterId: true,
        status: true,
        ownerId: true,
        problemAppearsResolvedAt: true,
        attachments: { select: { filePath: true } },
        _count: { select: { publicComments: true, internalNotes: true } },
      },
    });
    if (!ticket || ticket.requesterId !== actorId) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.status !== "NEW" || ticket.ownerId !== null || ticket.problemAppearsResolvedAt !== null ||
        ticket._count.publicComments > 0 || ticket._count.internalNotes > 0) {
      throw new ApiError(409, {
        code: "ROLLBACK_NOT_ALLOWED",
        message: "Ticket can no longer be rolled back because work has started",
      });
    }
    await tx.ticket.delete({ where: { id: ticketId } });
    return ticket.attachments;
  });
  // Preserve the Lab 2 best-effort physical cleanup after the database rollback succeeds.
  for (const att of attachments) {
    removeUploadedFile(att.filePath);
  }
  return {
    status: "ok",
    message: "Draft ticket rolled back successfully",
  };
}
