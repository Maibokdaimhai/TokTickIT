import type { Priority, TicketStatus, UserRole } from "@prisma/client";

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Owner {
  id: number;
  name: string;
  email: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}

export interface AttachmentMetadata {
  id: number;
  ticketId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  isRemoved: boolean;
  removalReason: string | null;
  removedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

export interface Entry {
  id: number;
  ticketId: number;
  content: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
    role: UserRole;
  };
}

export interface TicketRow {
  id: number;
  ticketNumber: string;
  summary: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: Priority;
  itPriority: Priority;
  status: TicketStatus;
  owner: Owner | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  attachmentCount: number;
  publicCommentCount: number;
}

export interface TicketDetail extends TicketRow {
  requesterId: number;
  requester: SafeUser;
  categoryId: number;
  relatedSystemId: number;
  description: string;
  attachments: AttachmentMetadata[];
  publicComments: Entry[];
  problemAppearsResolvedAt: string | null;
  problemAppearsResolvedById: number | null;
}

export interface StaffTicketDetail extends TicketDetail {
  internalNotes: Entry[];
}

export function formatAttachmentMetadata(att: {
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
}): AttachmentMetadata {
  return {
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
    downloadUrl: att.isRemoved ? null : `/api/tickets/${att.ticketId}/attachments/${att.id}`,
  };
}

export function formatCommunicationEntry(entry: {
  id: number;
  ticketId: number;
  content: string;
  createdAt: Date;
  author: {
    id: number;
    name: string;
    role: UserRole;
    [key: string]: any;
  };
}): Entry {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    content: entry.content,
    createdAt: entry.createdAt.toISOString(),
    author: {
      id: entry.author.id,
      name: entry.author.name,
      role: entry.author.role,
    },
  };
}

export function formatTicketDetail(ticket: any): TicketDetail {
  const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
  const publicComments = Array.isArray(ticket.publicComments) ? ticket.publicComments : [];
  const activeAttachments = attachments.filter((att: any) => !att.isRemoved);

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    description: ticket.description,
    categoryId: ticket.categoryId,
    category: ticket.category ? { id: ticket.category.id, name: ticket.category.name } : { id: ticket.categoryId, name: "" },
    relatedSystemId: ticket.relatedSystemId,
    relatedSystem: ticket.relatedSystem ? { id: ticket.relatedSystem.id, name: ticket.relatedSystem.name } : { id: ticket.relatedSystemId, name: "" },
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    status: ticket.status,
    owner: ticket.owner ? {
      id: ticket.owner.id,
      name: ticket.owner.name,
      email: ticket.owner.email,
      role: ticket.owner.role,
    } : null,
    requesterId: ticket.requesterId,
    requester: {
      id: ticket.requester.id,
      name: ticket.requester.name,
      email: ticket.requester.email,
      role: ticket.requester.role,
      isActive: ticket.requester.isActive,
    },
    createdAt: ticket.createdAt instanceof Date ? ticket.createdAt.toISOString() : ticket.createdAt,
    updatedAt: ticket.updatedAt instanceof Date ? ticket.updatedAt.toISOString() : ticket.updatedAt,
    version: ticket.version ?? 0,
    attachmentCount: activeAttachments.length,
    publicCommentCount: publicComments.length,
    attachments: attachments.map(formatAttachmentMetadata),
    publicComments: publicComments.map(formatCommunicationEntry),
    problemAppearsResolvedAt: ticket.problemAppearsResolvedAt ? (ticket.problemAppearsResolvedAt instanceof Date ? ticket.problemAppearsResolvedAt.toISOString() : ticket.problemAppearsResolvedAt) : null,
    problemAppearsResolvedById: ticket.problemAppearsResolvedById ?? null,
  };
}

export function formatStaffTicketDetail(ticket: any): StaffTicketDetail {
  const base = formatTicketDetail(ticket);
  const internalNotes = Array.isArray(ticket.internalNotes) ? ticket.internalNotes : [];
  return {
    ...base,
    internalNotes: internalNotes.map(formatCommunicationEntry),
  };
}
