import {
  AuthResult,
  Category,
  RelatedSystem,
  Priority,
  Ticket,
  FetchTicketsParams,
  TicketsResponse,
  Attachment,
  TicketDetail,
  StaffTicketDetail,
  FetchStaffTicketsParams,
  StaffTicketsResponse,
  EligibleOwner,
  Entry,
  TicketStatus,
  UpdateStatusPayload,
  ProblemAppearsResolvedPayload,
} from "./types.js";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class AuthError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export class ApiClientError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiClientError";
  }
}
// All browser requests use the HttpOnly session cookie, never localStorage credentials.
async function apiFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (!url.includes("/api/auth/") && (response.status === 401 || response.status === 403)) {
    if (response.status === 401) window.dispatchEvent(new Event("auth:expired"));
    else {
      const body = await response.clone().json().catch(() => null);
      if (body?.error?.code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event("auth:password-required"));
    }
  }
  return response;
}
async function authRequest(path: string, body?: object): Promise<AuthResult> {
  const response = await apiFetch(`${API_URL}/api/auth/${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const data = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    if (response.status === 401 && path === "change-password") window.dispatchEvent(new Event("auth:expired"));
    throw new AuthError(data?.error?.details?.join(" ") || data?.error?.message || "Authentication request failed", response.status, data?.error?.code);
  }
  return data;
}
export const getSession = () => authRequest("me");
export const login = (email: string, password: string) => authRequest("login", { email, password });
export const logout = async () => { await authRequest("logout", {}); };
export const changePassword = (currentPassword: string, newPassword: string, confirmPassword: string) => authRequest("change-password", { currentPassword, newPassword, confirmPassword });

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await apiFetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const catRes = await apiFetch(`${API_URL}/api/categories`);
  if (!catRes.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] = await catRes.json();
  return { online: true, categories };
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await apiFetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error("Failed to fetch active IT categories");
  }
  return res.json();
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await apiFetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Failed to fetch active related systems");
  }
  return res.json();
}

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const res = await apiFetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.error?.details
      ? data.error.details.join(" ")
      : data?.error?.message || "Failed to create support ticket";
    throw new Error(errorMsg);
  }

  return data;
}

export async function deleteTicketRollback(ticketId: number): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to roll back draft ticket");
  }
}

export async function uploadAttachment(ticketId: number, file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to upload attachment");
  }

  return data;
}

export async function fetchMyTickets(params: FetchTicketsParams): Promise<TicketsResponse> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim()) {
    query.append("search", params.search.trim());
  }
  if (params.category !== undefined && params.category !== null) {
    query.append("category", String(params.category));
  }
  if (params.priority) {
    query.append("priority", params.priority);
  }
  if (params.status) {
    query.append("status", params.status);
  }
  if (params.sort) {
    query.append("sort", params.sort);
  }
  if (params.page !== undefined) {
    query.append("page", String(params.page));
  }
  if (params.limit !== undefined) {
    query.append("limit", String(params.limit));
  }

  const res = await apiFetch(`${API_URL}/api/tickets?${query.toString()}`, { signal: params.signal });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to fetch tickets");
  }

  return data;
}

export async function fetchTicketDetail(ticketId: number): Promise<TicketDetail> {
  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to fetch ticket details");
  }
  return data;
}

export async function removeAttachment(
  ticketId: number,
  attachmentId: number,
  removalReason: string
): Promise<Attachment> {
  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ removalReason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to remove attachment");
  }
  return data;
}

export function getAttachmentDownloadUrl(ticketId: number, attachmentId: number): string {
  return `${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}`;
}

export async function downloadAttachmentByUrl(url: string): Promise<Response> {
  const targetUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  return await apiFetch(targetUrl);
}

export async function fetchStaffTickets(params: FetchStaffTicketsParams = {}): Promise<StaffTicketsResponse> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim()) {
    query.append("search", params.search.trim());
  }
  if (params.category !== undefined && params.category !== null) {
    query.append("category", String(params.category));
  }
  if (params.requestedPriority) {
    query.append("requestedPriority", params.requestedPriority);
  }
  if (params.itPriority) {
    query.append("itPriority", params.itPriority);
  }
  if (params.status) {
    query.append("status", params.status);
  }
  if (params.owner !== undefined && params.owner !== null && params.owner !== "") {
    query.append("owner", String(params.owner));
  }
  if (params.sort) {
    query.append("sort", params.sort);
  }
  if (params.page !== undefined && params.page !== null) {
    query.append("page", String(params.page));
  }
  if (params.limit !== undefined && params.limit !== null) {
    query.append("limit", String(params.limit));
  }

  const queryString = query.toString();
  const url = `${API_URL}/api/staff/tickets${queryString ? `?${queryString}` : ""}`;

  const res = await apiFetch(url, { signal: params.signal });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error?.message || "Failed to fetch staff ticket queue";
    throw new ApiClientError(errorMsg, res.status, data?.error?.code);
  }

  return data;
}

export async function fetchEligibleOwners(): Promise<{ owners: EligibleOwner[] }> {
  const res = await apiFetch(`${API_URL}/api/staff/eligible-owners`);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error?.message || "Failed to fetch eligible owners";
    throw new ApiClientError(errorMsg, res.status, data?.error?.code);
  }

  return data;
}

export async function fetchStaffTicketDetail(ticketId: number): Promise<StaffTicketDetail> {
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to fetch staff ticket detail", res.status, data?.error?.code);
  }
  return data;
}

export async function claimStaffTicket(
  ticketId: number,
  expectedVersionOrPayload: number | { expectedVersion: number }
): Promise<{ ticket: StaffTicketDetail }> {
  const expectedVersion =
    typeof expectedVersionOrPayload === "object"
      ? expectedVersionOrPayload.expectedVersion
      : expectedVersionOrPayload;
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to claim ticket", res.status, data?.error?.code);
  }
  return data;
}
export const claimTicket = claimStaffTicket;

export async function updateStaffTicketOwner(
  ticketId: number,
  ownerIdOrPayload: number | null | { ownerId: number | null; expectedVersion: number },
  expectedVersionArg?: number
): Promise<{ ticket: StaffTicketDetail }> {
  let ownerId: number | null;
  let expectedVersion: number;
  if (typeof ownerIdOrPayload === "object" && ownerIdOrPayload !== null) {
    ownerId = ownerIdOrPayload.ownerId;
    expectedVersion = ownerIdOrPayload.expectedVersion;
  } else {
    ownerId = ownerIdOrPayload as number | null;
    expectedVersion = expectedVersionArg!;
  }
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}/owner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId, expectedVersion }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to update owner", res.status, data?.error?.code);
  }
  return data;
}
export const updateTicketOwner = updateStaffTicketOwner;

export async function updateStaffTicketItPriority(
  ticketId: number,
  itPriorityOrPayload: Priority | { itPriority: Priority; expectedVersion: number },
  expectedVersionArg?: number
): Promise<{ ticket: StaffTicketDetail }> {
  let itPriority: Priority;
  let expectedVersion: number;
  if (typeof itPriorityOrPayload === "object") {
    itPriority = itPriorityOrPayload.itPriority;
    expectedVersion = itPriorityOrPayload.expectedVersion;
  } else {
    itPriority = itPriorityOrPayload;
    expectedVersion = expectedVersionArg!;
  }
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}/it-priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itPriority, expectedVersion }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to update IT priority", res.status, data?.error?.code);
  }
  return data;
}
export const updateTicketItPriority = updateStaffTicketItPriority;

export async function updateStaffTicketStatus(
  ticketId: number,
  payload: UpdateStatusPayload
): Promise<{ ticket: StaffTicketDetail }> {
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to update ticket status", res.status, data?.error?.code);
  }
  return data;
}
export const updateTicketStatus = updateStaffTicketStatus;

export async function fetchPublicComments(ticketId: number): Promise<{ comments: Entry[] }> {
  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}/public-comments`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to fetch public comments", res.status, data?.error?.code);
  }
  return data;
}

export async function addPublicComment(ticketId: number, content: string): Promise<{ comment: Entry }> {
  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}/public-comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to add public comment", res.status, data?.error?.code);
  }
  return data;
}

export async function fetchInternalNotes(ticketId: number): Promise<{ notes: Entry[] }> {
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}/internal-notes`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to fetch internal notes", res.status, data?.error?.code);
  }
  return data;
}

export async function addInternalNote(ticketId: number, content: string): Promise<{ note: Entry }> {
  const res = await apiFetch(`${API_URL}/api/staff/tickets/${ticketId}/internal-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to add internal note", res.status, data?.error?.code);
  }
  return data;
}

export async function indicateProblemAppearsResolved(ticketId: number, payload: ProblemAppearsResolvedPayload): Promise<{ ticket: TicketDetail }> {
  const res = await apiFetch(`${API_URL}/api/tickets/${ticketId}/problem-appears-resolved`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error?.message || "Failed to indicate problem appears resolved", res.status, data?.error?.code);
  }
  return data;
}
