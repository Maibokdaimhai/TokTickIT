import { API_URL, apiFetch, ApiClientError } from "./api.js";
import type { RequesterDashboard, StaffDashboard, MyActionsPage } from "./types.js";
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(`${API_URL}/api${path}`, { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError(data?.error?.message || "Unable to load dashboard data", response.status, data?.error?.code);
  if (!data) throw new Error("Unable to load dashboard data");
  return data;
}
export const fetchRequesterDashboard = (signal?: AbortSignal) => read<RequesterDashboard>("/dashboards/requester", signal);
export const fetchStaffDashboard = (signal?: AbortSignal) => read<StaffDashboard>("/dashboards/staff", signal);
export const fetchMyActions = (page: number, signal?: AbortSignal) => read<MyActionsPage>(`/staff/actions?assignee=me&statusGroup=active&page=${page}&limit=10`, signal);
