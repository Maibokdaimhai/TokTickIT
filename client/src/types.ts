export interface RequesterUser {
  id: number;
  name: string;
  email: string;
  department?: string;
}

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export interface AuthUser extends RequesterUser { role: UserRole; isActive: boolean }
export interface AuthResult { user: AuthUser; mustChangePassword: boolean }

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export interface SafeOwner {
  id: number;
  name: string;
  email: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}

export type EligibleOwner = SafeOwner;

export interface StaffTicketRow {
  id: number;
  ticketNumber: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: Priority;
  itPriority: Priority;
  status: TicketStatus;
  owner: SafeOwner | null;
  version: number;
  attachmentCount: number;
  publicCommentCount: number;
}

export interface StaffTicketsResponse {
  tickets: StaffTicketRow[];
  pagination: PaginationInfo;
}

export type StaffSortOption =
  | "updatedAt_desc"
  | "createdAt_desc"
  | "createdAt_asc"
  | "ticketNumber_asc"
  | "ticketNumber_desc"
  | "itPriority_desc";

export interface FetchStaffTicketsParams {
  search?: string;
  category?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  status?: TicketStatus;
  owner?: string | number;
  sort?: StaffSortOption;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

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
  downloadUrl?: string | null;
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

export type PublicComment = Entry;
export type InternalNote = Entry;

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

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  requesterId: number;
  requester: RequesterUser;
  categoryId: number;
  category: Category;
  relatedSystemId: number;
  relatedSystem: RelatedSystem;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority?: Priority | null;
  status: TicketStatus;
  owner?: SafeOwner | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
  attachmentCount?: number;
  publicCommentCount?: number;
  attachments: Attachment[];
  publicComments?: PublicComment[];
  problemAppearsResolvedAt?: string | null;
  problemAppearsResolvedById?: number | null;
}

export interface StaffTicketDetail extends TicketDetail {
  internalNotes: InternalNote[];
}

export interface UpdateStatusPayload {
  status: TicketStatus;
  expectedStatus: TicketStatus;
  expectedVersion: number;
  confirmed?: boolean;
}

export interface ProblemAppearsResolvedPayload {
  expectedVersion: number;
  comment?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketsResponse {
  tickets: Ticket[];
  pagination: PaginationInfo;
}

export interface FetchTicketsParams {
  search?: string;
  category?: number;
  priority?: Priority;
  status?: TicketStatus;
  sort?: "createdAt_desc" | "createdAt_asc" | "ticketNumber_asc" | "ticketNumber_desc";
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}
