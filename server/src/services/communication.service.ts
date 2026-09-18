import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { parseTicketId } from "../validators/id.validator.js";
import { parseCreateCommunication, parseProblemAppearsResolved } from "../validators/communication.validator.js";
import type { AuthenticatedActor } from "../types/auth.js";
import { formatCommunicationEntry, formatTicketDetail } from "../utils/ticket-formatter.js";
import type { TicketStatus } from "@prisma/client";

const notFoundError = () => new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });

function runInTransaction<T>(prisma: any, fn: (tx: any) => Promise<T>): Promise<T> {
  return typeof prisma.$transaction === "function"
    ? prisma.$transaction(fn)
    : fn(prisma);
}

export async function listPublicComments(ticketIdParam: unknown, actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const prisma = getPrisma();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });
  if (!ticket) {
    throw notFoundError();
  }
  if (actor.role === "REQUESTER" && ticket.requesterId !== actor.id) {
    throw notFoundError();
  }

  const comments = await prisma.publicComment.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      author: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  return {
    comments: comments.map(formatCommunicationEntry),
  };
}

export async function createPublicComment(ticketIdParam: unknown, body: unknown, actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { content } = parseCreateCommunication(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true },
    });
    if (!ticket) {
      throw notFoundError();
    }
    if (actor.role === "REQUESTER" && ticket.requesterId !== actor.id) {
      throw notFoundError();
    }

    const comment = await tx.publicComment.create({
      data: {
        ticketId,
        authorId: actor.id,
        content,
      },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return {
      comment: formatCommunicationEntry(comment),
    };
  });
}

export async function listInternalNotes(ticketIdParam: unknown, _actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const prisma = getPrisma();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) {
    throw notFoundError();
  }

  const notes = await prisma.internalNote.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      author: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  return {
    notes: notes.map(formatCommunicationEntry),
  };
}

export async function createInternalNote(ticketIdParam: unknown, body: unknown, actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { content } = parseCreateCommunication(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      throw notFoundError();
    }

    const note = await tx.internalNote.create({
      data: {
        ticketId,
        authorId: actor.id,
        content,
      },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return {
      note: formatCommunicationEntry(note),
    };
  });
}

const TERMINAL_STATUSES: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];

export async function indicateProblemAppearsResolved(ticketIdParam: unknown, body: unknown, actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { expectedVersion, comment } = parseProblemAppearsResolved(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        requesterId: true,
        version: true,
        status: true,
        problemAppearsResolvedAt: true,
      },
    });
    if (!ticket) {
      throw notFoundError();
    }
    if (ticket.requesterId !== actor.id) {
      throw notFoundError();
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, {
        code: "VERSION_CONFLICT",
        message: "Ticket version mismatch",
      });
    }
    if (TERMINAL_STATUSES.includes(ticket.status)) {
      throw new ApiError(409, {
        code: "INVALID_STATUS_TRANSITION",
        message: "Cannot indicate problem resolved on a terminal ticket",
      });
    }
    if (ticket.problemAppearsResolvedAt !== null) {
      throw new ApiError(409, {
        code: "ALREADY_INDICATED",
        message: "Problem has already been indicated as resolved",
      });
    }

    const now = new Date();
    if (comment) {
      await tx.publicComment.create({
        data: {
          ticketId,
          authorId: actor.id,
          content: comment,
          createdAt: now,
        },
      });
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        problemAppearsResolvedAt: now,
        problemAppearsResolvedById: actor.id,
        version: { increment: 1 },
        updatedAt: now,
      },
      include: {
        requester: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        owner: { select: { id: true, name: true, email: true, role: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
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

    return {
      ticket: formatTicketDetail(updated),
    };
  });
}
