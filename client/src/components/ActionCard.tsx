import React, { useEffect, useState } from "react";
import { fetchActionRevisions } from "../actions-api.js";
import type { ActionRevision, TicketAction } from "../types.js";
import { actionStatusLabel, bangkokDate } from "../utils/action-form.js";

function WorkDetails({ value }: { value: Pick<TicketAction, "actionAt" | "description" | "result" | "status" | "followUpRequired" | "followUpNote" | "attachmentNotes" | "followUpCompletedAt" | "followUpCompletionNote"> }) {
  return <dl className="action-details">
    <dt>Action Date/Time</dt><dd>{bangkokDate(value.actionAt)}</dd>
    <dt>Action Description</dt><dd>{value.description}</dd>
    <dt>Result</dt><dd>{value.result || "Not recorded"}</dd>
    <dt>Status</dt><dd><span className={`action-badge action-${value.status.toLowerCase()}`}>{actionStatusLabel(value.status)}</span></dd>
    <dt>Follow-Up Required?</dt><dd>{value.followUpRequired ? "Yes" : "No"}</dd>
    <dt>Follow-up Note</dt><dd>{value.followUpNote || "None"}</dd>
    <dt>Attachment Notes</dt><dd>{value.attachmentNotes || "None"}</dd>
    {value.followUpCompletedAt && <><dt>Follow-up completed</dt><dd>{bangkokDate(value.followUpCompletedAt)}</dd><dt>Completion Note</dt><dd>{value.followUpCompletionNote}</dd></>}
  </dl>;
}
function ActionHistory({ action }: { action: TicketAction }) {
  const { ticketId, id: actionId, version } = action;
  const [page, setPage] = useState(1), [data, setData] = useState<ActionRevision[]>([]), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(""); setData([]);
    fetchActionRevisions(ticketId, actionId, page, controller.signal).then(response => {
      if (active) { setData(response.revisions); setTotal(response.pagination.totalPages); }
    }).catch(() => { if (active) setError("Unable to load action history. Try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [ticketId, actionId, page, version, retry]);
  const people = new Map([[action.performedBy.id, action.performedBy.name], [action.assignee.id, action.assignee.name], ...data.map(r => [r.editor.id, r.editor.name] as [number, string])]);
  const name = (id: number) => people.get(id) ?? `User #${id}`;
  return <section className="action-history" aria-label={`History of Action #${actionId}`}>
    <h4>Action #{actionId} History</h4>
    {loading && <p role="status">Loading action history…</p>}
    {error && <div role="alert">{error} <button type="button" className="btn-secondary" onClick={() => setRetry(v => v + 1)}>Retry History</button></div>}
    {!loading && !error && !data.length && <p>No revision history available.</p>}
    {data.map(revision => <article key={revision.id} className="action-revision">
      <h5>Revision {revision.version}</h5><p>Recorded by {revision.editor.name} at {bangkokDate(revision.createdAt)}</p>
      <p>Performed by: {name(revision.snapshot.performedById)} · Assigned to: {name(revision.snapshot.assigneeId)}</p>
      <WorkDetails value={revision.snapshot} />
      {revision.snapshot.followUpCompletedById && <p>Follow-up completed by {name(revision.snapshot.followUpCompletedById)}</p>}
    </article>)}
    {total > 1 && <nav className="action-toolbar" aria-label={`Action #${actionId} history pages`}>
      <button type="button" className="btn-secondary" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Previous History Page</button>
      <span>History page {page} of {total}</span>
      <button type="button" className="btn-secondary" disabled={page >= total || loading} onClick={() => setPage(p => p + 1)}>Next History Page</button>
    </nav>}
  </section>;
}
export function ActionCard({ action, onEdit, onFollowUp }: { action: TicketAction; onEdit?: () => void; onFollowUp?: () => void }) {
  const [history, setHistory] = useState(false);
  const terminal = action.status === "COMPLETED" || action.status === "CANCELLED";
  return <article id={`action-${action.id}`} className="action-card" aria-label={`Action #${action.id}`}>
    <div className="action-toolbar"><h3 tabIndex={-1}>Action #{action.id}</h3>{terminal && <span>Original work: Read only</span>}</div>
    <dl className="action-details"><dt>Performed by</dt><dd>{action.performedBy.name}</dd><dt>Assigned to</dt><dd>{action.assignee.name}{(!action.assignee.isActive || action.assignee.role === "REQUESTER") && " (inactive or ineligible)"}</dd></dl>
    <WorkDetails value={action} />
    {action.followUpCompletedBy && <p>Follow-up completed by {action.followUpCompletedBy.name}</p>}
    <p className="action-meta">Created {bangkokDate(action.createdAt)} · Updated {bangkokDate(action.updatedAt)}</p>
    <div className="action-toolbar">
      {onEdit && !terminal && <button type="button" className="btn-secondary" onClick={onEdit}>Edit Action #{action.id}</button>}
      {onFollowUp && action.status === "COMPLETED" && action.followUpRequired && <button type="button" className="btn-secondary" onClick={onFollowUp}>Record Follow-up Completion for Action #{action.id}</button>}
      <button type="button" className="btn-secondary" aria-expanded={history} onClick={() => setHistory(v => !v)}>{history ? "Hide" : "View"} History for Action #{action.id}</button>
    </div>
    {history && <ActionHistory action={action} />}
  </article>;
}
