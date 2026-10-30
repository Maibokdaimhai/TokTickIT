import type { ActionFields, ActionStatus, TicketAction } from "../types.js";

export interface ActionDraft {
  actionAt: string; description: string; assigneeId: string; status: ActionStatus;
  result: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string;
}
export const actionStatusLabel = (value: ActionStatus) => ({ PLANNED: "Planned", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" })[value];
export const actionOptions: Record<ActionStatus, ActionStatus[]> = { PLANNED: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
export const bangkokInput = (date: string | Date) => new Date(new Date(date).getTime() + 7 * 3600000).toISOString().slice(0, 23);
export const bangkokDate = (date: string) => new Date(date).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) + " (Bangkok)";
export function actionDraft(action?: TicketAction, actorId?: number): ActionDraft {
  return action ? { actionAt: bangkokInput(action.actionAt), description: action.description, assigneeId: String(action.assignee.id), status: action.status,
    result: action.result ?? "", followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", attachmentNotes: action.attachmentNotes ?? "" } :
    { actionAt: bangkokInput(new Date()), description: "", assigneeId: actorId ? String(actorId) : "", status: "PLANNED", result: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" };
}
export function validateActionDraft(draft: ActionDraft, ticketCreatedAt: string, eligibleIds: number[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, max] of [["description", 2000], ["result", 2000], ["followUpNote", 2000], ["attachmentNotes", 1000]] as const) {
    if (Array.from(draft[key].trim()).length > max) errors[key] = `Use at most ${max} characters.`;
  }
  if (!draft.description.trim()) errors.description = "Enter an action description.";
  if (draft.followUpRequired && !draft.followUpNote.trim()) errors.followUpNote = "Enter the required follow-up note.";
  if (["COMPLETED", "CANCELLED"].includes(draft.status) && !draft.result.trim()) errors.result = "Enter a result before completing or cancelling work.";
  if (!/^\d+$/.test(draft.assigneeId) || !eligibleIds.includes(Number(draft.assigneeId))) errors.assigneeId = "Choose an active IT Staff member or Administrator.";
  const date = new Date(`${draft.actionAt}+07:00`);
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(draft.actionAt);
  const normalizedInput = parts ? `${parts[1]}:${parts[2] ?? "00"}.${(parts[3] ?? "").padEnd(3, "0")}` : "";
  if (!parts || !Number.isFinite(date.getTime()) || bangkokInput(date) !== normalizedInput || date < new Date(ticketCreatedAt) || date > new Date()) errors.actionAt = "Use a valid Bangkok date/time between Ticket creation and now.";
  return errors;
}
export function actionPayload(draft: ActionDraft): ActionFields {
  return { ...draft, actionAt: new Date(`${draft.actionAt}+07:00`).toISOString(), description: draft.description.trim(), assigneeId: Number(draft.assigneeId),
    result: draft.result.trim() || null, followUpNote: draft.followUpRequired ? draft.followUpNote.trim() || null : null, attachmentNotes: draft.attachmentNotes.trim() || null };
}
