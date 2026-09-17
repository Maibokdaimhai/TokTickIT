import type { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { parseStaffTicketFilters, validateEligibleOwnersQuery } from "../validators/staff.validator.js";

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
