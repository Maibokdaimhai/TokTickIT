import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { parseTicketIdentity, parseAttachmentIdentity } from "../validators/id.validator.js";
import fs from "fs";
import { validateUpload, parseRemovalReason } from "../validators/attachment.validator.js";
import path from "path";
import { decodeFilename } from "../utils/filename.js";
import { removeUploadedFile, type UploadedFile } from "../storage/attachments.js";

export async function uploadAttachment(input: { ticketId: unknown }, body: Record<string, unknown>, file: UploadedFile | undefined) {
  try {
    const prisma = getPrisma();
    const { ticketId, requesterId } = parseTicketIdentity(input.ticketId, body.requesterId, "body");
    validateUpload(file);
    // Check Ticket Existence
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
    // BR-08 Enforce max 5 active attachments limit
    const activeCount = await prisma.attachment.count({
      where: { ticketId, isRemoved: false },
    });
    if (activeCount >= 5) {
      throw new ApiError(400, {
        code: "ATTACHMENT_LIMIT_EXCEEDED",
        message: "Ticket already has the maximum of 5 active attachments",
      });
    }
    // Save attachment in database
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        fileName: file.filename,
        originalName: path.basename(decodeFilename(file.originalname)),
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
      },
    });
    return attachment;
  } catch (error) {
    removeUploadedFile(file?.path);
    throw error;
  }
}

export async function downloadAttachment(input: { ticketId: unknown; attachmentId: unknown }, query: Record<string, unknown>) {
  const prisma = getPrisma();
  const { ticketId, attachmentId, requesterId } = parseAttachmentIdentity(input.ticketId, input.attachmentId, query.requesterId);
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
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Attachment not found" });
  }
  // BR-09 / AC-07 Block download of soft-removed attachments
  if (attachment.isRemoved) {
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "Cannot download a removed attachment",
    });
  }
  if (!attachment.filePath || !fs.existsSync(attachment.filePath)) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "File not found on storage" });
  }
  return { mimeType: attachment.mimeType, originalName: attachment.originalName, filePath: attachment.filePath };
}

export async function getAttachmentMetadata(input: { ticketId: unknown; attachmentId: unknown }, query: Record<string, unknown>) {
  const prisma = getPrisma();
  const { ticketId, attachmentId, requesterId } = parseAttachmentIdentity(input.ticketId, input.attachmentId, query.requesterId);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  if (ticket.requesterId !== requesterId) {
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "Access denied: ticket is owned by another requester",
    });
  }
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Attachment not found" });
  }
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    isRemoved: attachment.isRemoved,
    removalReason: attachment.removalReason,
    removedAt: attachment.removedAt ? attachment.removedAt.toISOString() : null,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export async function removeAttachment(input: { ticketId: unknown; attachmentId: unknown }, body: Record<string, unknown>) {
  const prisma = getPrisma();
  const { ticketId, attachmentId, requesterId } = parseAttachmentIdentity(input.ticketId, input.attachmentId, body.requesterId, "body");
  const trimmedReason = parseRemovalReason(body.removalReason);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
  }
  // BR-05 Ownership isolation
  if (ticket.requesterId !== requesterId) {
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "Access denied: ticket is owned by another requester",
    });
  }
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "Attachment not found" });
  }
  if (attachment.isRemoved) {
    throw new ApiError(400, {
      code: "BAD_REQUEST",
      message: "Attachment is already removed",
    });
  }
  const updated = await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      isRemoved: true,
      removalReason: trimmedReason,
      removedAt: new Date(),
    },
  });
  return {
    id: updated.id,
    ticketId: updated.ticketId,
    originalName: updated.originalName,
    isRemoved: updated.isRemoved,
    removalReason: updated.removalReason,
    removedAt: updated.removedAt ? updated.removedAt.toISOString() : null,
  };
}
