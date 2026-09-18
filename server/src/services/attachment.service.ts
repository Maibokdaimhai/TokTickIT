import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { parseTicketId, parseAttachmentIds } from "../validators/id.validator.js";
import fs from "fs";
import { validateUpload, parseRemovalReason, validateUploadBody } from "../validators/attachment.validator.js";
import path from "path";
import { decodeFilename } from "../utils/filename.js";
import { removeUploadedFile, type UploadedFile } from "../storage/attachments.js";
import type { AuthenticatedActor } from "../types/auth.js";
import { validateLegacyRequesterQuery } from "../validators/ticket.validator.js";

const attachmentResourceNotFound = () => new ApiError(404, {
  code: "NOT_FOUND",
  message: "Attachment not found",
});

function assertCanRead(requesterId: number, actor: AuthenticatedActor) {
  if (actor.role === "REQUESTER" && requesterId !== actor.id) {
    throw attachmentResourceNotFound();
  }
}

function assertOwnTicket(requesterId: number, actorId: number) {
  if (requesterId !== actorId) {
    throw attachmentResourceNotFound();
  }
}

function formatAttachmentMetadata(attachment: {
  id: number;
  ticketId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  isRemoved: boolean;
  removalReason: string | null;
  removedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    fileName: attachment.fileName,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    isRemoved: attachment.isRemoved,
    removalReason: attachment.removalReason,
    removedAt: attachment.removedAt ? attachment.removedAt.toISOString() : null,
    createdAt: attachment.createdAt.toISOString(),
    downloadUrl: attachment.isRemoved ? null : `/api/tickets/${attachment.ticketId}/attachments/${attachment.id}`,
  };
}

export async function uploadAttachment(input: { ticketId: unknown }, body: Record<string, unknown>, actorId: number, file: UploadedFile | undefined) {
  try {
    const prisma = getPrisma();
    const ticketId = parseTicketId(input.ticketId);
    validateUploadBody(body);
    validateUpload(file);

    const runInTx = typeof prisma.$transaction === "function"
      ? (fn: (tx: any) => Promise<any>) => prisma.$transaction(fn)
      : (fn: (tx: any) => Promise<any>) => fn(prisma);

    return await runInTx(async (tx) => {
      // Row-level lock coordination (BR-24, BR-29)
      if (typeof tx.$executeRaw === "function") {
        await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
      }

      // Check Ticket Existence
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket) {
        throw attachmentResourceNotFound();
      }
      // BR-05 Ownership isolation check
      assertOwnTicket(ticket.requesterId, actorId);
      // BR-08 Enforce max 5 active attachments limit
      const activeCount = await tx.attachment.count({
        where: { ticketId, isRemoved: false },
      });
      if (activeCount >= 5) {
        throw new ApiError(400, {
          code: "ATTACHMENT_LIMIT_EXCEEDED",
          message: "Ticket already has the maximum of 5 active attachments",
        });
      }
      // Save attachment in database
      const attachment = await tx.attachment.create({
        data: {
          ticketId,
          fileName: file.filename,
          originalName: path.basename(decodeFilename(file.originalname)),
          mimeType: file.mimetype,
          fileSize: file.size,
          filePath: file.path,
        },
      });

      // Increment ticket version and update updatedAt (BR-29)
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return formatAttachmentMetadata(attachment);
    });
  } catch (error) {
    removeUploadedFile(file?.path);
    throw error;
  }
}

export async function downloadAttachment(input: { ticketId: unknown; attachmentId: unknown }, actor: AuthenticatedActor, query: Record<string, unknown> = {}) {
  validateLegacyRequesterQuery(query);
  const { ticketId, attachmentId } = parseAttachmentIds(input.ticketId, input.attachmentId);
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw attachmentResourceNotFound();
  }
  // BR-05 Ownership isolation check
  assertCanRead(ticket.requesterId, actor);
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw attachmentResourceNotFound();
  }
  // BR-09 / AC-07 Block download of soft-removed attachments with ATTACHMENT_REMOVED code
  if (attachment.isRemoved) {
    throw new ApiError(403, {
      code: "ATTACHMENT_REMOVED",
      message: "Cannot download a removed attachment",
    });
  }
  if (!attachment.filePath || !fs.existsSync(attachment.filePath)) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "File not found on storage" });
  }
  return { mimeType: attachment.mimeType, originalName: attachment.originalName, filePath: attachment.filePath };
}

export async function getAttachmentMetadata(input: { ticketId: unknown; attachmentId: unknown }, actor: AuthenticatedActor, query: Record<string, unknown> = {}) {
  validateLegacyRequesterQuery(query);
  const { ticketId, attachmentId } = parseAttachmentIds(input.ticketId, input.attachmentId);
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw attachmentResourceNotFound();
  }
  assertCanRead(ticket.requesterId, actor);
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw attachmentResourceNotFound();
  }
  return formatAttachmentMetadata(attachment);
}

export async function removeAttachment(input: { ticketId: unknown; attachmentId: unknown }, body: Record<string, unknown>, actorId: number) {
  const prisma = getPrisma();
  const { ticketId, attachmentId } = parseAttachmentIds(input.ticketId, input.attachmentId);
  const trimmedReason = parseRemovalReason(body);

  const runInTx = typeof prisma.$transaction === "function"
    ? (fn: (tx: any) => Promise<any>) => prisma.$transaction(fn)
    : (fn: (tx: any) => Promise<any>) => fn(prisma);

  return await runInTx(async (tx) => {
    // Row-level lock coordination (BR-24, BR-29)
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw attachmentResourceNotFound();
    }
    // BR-05 Ownership isolation
    assertOwnTicket(ticket.requesterId, actorId);
    const attachment = await tx.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) {
      throw attachmentResourceNotFound();
    }
    if (attachment.isRemoved) {
      throw new ApiError(400, {
        code: "BAD_REQUEST",
        message: "Attachment is already removed",
      });
    }
    const updated = await tx.attachment.update({
      where: { id: attachmentId },
      data: {
        isRemoved: true,
        removalReason: trimmedReason,
        removedAt: new Date(),
      },
    });

    // Increment ticket version and update updatedAt (BR-29)
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return formatAttachmentMetadata(updated);
  });
}
