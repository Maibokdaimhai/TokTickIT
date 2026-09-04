import { RequesterUser, Category, RelatedSystem, Priority, Ticket, FetchTicketsParams, TicketsResponse } from "./types.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const catRes = await fetch(`${API_URL}/api/categories`);
  if (!catRes.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] = await catRes.json();
  return { online: true, categories };
}

export async function fetchRequesters(): Promise<RequesterUser[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) {
    throw new Error("Failed to fetch active development requesters");
  }
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error("Failed to fetch active IT categories");
  }
  return res.json();
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Failed to fetch active related systems");
  }
  return res.json();
}

export interface CreateTicketPayload {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
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

export async function deleteTicketRollback(ticketId: number, requesterId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}?requesterId=${requesterId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to roll back draft ticket");
  }
}

export async function uploadAttachment(ticketId: number, file: File, requesterId: number): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("requesterId", String(requesterId));

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
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
  query.append("requesterId", String(params.requesterId));

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

  const res = await fetch(`${API_URL}/api/tickets?${query.toString()}`, { signal: params.signal });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to fetch tickets");
  }

  return data;
}


