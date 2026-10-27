import { apiFetch, API_URL, ApiClientError } from "./api.js";
import type { TicketHistoryPage } from "./types.js";

export async function fetchTicketHistory(ticketId: number, page = 1, signal?: AbortSignal): Promise<TicketHistoryPage> {
  const response = await apiFetch(`${API_URL}/api/tickets/${ticketId}/status-history?page=${page}&limit=10`, { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError(data?.error?.message || "Unable to load Ticket history", response.status, data?.error?.code);
  if (!data) throw new Error("Unable to load Ticket history");
  return data;
}
