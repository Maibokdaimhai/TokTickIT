import React from "react";
import type { AuthUser, EligibleOwner, TicketAction } from "../types.js";
import type { ActionDraft } from "../utils/action-form.js";
import { actionOptions, actionStatusLabel, bangkokInput } from "../utils/action-form.js";

export interface ActionEditorState {
  mode: "create" | "edit" | "followup"; action?: TicketAction; draft: ActionDraft; completionNote: string;
  initial: string; expectedTicketVersion: number; expectedActionVersion: number; clientRequestId: string;
}
interface Props {
  editor: ActionEditorState; actor: AuthUser; owners: EligibleOwner[]; ownersError: string; ownersLoading: boolean;
  errors: Record<string, string>; disabled: boolean; saving: boolean; confirm: boolean; frozen: boolean;
  uncertain: boolean; createdAt: string; pausedMessage: string; onChange: (draft: ActionDraft) => void; onCompletion: (note: string) => void;
  onSubmit: (e: React.FormEvent) => void; onConfirm: () => void; onCancelConfirm: () => void; onCancel: () => void; onRetryOwners: () => void;
}
export function ActionEditor(props: Props) {
  const { editor, errors, disabled, saving, confirm } = props, { draft } = editor;
  const change = (key: keyof ActionDraft, value: string | boolean) => props.onChange({ ...draft, [key]: value });
  const error = (key: string) => errors[key] && <p id={`action-error-${key}`} className="action-error">{errors[key]}</p>;
  const inputProps = (key: string) => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `action-error-${key}` : undefined });
  const text = (key: "description" | "result" | "followUpNote" | "attachmentNotes", label: string, max: number) => <div className="action-field">
    <label htmlFor={`action-field-${key}`}>{label}</label>
    <textarea id={`action-field-${key}`} className="form-control" rows={3} required={key === "description" || (key === "result" && ["COMPLETED", "CANCELLED"].includes(draft.status)) || (key === "followUpNote" && draft.followUpRequired)} value={draft[key]} disabled={disabled} onChange={e => change(key, e.target.value)} {...inputProps(key)} />
    <span className="action-meta">{Array.from(draft[key].trim()).length} / {max}</span>{error(key)}
  </div>;
  return <form className="action-editor" aria-label={editor.mode === "followup" ? "Record Follow-up Completion" : editor.mode === "create" ? "New Action" : `Edit Action #${editor.action?.id}`} onSubmit={props.onSubmit} noValidate>
    <h3>{editor.mode === "followup" ? "Record Follow-up Completion" : editor.mode === "create" ? "New Action" : `Edit Action #${editor.action?.id}`}</h3>
    {props.uncertain && <p role="alert">The create request may have succeeded. Retry the same request to check its result. Fields are locked to prevent duplicate work.</p>}
    {props.frozen && <p role="alert">{props.pausedMessage}</p>}
    {editor.mode === "followup" ? <>
      <p>The original completed work and follow-up note remain in history. This records who completed the follow-up and when; it does not resolve the Ticket.</p>
      <p>Original follow-up: {editor.action?.followUpNote}</p>
      <label htmlFor="action-completion-note">Completion Note</label>
      <textarea id="action-completion-note" className="form-control" rows={3} required value={editor.completionNote} disabled={disabled} onChange={e => props.onCompletion(e.target.value)} {...inputProps("completionNote")} />
      <span className="action-meta">{Array.from(editor.completionNote.trim()).length} / 2000</span>{error("completionNote")}
    </> : <>
      <p>Performed by (automatic): <strong>{editor.action?.performedBy.name ?? props.actor.name}</strong></p>
      <p className="action-meta">Action Date/Time, Action Description and Assigned to are required. Result is required when completing or cancelling; Follow-up Note is required when follow-up is needed.</p>
      <div className="action-form-grid">
        <div className="action-field"><label htmlFor="action-date">Action Date/Time (Asia/Bangkok)</label>
          <input id="action-date" type="datetime-local" required step="1" min={bangkokInput(props.createdAt)} max={bangkokInput(new Date())} value={draft.actionAt} disabled={disabled} onChange={e => change("actionAt", e.target.value)} {...inputProps("actionAt")} />{error("actionAt")}</div>
        <div className="action-field"><label htmlFor="action-assignee">Assigned to</label>
          <select id="action-assignee" required value={draft.assigneeId} disabled={disabled || props.ownersLoading || Boolean(props.ownersError)} onChange={e => change("assigneeId", e.target.value)} {...inputProps("assigneeId")}>
            <option value="">Choose active staff</option>
            {!props.owners.some(o => String(o.id) === draft.assigneeId) && draft.assigneeId && <option value={draft.assigneeId} disabled>{editor.action?.assignee.name ?? "Current assignee"} (inactive or unavailable)</option>}
            {props.owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>{error("assigneeId")}</div>
      </div>
      {props.ownersLoading && <p>Loading eligible staff…</p>}
      {props.ownersError && <div role="alert">{props.ownersError} <button type="button" className="btn-secondary" onClick={props.onRetryOwners}>Retry Eligible Staff</button></div>}
      {editor.action && !props.ownersLoading && !props.ownersError && !props.owners.some(o => o.id === editor.action?.assignee.id) && <p className="action-error">The saved assignee is inactive or ineligible. Choose an active replacement before saving.</p>}
      {text("description", "Action Description", 2000)}{text("result", "Result", 2000)}
      <div className="action-field"><label htmlFor="action-status">Action Status</label>
        <select id="action-status" value={draft.status} disabled={disabled} onChange={e => change("status", e.target.value)}>
          {(editor.mode === "create" ? ["PLANNED", "IN_PROGRESS"] as const : actionOptions[editor.action!.status]).map(s => <option key={s} value={s}>{actionStatusLabel(s)}</option>)}
        </select></div>
      <label className="action-checkbox"><input type="checkbox" checked={draft.followUpRequired} disabled={disabled} onChange={e => change("followUpRequired", e.target.checked)} />Follow-Up Required?</label>
      {draft.followUpRequired && text("followUpNote", "Follow-up Note", 2000)}
      {text("attachmentNotes", "Attachment Notes", 1000)}
      <p className="action-meta">Attachment Notes refers to existing Ticket files. Add private details only in Internal Notes.</p>
    </>}
    {confirm ? <div className="action-confirmation" role="group" aria-label="Confirm Action Status">
      <p>{draft.status === "CANCELLED" ? "Cancel" : "Complete"} this Action? Result: {draft.result}</p>
      <div className="action-toolbar"><button className="btn-primary" type="button" disabled={saving || props.frozen} onClick={props.onConfirm}>{saving ? "Saving…" : "Confirm Action Change"}</button>
        <button className="btn-secondary" type="button" disabled={saving} onClick={props.onCancelConfirm}>Back to Form</button></div>
    </div> : <div className="action-toolbar">
      <button className="btn-primary" type="submit" disabled={saving || props.frozen || (editor.mode !== "followup" && (props.ownersLoading || Boolean(props.ownersError)))}>{saving ? "Saving…" : editor.mode === "followup" ? "Record Completion" : "Save Action"}</button>
      <button className="btn-secondary" type="button" disabled={saving} onClick={props.onCancel}>Discard Draft</button>
    </div>}
  </form>;
}
