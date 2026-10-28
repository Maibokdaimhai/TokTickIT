import type { FetchStaffTicketsParams, FetchTicketsParams } from "../types.js";
export function readTicketQuery(search: string, staff: true): FetchStaffTicketsParams;
export function readTicketQuery(search: string, staff: false): FetchTicketsParams;
export function readTicketQuery(search: string, staff: boolean): FetchStaffTicketsParams | FetchTicketsParams {
  const q = new URLSearchParams(search);
  const allowed = ["search", "category", "status", "sort", "page", "limit", "statusGroup", "resolvedFrom", "resolvedTo", ...(staff ? ["owner", "requestedPriority", "itPriority"] : ["priority"])];
  const result: Record<string, string | number> = {};
  for (const [key, value] of q) {
    if (!allowed.includes(key) || q.getAll(key).length !== 1 || !value) throw new Error("Invalid Ticket filters in URL. Clear filters and try again.");
    if (["category", "page", "limit"].includes(key)) {
      if (!/^\d+$/.test(value) || +value < 1 || +value > 2147483647) throw new Error("Invalid numeric Ticket filter.");
      result[key] = +value;
    } else result[key] = value;
  }
  // Remaining enum/date validation is authoritative on the list API.
  return result as FetchStaffTicketsParams | FetchTicketsParams;
}
export function rememberTicketQuery(path: string, params: FetchStaffTicketsParams | FetchTicketsParams) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (key !== "signal" && value !== undefined && value !== "") q.set(key, String(value));
  const url = `${path}?${q}`;
  if (window.location.pathname + window.location.search !== url) {
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("app:location-changed"));
  }
}
