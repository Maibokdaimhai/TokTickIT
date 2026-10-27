import React, { useEffect, useState } from "react";
import type { TicketHistoryPage, TicketStatus } from "../types.js";
import { fetchTicketHistory } from "../workflow-api.js";
import { bangkokDate } from "../utils/action-form.js";

const label = (status: TicketStatus) => ({ NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress", WAITING_FOR_REQUESTER: "Waiting for Requester", RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled" })[status];
export function ResolutionSummary({ status, resolvedAt, estimated }: { status: TicketStatus; resolvedAt?: string | null; estimated?: boolean }) {
  if (!["RESOLVED", "CLOSED"].includes(status)) return null;
  return <p className="resolution-summary" role="status">{resolvedAt ? <>Resolved {bangkokDate(resolvedAt)}{estimated && " — Estimated from the legacy record"}</> : "Resolution time is not available for this legacy Ticket."}</p>;
}
export function TicketHistory(props: { ticketId: number; refreshKey: number }) { return <HistoryPanel key={props.ticketId} {...props} />; }
function HistoryPanel({ ticketId, refreshKey }: { ticketId: number; refreshKey: number }) {
  const [page, setPage] = useState(1), [data, setData] = useState<TicketHistoryPage | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(false); setData(null);
    fetchTicketHistory(ticketId, page, controller.signal).then(response => { if (active) setData(response); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [ticketId, page, refreshKey, retry]);
  return <section className="actions-taken ticket-history" aria-label="Ticket History">
    <div className="action-toolbar"><h2>Ticket History</h2><button type="button" className="btn-secondary" disabled={loading} onClick={() => setRetry(v => v + 1)}>Refresh Ticket History</button></div>
    {loading && <p role="status">Loading Ticket history…</p>}
    {error && <p role="alert">Unable to load Ticket history. Try refreshing it.</p>}
    {data && <>
      <p className="action-meta">History available since {bangkokDate(data.historyStartsAt)}. Earlier transitions were not backfilled.</p>
      {!data.events.length && <p>{page === 1 ? "No recorded Ticket transitions yet." : "No transitions on this page."}</p>}
      <ol className="ticket-history-list">
        {data.events.map(event => <li key={event.id}><strong>{label(event.fromStatus)} → {label(event.toStatus)}</strong><p>Changed by {event.actor.name} at {bangkokDate(event.createdAt)}</p></li>)}
      </ol>
      {(data.pagination.totalPages > 1 || page > 1) && <nav className="action-toolbar" aria-label="Ticket history pages">
        <button type="button" className="btn-secondary" disabled={page === 1 || loading} onClick={() => setPage(v => v - 1)}>Previous Ticket History Page</button>
        <span>History page {page} of {data.pagination.totalPages || 1}</span>
        <button type="button" className="btn-secondary" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage(v => v + 1)}>Next Ticket History Page</button>
      </nav>}
    </>}
  </section>;
}
