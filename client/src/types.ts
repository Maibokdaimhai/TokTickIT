export interface RequesterUser {
  id: number;
  name: string;
  email: string;
  department: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface Attachment {
  id: number;
  ticketId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  isRemoved: boolean;
  removalReason?: string | null;
  removedAt?: string | null;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requester?: RequesterUser;
  categoryId: number;
  category?: Category;
  relatedSystemId: number;
  relatedSystem?: RelatedSystem;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority?: Priority | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  attachmentCount?: number;
}
