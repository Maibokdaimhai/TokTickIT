import type { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import {
  parseStaffTicketFilters,
  validateEligibleOwnersQuery,
  parseClaimTicket,
  parseUpdateOwner,
  parseUpdateItPriority,
  parseUpdateStatus,
} from "../validators/staff.validator.js";
import { parseTicketId } from "../validators/id.validator.js";
import { ApiError } from "../errors/api-error.js";
import { isValidStatusTransition, requiresConfirmation, requiresEligibleOwner } from "../utils/ticket-policy.js";
import { formatStaffTicketDetail } from "../utils/ticket-formatter.js";
import type { AuthenticatedActor } from "../types/auth.js";

const STAFF_TICKET_DETAIL_INCLUDE = {
  requester: { select: { id: true, name: true, email: true, role: true, isActive: true } },
  owner: { select: { id: true, name: true, email: true, role: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    orderBy: { createdAt: "asc" as const },
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
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  },
  internalNotes: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  },
};

function runInTransaction<T>(prisma: any, fn: (tx: any) => Promise<T>): Promise<T> {
  return typeof prisma.$transaction === "function"
    ? prisma.$transaction(fn)
    : fn(prisma);
}

export async function listStaffTickets(query: Record<string, unknown>, actorId: number) {
  const prisma = getPrisma();
  const filters = parseStaffTicketFilters(query, actorId);

  const where: Prisma.TicketWhereInput = {};

  if (filters.categoryId !== undefined) {
    where.categoryId = filters.categoryId;
  }
  if (filters.requestedPriority !== undefined) {
    where.requestedPriority = filters.requestedPriority;
  }
  if (filters.itPriority !== undefined) {
    where.itPriority = filters.itPriority;
  }
  if (filters.status !== undefined) {
    where.status = filters.status;
  }
  if (filters.owner !== undefined) {
    if (filters.owner.type === "unassigned") {
      where.ownerId = null;
    } else {
      where.ownerId = filters.owner.userId;
    }
  }
  if (filters.search !== undefined) {
    where.OR = [
      { summary: { contains: filters.search, mode: "insensitive" } },
      { ticketNumber: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  let orderBy: Prisma.TicketOrderByWithRelationInput[];
  switch (filters.sort) {
    case "itPriority_desc":
      // In PostgreSQL, Priority enum order (LOW < MEDIUM < HIGH < URGENT) means
      // DESC orders URGENT -> HIGH -> MEDIUM -> LOW, then updatedAt DESC, id ASC.
      orderBy = [{ itPriority: "desc" }, { updatedAt: "desc" }, { id: "asc" }];
      break;
    case "createdAt_desc":
      orderBy = [{ createdAt: "desc" }, { id: "asc" }];
      break;
    case "createdAt_asc":
      orderBy = [{ createdAt: "asc" }, { id: "asc" }];
      break;
    case "ticketNumber_asc":
      orderBy = [{ ticketNumber: "asc" }, { id: "asc" }];
      break;
    case "ticketNumber_desc":
      orderBy = [{ ticketNumber: "desc" }, { id: "asc" }];
      break;
    case "updatedAt_desc":
    default:
      orderBy = [{ updatedAt: "desc" }, { id: "asc" }];
      break;
  }

  const [totalItems, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        ticketNumber: true,
        createdAt: true,
        updatedAt: true,
        summary: true,
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        requestedPriority: true,
        itPriority: true,
        status: true,
        version: true,
        owner: {
          select: { id: true, name: true, email: true, role: true },
        },
        attachments: {
          where: { isRemoved: false },
          select: { id: true },
        },
        _count: {
          select: { publicComments: true },
        },
      },
    }),
  ]);

  const formattedTickets = tickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    summary: t.summary,
    category: t.category,
    relatedSystem: t.relatedSystem,
    requestedPriority: t.requestedPriority,
    itPriority: t.itPriority,
    status: t.status,
    owner: t.owner
      ? {
          id: t.owner.id,
          name: t.owner.name,
          email: t.owner.email,
          role: t.owner.role as "IT_STAFF" | "ADMINISTRATOR",
        }
      : null,
    version: t.version,
    attachmentCount: t.attachments.length,
    publicCommentCount: t._count.publicComments,
  }));

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / filters.limit);

  return {
    tickets: formattedTickets,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getEligibleOwners(query: Record<string, unknown> = {}) {
  validateEligibleOwnersQuery(query);
  const prisma = getPrisma();
  const owners = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  // Deterministic case-insensitive name sorting, with ID as tie-breaker
  owners.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id);

  return {
    owners: owners.map((o) => ({
      id: o.id,
      name: o.name,
      email: o.email,
      role: o.role as "IT_STAFF" | "ADMINISTRATOR",
    })),
  };
}

export async function getStaffTicketDetail(ticketIdParam: unknown, _actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: STAFF_TICKET_DETAIL_INCLUDE,
  });
  if (!ticket) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  return formatStaffTicketDetail(ticket);
}

export async function claimTicket(ticketIdParam: unknown, body: unknown, actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { expectedVersion } = parseClaimTicket(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        version: true,
        ownerId: true,
        status: true,
      },
    });
    if (!ticket) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, { code: "VERSION_CONFLICT", message: "Ticket version mismatch" });
    }
    if (ticket.ownerId !== null) {
      throw new ApiError(409, { code: "ALREADY_ASSIGNED", message: "Ticket is already assigned to an owner" });
    }

    const newStatus = ticket.status === "NEW" ? "OPEN" : ticket.status;

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ownerId: actor.id,
        status: newStatus,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: STAFF_TICKET_DETAIL_INCLUDE,
    });

    return {
      ticket: formatStaffTicketDetail(updated),
    };
  });
}

export async function updateOwner(ticketIdParam: unknown, body: unknown, _actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { ownerId, expectedVersion } = parseUpdateOwner(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, version: true, status: true },
    });
    if (!ticket) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, { code: "VERSION_CONFLICT", message: "Ticket version mismatch" });
    }

    if (ownerId !== null) {
      const targetUser = await tx.user.findUnique({
        where: { id: ownerId },
        select: { id: true, isActive: true, role: true },
      });
      if (!targetUser || !targetUser.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(targetUser.role)) {
        throw new ApiError(400, { code: "INVALID_OWNER", message: "Target owner must be an active IT Staff or Administrator" });
      }
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ownerId,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: STAFF_TICKET_DETAIL_INCLUDE,
    });

    return {
      ticket: formatStaffTicketDetail(updated),
    };
  });
}

export async function updateItPriority(ticketIdParam: unknown, body: unknown, _actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { itPriority, expectedVersion } = parseUpdateItPriority(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, version: true },
    });
    if (!ticket) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, { code: "VERSION_CONFLICT", message: "Ticket version mismatch" });
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        itPriority,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: STAFF_TICKET_DETAIL_INCLUDE,
    });

    return {
      ticket: formatStaffTicketDetail(updated),
    };
  });
}

export async function updateStatus(ticketIdParam: unknown, body: unknown, _actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { status: targetStatus, expectedStatus, expectedVersion, confirmed } = parseUpdateStatus(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, version: true, ownerId: true },
    });
    if (!ticket) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.status !== expectedStatus) {
      throw new ApiError(409, { code: "STATUS_CONFLICT", message: "Ticket status has changed" });
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, { code: "VERSION_CONFLICT", message: "Ticket version mismatch" });
    }

    if (!isValidStatusTransition(ticket.status, targetStatus)) {
      throw new ApiError(400, {
        code: "INVALID_STATUS_TRANSITION",
        message: `Cannot transition status from ${ticket.status} to ${targetStatus}`,
      });
    }

    if (requiresConfirmation(targetStatus) && confirmed !== true) {
      throw new ApiError(400, {
        code: "CONFIRMATION_REQUIRED",
        message: `Transition to ${targetStatus} requires confirmation`,
      });
    }

    if (requiresEligibleOwner(targetStatus)) {
      if (ticket.ownerId === null) {
        throw new ApiError(400, {
          code: "OWNER_REQUIRED",
          message: `Transition to ${targetStatus} requires an assigned owner`,
        });
      }
      const currentOwner = await tx.user.findUnique({
        where: { id: ticket.ownerId },
        select: { id: true, isActive: true, role: true },
      });
      if (!currentOwner || !currentOwner.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(currentOwner.role)) {
        throw new ApiError(400, {
          code: "OWNER_REQUIRED",
          message: `Transition to ${targetStatus} requires an active eligible owner`,
        });
      }
    }

    const data: any = {
      status: targetStatus,
      version: { increment: 1 },
      updatedAt: new Date(),
    };
    if (targetStatus === "REOPENED") {
      data.problemAppearsResolvedAt = null;
      data.problemAppearsResolvedById = null;
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data,
      include: STAFF_TICKET_DETAIL_INCLUDE,
    });

    return {
      ticket: formatStaffTicketDetail(updated),
    };
  });
}
