import { API_URL, apiFetch, ApiClientError } from "./api.js";
import type { ActionsPage, ActionWriteResult, ActionRevision, PaginationInfo, CreateActionPayload, UpdateActionPayload, CompleteFollowUpPayload } from "./types.js";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`${API_URL}/api${path}`, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError(data?.error?.message || "Unable to load or save Actions Taken", response.status, data?.error?.code);
  if (!data) throw new ApiClientError("Invalid Actions Taken response. Refresh and try again.", 502);
  return data;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const fetchActions = (ticketId: number, page = 1, signal?: AbortSignal) => request<ActionsPage>(`/tickets/${ticketId}/actions?page=${page}&limit=10`, { signal });
export const fetchAction = (ticketId: number, actionId: number, signal?: AbortSignal) => request<ActionWriteResult>(`/tickets/${ticketId}/actions/${actionId}`, { signal });
export const fetchActionRevisions = (ticketId: number, actionId: number, page = 1, signal?: AbortSignal) => request<{ revisions: ActionRevision[]; pagination: PaginationInfo }>(`/tickets/${ticketId}/actions/${actionId}/revisions?page=${page}&limit=10`, { signal });
export const createAction = (ticketId: number, payload: CreateActionPayload) => request<ActionWriteResult>(`/staff/tickets/${ticketId}/actions`, json("POST", payload));
export const updateAction = (ticketId: number, actionId: number, payload: UpdateActionPayload) => request<ActionWriteResult>(`/staff/tickets/${ticketId}/actions/${actionId}`, json("PATCH", payload));
export const completeActionFollowUp = (ticketId: number, actionId: number, payload: CompleteFollowUpPayload) => request<ActionWriteResult>(`/staff/tickets/${ticketId}/actions/${actionId}/follow-up-completion`, json("POST", payload));
