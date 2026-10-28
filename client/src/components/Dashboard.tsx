import React, { useEffect, useState } from "react";
import { fetchRequesterDashboard, fetchStaffDashboard, fetchMyActions } from "../dashboard-api.js";
import type { RequesterDashboard, StaffDashboard, MyActionsPage, ActionPreview, TicketPreview } from "../types.js";

export const statusOrder = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const priorities = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const date = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
function useRead<T>(read: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<{ message: string; status?: number } | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setData(null); setLoading(true); setError(null);
    read(controller.signal).then(value => { if (active) setData(value); }).catch(reason => {
      if (active && reason.name !== "AbortError") setError({ message: reason.message || "Unable to load data", status: reason.status });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [...deps, retry]);
  return { data, loading, error, refresh: () => setRetry(n => n + 1) };
}
function ReadState({ loading, error, retry }: { loading: boolean; error: { message: string; status?: number } | null; retry: () => void }) {
  return <>{loading && <p role="status">Loading…</p>}{error && <div role="alert" className="workflow-feedback"><p>{error.status === 403 ? "Access denied (403). Return to your permitted Dashboard." : error.message}</p><button type="button" className="btn-secondary" onClick={retry}>Retry</button></div>}</>;
}
function Link({ to, navigate, children, className }: { to: string; navigate: (path: string) => void; children: React.ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navigate(to); } }}>{children}</a>;
}
function TicketList({ tickets, staff, navigate }: { tickets: TicketPreview[]; staff: boolean; navigate: (path: string) => void }) {
  return tickets.length ? <ul className="dashboard-list">{tickets.map(t => <li key={t.id}><Link to={`${staff ? "/staff" : ""}/tickets/${t.id}`} navigate={navigate}>{t.ticketNumber}: {t.summary}</Link><p>{label(t.status)} · IT priority: {label(t.itPriority)} · Updated {date(t.updatedAt)} (Bangkok)</p></li>)}</ul> : <p>No recent Tickets.</p>;
}
function ActionList({ actions, navigate }: { actions: ActionPreview[]; navigate: (path: string) => void }) {
  return actions.length ? <ul className="dashboard-list">{actions.map(a => <li key={a.id}><Link to={`/staff/tickets/${a.ticketId}?actionId=${a.id}`} navigate={navigate}>{a.ticket.ticketNumber}: {a.description}</Link><p>Assigned to {a.assignee.name} · {label(a.status)}</p></li>)}</ul> : <p>No active Actions assigned to you.</p>;
}
export function Dashboard({ staff, navigate }: { staff: boolean; navigate: (path: string) => void }) {
  const { data, loading, error, refresh } = useRead<RequesterDashboard | StaffDashboard>(signal => staff ? fetchStaffDashboard(signal) : fetchRequesterDashboard(signal), [staff]);
  const r = data as RequesterDashboard | null, s = data as StaffDashboard | null;
  const resolvedQuery = data ? new URLSearchParams({ resolvedFrom: data.windowStart, resolvedTo: data.asOf }).toString() : "";
  const cards: [string, number, string][] = !data ? [] : staff ? [
    ["Unassigned Active Tickets", s!.metrics.unassignedTickets, "/staff/tickets?statusGroup=active&owner=unassigned"],
    ["My Active Tickets", s!.metrics.myTickets, "/staff/tickets?statusGroup=active&owner=me"],
    ["My Active Actions", s!.metrics.myActiveActions, "/staff/actions?assignee=me&statusGroup=active"],
  ] : [
    ["Active Tickets", r!.metrics.activeTickets, "/my-tickets?statusGroup=active"],
    ["Waiting for You", r!.metrics.waitingForRequester, "/my-tickets?status=WAITING_FOR_REQUESTER"],
    ["Recently Resolved (Last 7 Calendar Dates)", r!.metrics.recentlyResolved, `/my-tickets?${resolvedQuery}`],
  ];
  return <section className="dashboard" aria-labelledby="dashboard-title"><div className="dashboard-heading"><h1 id="dashboard-title">{staff ? "Staff" : "Requester"} Dashboard</h1><button type="button" className="btn-secondary" onClick={refresh} disabled={loading}>Refresh Dashboard</button></div>
    <ReadState loading={loading} error={error} retry={refresh} />
    {data && <><p>As of {date(data.asOf)} (Asia/Bangkok). Recent window: {date(data.windowStart)} – {date(data.asOf)}.</p>
      {!staff && <p>Waiting for You means staff is waiting for your input. Your resolution indication remains advisory.</p>}
      {!staff && r!.recentlyResolvedIncludesEstimates && <p className="workflow-feedback">Recently Resolved includes estimated legacy resolution times.</p>}
      <div className="dashboard-cards">{cards.map(([title, value, to]) => <Link key={title} to={to} navigate={navigate} className="dashboard-card"><span>{title}</span><strong>{value}</strong></Link>)}</div>
      {staff && <div className="dashboard-distributions"><section><h2>Tickets by Status</h2><ul>{statusOrder.map(status => <li key={status}><Link to={`/staff/tickets?status=${status}`} navigate={navigate}>{label(status)}: {s!.byStatus[status]}</Link></li>)}</ul></section><section><h2>Active Tickets by IT Priority</h2><ul>{priorities.map(priority => <li key={priority}><Link to={`/staff/tickets?statusGroup=active&itPriority=${priority}`} navigate={navigate}>{label(priority)}: {s!.byItPriority[priority]}</Link></li>)}</ul></section></div>}
      <section><h2>Recent Tickets</h2><TicketList tickets={data.recentTickets} staff={staff} navigate={navigate} /></section>
      {staff && <section><h2>My Active Actions</h2><ActionList actions={s!.myActions} navigate={navigate} /></section>}
    </>}
  </section>;
}
export function MyActiveActions({ search, navigate }: { search: string; navigate: (path: string) => void }) {
  const query = new URLSearchParams(search), rawPage = query.get("page") ?? "1";
  const valid = query.get("assignee") === "me" && query.get("statusGroup") === "active" && /^\d+$/.test(rawPage) && +rawPage >= 1 && +rawPage <= 2147483647 &&
    [...query.keys()].every(k => ["assignee", "statusGroup", "page"].includes(k) && query.getAll(k).length === 1);
  const page = valid ? +rawPage : 1;
  return valid ? <ActiveActionsList key={search} page={page} navigate={navigate} /> : <section role="alert"><h1>Invalid action filters</h1><p>Use assignee=me and statusGroup=active with a positive page number.</p></section>;
}
function ActiveActionsList({ page, navigate }: { page: number; navigate: (path: string) => void }) {
  const { data, loading, error, refresh } = useRead<MyActionsPage>(signal => fetchMyActions(page, signal), [page]);
  const go = (p: number) => navigate(`/staff/actions?assignee=me&statusGroup=active&page=${p}`);
  return <section className="dashboard"><div className="dashboard-heading"><h1>My Active Actions</h1><button className="btn-secondary" type="button" onClick={refresh} disabled={loading}>Refresh Actions</button></div><ReadState loading={loading} error={error} retry={refresh} />{data && <><p>{data.pagination.totalItems} active Actions assigned to you on active Tickets.</p><ActionList actions={data.actions} navigate={navigate} /><div className="dashboard-heading"><button type="button" className="btn-secondary" onClick={() => go(page - 1)} disabled={page <= 1}>Previous page</button><span>Page {page} of {Math.max(1, data.pagination.totalPages)}</span><button type="button" className="btn-secondary" onClick={() => go(page + 1)} disabled={page >= data.pagination.totalPages}>Next page</button></div></>}</section>;
}
