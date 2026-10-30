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

interface ListActor { id: number; role: string }
interface TicketListContext { userId: number; role: string; returnTo: string }
// Per-entry browser history state survives Detail reloads, without a global
// last-list cache that could mix tabs, users or separate Detail entries.
export function ticketListState(actor: ListActor) {
  return { ticketListContext: { userId: actor.id, role: actor.role, returnTo: window.location.pathname + window.location.search } satisfies TicketListContext };
}
export function ticketListReturn(actor: ListActor, state: unknown = window.history.state): string | null {
  if (!state || typeof state !== "object" || !("ticketListContext" in state)) return null;
  const context = state.ticketListContext;
  if (!context || typeof context !== "object") return null;
  const value = context as TicketListContext;
  if (value.userId !== actor.id || value.role !== actor.role || typeof value.returnTo !== "string") return null;
  const path = actor.role === "REQUESTER" ? "/my-tickets" : "/staff/tickets";
  const [pathname, search = ""] = value.returnTo.split("?");
  if (pathname !== path || value.returnTo.includes("#") || value.returnTo.split("?").length > 2) return null;
  try {
    if (actor.role === "REQUESTER") readTicketQuery(search, false);
    else readTicketQuery(search, true);
    return value.returnTo;
  } catch { return null; }
}
