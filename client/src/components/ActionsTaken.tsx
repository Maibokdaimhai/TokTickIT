import React, { useEffect, useRef, useState } from "react";
import * as api from "../actions-api.js";
import { fetchEligibleOwners } from "../api.js";
import type { AuthUser, CreateActionPayload, EligibleOwner, TicketAction, TicketStatus } from "../types.js";
import { actionDraft, actionPayload, validateActionDraft } from "../utils/action-form.js";
import { ActionCard } from "./ActionCard.js";
import { ActionEditor, type ActionEditorState } from "./ActionEditor.js";

export interface ActionsTakenProps {
  ticketId: number; ticketStatus: TicketStatus; ticketCreatedAt: string; ticketVersion: number;
  actor?: AuthUser; onTicketChanged: () => Promise<void>;
  ticketRefreshFailed?: boolean;
}
const writableStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
function focusElement(element: HTMLElement | null) { element?.scrollIntoView?.({ block: "center" }); element?.focus({ preventScroll: true }); }
function selectedId() {
  const raw = new URLSearchParams(window.location.search).get("actionId");
  return raw && /^[1-9]\d*$/.test(raw) && Number(raw) <= 2147483647 ? Number(raw) : null;
}
export function ActionsTaken(props: ActionsTakenProps) { return <ActionsPanel key={props.ticketId} {...props} />; }
function ActionsPanel({ ticketId, ticketStatus, ticketCreatedAt, ticketVersion, actor, onTicketChanged, ticketRefreshFailed = false }: ActionsTakenProps) {
  const [items, setItems] = useState<TicketAction[]>([]), [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true), [listError, setListError] = useState(""), [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<TicketAction | null>(null), [selectedError, setSelectedError] = useState("");
  const [selectedLoading, setSelectedLoading] = useState(Boolean(selectedId()));
  const [version, setVersion] = useState(ticketVersion), [denied, setDenied] = useState(false);
  const [editor, setEditor] = useState<ActionEditorState | null>(null), [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false), [ownersError, setOwnersError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}), [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false), [confirm, setConfirm] = useState(false), [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState(""), [summaryFailed, setSummaryFailed] = useState(false);
  const [conflict, setConflict] = useState(false), [recovering, setRecovering] = useState(false);
  const [recovery, setRecovery] = useState<{ ticketVersion: number; action?: TicketAction } | null>(null);
  const alive = useRef(true), busy = useRef(false), attempt = useRef<CreateActionPayload | null>(null);
  const ownersRequest = useRef(0);
  const header = useRef<HTMLHeadingElement>(null), errorSummary = useRef<HTMLDivElement>(null);
  const focusInitialSelection = useRef(Boolean(selectedId()));
  const onTicketChangedRef = useRef(onTicketChanged); onTicketChangedRef.current = onTicketChanged;
  const writer = Boolean(actor?.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(actor.role));
  const writable = writer && writableStatuses.includes(ticketStatus);
  const currentVersion = Math.max(version, ticketVersion);
  const frozen = !writable || summaryFailed || ticketRefreshFailed || Boolean(editor?.mode === "edit" && editor.action && ["COMPLETED", "CANCELLED"].includes(editor.action.status)) || Boolean(editor?.mode === "followup" && !editor.action?.followUpRequired);
  const dirty = Boolean(editor && (JSON.stringify(editor.draft) !== editor.initial || editor.completionNote || uncertain));
  const clearProtected = () => { setDenied(true); setItems([]); setSelected(null); setEditor(null); setOwners([]); attempt.current = null; };
  useEffect(() => {
    alive.current = true;
    const clear = () => clearProtected();
    window.addEventListener("auth:expired", clear); window.addEventListener("auth:password-required", clear);
    return () => { alive.current = false; window.removeEventListener("auth:expired", clear); window.removeEventListener("auth:password-required", clear); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setListError("");
    api.fetchActions(ticketId, page, controller.signal).then(response => {
      if (active) { setItems(response.actions); setTotalPages(response.pagination.totalPages); setVersion(v => Math.max(v, response.ticketVersion)); }
    }).catch(reason => {
      if (active) { setListError("Unable to load Actions Taken. Try again."); if ([401, 403, 404].includes(reason?.status)) clearProtected(); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [ticketId, page, refresh, ticketVersion]);
  useEffect(() => {
    const id = selectedId(), raw = new URLSearchParams(window.location.search).get("actionId");
    if (!id) { if (raw) setSelectedError("Invalid Action link. Choose an item from the list."); return; }
    const controller = new AbortController(); let active = true;
    setSelectedLoading(true); setSelectedError("");
    api.fetchAction(ticketId, id, controller.signal).then(response => { if (active) {
      setSelected(response.action); setVersion(v => Math.max(v, response.ticketVersion));
      if (focusInitialSelection.current) { focusInitialSelection.current = false; setTimeout(() => focusElement(document.querySelector(`#action-${response.action.id} h3`)), 0); }
    } })
      .catch(() => { if (active) setSelectedError("Unable to load the selected Action. It may not be available on this Ticket."); })
      .finally(() => { if (active) setSelectedLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [ticketId, refresh, ticketVersion]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: Event) => { if (busy.current || !window.confirm("Discard the unsaved Action draft? An uncertain request may already have saved; check Actions Taken before starting again.")) event.preventDefault(); };
    window.addEventListener("beforeunload", unload); window.addEventListener("app:before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("app:before-navigate", navigate); };
  }, [dirty, saving]);
  useEffect(() => { if (confirm) document.querySelector<HTMLButtonElement>(".action-confirmation button")?.focus(); }, [confirm]);

  const loadOwners = async () => {
    const request = ++ownersRequest.current;
    setOwnersLoading(true); setOwnersError("");
    try { const response = await fetchEligibleOwners(); if (alive.current && request === ownersRequest.current) setOwners(response.owners); }
    catch { if (alive.current && request === ownersRequest.current) setOwnersError("Unable to load eligible staff. Your draft is retained."); }
    finally { if (alive.current && request === ownersRequest.current) setOwnersLoading(false); }
  };
  const discard = () => {
    if (busy.current || (dirty && !window.confirm("Discard this unsaved Action draft? If a request may have succeeded, check the action list before creating another."))) return false;
    setEditor(null); attempt.current = null; setUncertain(false); setConfirm(false); setConflict(false); setSaveError(""); setErrors({}); focusElement(header.current); return true;
  };
  const open = (mode: ActionEditorState["mode"], action?: TicketAction) => {
    if (editor && !discard()) return;
    const draft = actionDraft(action, actor?.id);
    setEditor({ mode, action, draft, completionNote: "", initial: JSON.stringify(draft), expectedTicketVersion: currentVersion, expectedActionVersion: action?.version ?? 0, clientRequestId: crypto.randomUUID() });
    setNotice(""); setSaveError(""); setErrors({}); setConfirm(false); setConflict(false); setRecovery(null); attempt.current = null; setUncertain(false);
    if (mode !== "followup") void loadOwners();
    setTimeout(() => focusElement(document.querySelector(".action-editor textarea, .action-editor input")), 0);
  };
  const recover = async () => {
    setRecovering(true); setRecovery(null);
    try {
      const list = await api.fetchActions(ticketId, page);
      const latest = editor?.action ? await api.fetchAction(ticketId, editor.action.id) : null;
      await onTicketChangedRef.current();
      if (!alive.current) return;
      setItems(list.actions); setTotalPages(list.pagination.totalPages); setVersion(Math.max(list.ticketVersion, latest?.ticketVersion ?? 0));
      if (latest) setSelected(latest.action);
      setRecovery({ ticketVersion: Math.max(list.ticketVersion, latest?.ticketVersion ?? 0), action: latest?.action });
    } catch { if (alive.current) setSaveError("Unable to refresh the latest data. Your draft is retained; retry refresh before saving."); }
    finally { if (alive.current) setRecovering(false); }
  };
  const save = async () => {
    if (!editor || busy.current || frozen || conflict) return;
    busy.current = true; setSaving(true); setSaveError("");
    try {
      let result;
      if (editor.mode === "create") {
        const payload = attempt.current ?? { ...actionPayload(editor.draft), expectedTicketVersion: editor.expectedTicketVersion, clientRequestId: editor.clientRequestId };
        attempt.current = payload;
        result = await api.createAction(ticketId, payload);
      } else if (editor.mode === "followup") result = await api.completeActionFollowUp(ticketId, editor.action!.id, { completionNote: editor.completionNote.trim(), expectedTicketVersion: editor.expectedTicketVersion, expectedActionVersion: editor.expectedActionVersion });
      else result = await api.updateAction(ticketId, editor.action!.id, { ...actionPayload(editor.draft), expectedTicketVersion: editor.expectedTicketVersion, expectedActionVersion: editor.expectedActionVersion });
      if (!alive.current) return;
      setSelected(result.action); setVersion(v => Math.max(v, result.ticketVersion)); setEditor(null); attempt.current = null; setUncertain(false); setConfirm(false);
      const url = new URL(window.location.href); url.searchParams.set("actionId", String(result.action.id)); window.history.replaceState(null, "", url.pathname + url.search); window.dispatchEvent(new Event("app:location-changed"));
      setNotice(editor.mode === "followup" ? "Follow-up completion recorded. The original work and history are preserved." : "Action saved.");
      setRefresh(v => v + 1); focusElement(header.current);
      try { await onTicketChangedRef.current(); if (alive.current) setSummaryFailed(false); }
      catch { if (alive.current) setSummaryFailed(true); }
    } catch (reason: any) {
      if (!alive.current) return;
      if ([401, 403].includes(reason?.status)) { clearProtected(); return; }
      setSaveError(reason?.message || "Unable to save. Your draft is retained."); setConfirm(false);
      if (reason?.status === 409) { attempt.current = null; setUncertain(false); setConflict(true); void recover(); }
      else if (editor.mode === "create") {
        if (!reason?.status || reason.status >= 500) setUncertain(true);
        else { attempt.current = null; setUncertain(false); }
      }
      setTimeout(() => focusElement(errorSummary.current), 0);
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (!editor || busy.current || frozen || conflict) return;
    const validation = editor.mode === "followup" ? (!editor.completionNote.trim() || Array.from(editor.completionNote.trim()).length > 2000 ? { completionNote: "Enter a completion note of 1–2000 characters." } : {}) : validateActionDraft(editor.draft, ticketCreatedAt, owners.map(o => o.id));
    setErrors(validation);
    if (Object.keys(validation).length) { setTimeout(() => focusElement(document.querySelector(".action-editor [aria-invalid='true']")), 0); return; }
    if (editor.mode === "edit" && ["COMPLETED", "CANCELLED"].includes(editor.draft.status)) setConfirm(true);
    else void save();
  };
  if (denied) return <section className="actions-taken"><h2>Actions Taken</h2><p role="alert">Actions Taken is unavailable. Sign in with a permitted account or reload the Ticket.</p></section>;
  const card = (action: TicketAction) => <ActionCard key={action.id} action={action} onEdit={writable && !saving ? () => open("edit", action) : undefined} onFollowUp={writable && !saving ? () => open("followup", action) : undefined} />;
  return <section className="actions-taken" aria-label="Actions Taken">
    <div className="action-toolbar"><h2 tabIndex={-1} ref={header}>Actions Taken</h2>
      {writable && <button type="button" className="btn-primary" disabled={loading || Boolean(listError) || saving || summaryFailed || ticketRefreshFailed} onClick={() => open("create")}>New Action</button>}
      <button type="button" className="btn-secondary" disabled={loading || saving} onClick={() => setRefresh(v => v + 1)}>Refresh Actions</button>
    </div>
    <p>Actions and their history are visible to the Requester. Use Internal Notes for private information.</p>
    {writer && !writable && <p>Reopen the Ticket before recording more work.</p>}
    {notice && <p role="status" className="action-success">{notice}</p>}
    {summaryFailed && <div role="alert">The action was saved, but the Ticket summary could not refresh. <button type="button" className="btn-secondary" onClick={() => { onTicketChangedRef.current().then(() => setSummaryFailed(false)).catch(() => setSummaryFailed(true)); }}>Retry Ticket Summary</button></div>}
    {(saveError || conflict) && <div role="alert" tabIndex={-1} ref={errorSummary} className="action-error">
      {saveError}{conflict && <><p>Your draft has not been overwritten. Review the latest saved work before retrying.</p>
        <button type="button" className="btn-secondary" disabled={recovering} onClick={() => void recover()}>{recovering ? "Refreshing latest data…" : "Refresh Latest Data"}</button>
        {recovery && <button type="button" className="btn-secondary" onClick={() => { setEditor(e => e ? { ...e, action: recovery.action ?? e.action, expectedTicketVersion: Math.max(currentVersion, recovery.ticketVersion), expectedActionVersion: recovery.action?.version ?? e.expectedActionVersion } : e); setConflict(false); setRecovery(null); setConfirm(false); setSaveError(""); }}>Use Latest Versions and Review Draft</button>}</>}
    </div>}
    {editor && actor && <ActionEditor editor={editor} actor={actor} owners={owners} ownersError={ownersError} ownersLoading={ownersLoading} errors={errors}
      disabled={saving || confirm || uncertain || frozen} saving={saving} confirm={confirm} frozen={frozen || conflict} uncertain={uncertain} createdAt={ticketCreatedAt}
      pausedMessage={conflict ? "Review the latest data before saving. Your draft is retained." : summaryFailed || ticketRefreshFailed ? "Refresh the Ticket summary before saving again. Your draft is retained." : "This work is now read-only. Your draft is retained; copy it before closing."}
      onChange={draft => { setEditor(e => e ? { ...e, draft } : e); setErrors({}); }} onCompletion={completionNote => { setEditor(e => e ? { ...e, completionNote } : e); setErrors({}); }}
      onSubmit={submit} onConfirm={() => void save()} onCancelConfirm={() => setConfirm(false)} onCancel={() => { discard(); }} onRetryOwners={() => void loadOwners()} />}
    {loading && <p>Loading Actions Taken…</p>}
    {listError && <p role="alert">{listError}</p>}
    {selectedLoading && <p>Loading selected Action…</p>}
    {selectedError && <p role="alert">{selectedError}</p>}
    {selected && <div className="action-selected"><p>Selected Action</p>{card(selected)}</div>}
    {!loading && !listError && !items.length && <p>{page > 1 ? "No Actions on this page." : "No Actions Taken have been recorded yet."}</p>}
    {items.filter(action => action.id !== selected?.id).map(card)}
    {(totalPages > 1 || page > 1) && <nav className="action-toolbar" aria-label="Actions Taken pages">
      <button type="button" className="btn-secondary" disabled={page === 1 || loading || saving} onClick={() => setPage(p => p - 1)}>Previous Actions Page</button>
      <span>Actions page {page} of {totalPages || 1}</span>
      <button type="button" className="btn-secondary" disabled={page >= totalPages || loading || saving} onClick={() => setPage(p => p + 1)}>Next Actions Page</button>
    </nav>}
  </section>;
}
