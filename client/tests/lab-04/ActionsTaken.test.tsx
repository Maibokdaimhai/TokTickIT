import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ActionsTaken } from "../../src/components/ActionsTaken.js";
import * as api from "../../src/actions-api.js";
import * as shared from "../../src/api.js";
import type { AuthUser, TicketAction } from "../../src/types.js";

vi.mock("../../src/actions-api.js", () => ({ fetchActions: vi.fn(), fetchAction: vi.fn(), fetchActionRevisions: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(), completeActionFollowUp: vi.fn() }));
vi.mock("../../src/api.js", async importOriginal => ({ ...await importOriginal<typeof shared>(), fetchEligibleOwners: vi.fn() }));
const actor: AuthUser = { id: 7, name: "Alex Staff", email: "alex@example.com", role: "IT_STAFF", isActive: true };
const action: TicketAction = { id: 4, ticketId: 1, actionAt: "2026-01-02T02:00:00Z", description: "Investigate Wi-Fi", result: null,
  performedBy: actor, assignee: { ...actor, id: 8, name: "Jamie Staff" }, status: "IN_PROGRESS", version: 0,
  followUpRequired: false, followUpNote: null, attachmentNotes: null, followUpCompletedAt: null, followUpCompletedBy: null, followUpCompletionNote: null,
  createdAt: "2026-01-02T02:00:00Z", updatedAt: "2026-01-02T02:00:00Z" };
const pagination = { page: 1, limit: 10, totalItems: 1, totalPages: 1 };
const renderActions = (extra: Partial<React.ComponentProps<typeof ActionsTaken>> = {}) => render(<ActionsTaken ticketId={1} ticketStatus="OPEN" ticketCreatedAt="2026-01-01T00:00:00Z" ticketVersion={1} actor={actor} onTicketChanged={vi.fn().mockResolvedValue(undefined)} {...extra} />);
async function openCreate() {
  await screen.findByText("Investigate Wi-Fi"); fireEvent.click(screen.getByRole("button", { name: "New Action" }));
  await screen.findByRole("option", { name: "Jamie Staff" });
  fireEvent.change(screen.getByLabelText("Action Description"), { target: { value: "Inspect router" } });
}
async function openEdit() {
  await screen.findByText("Investigate Wi-Fi"); fireEvent.click(screen.getByRole("button", { name: "Edit Action #4" }));
  await screen.findByRole("option", { name: "Jamie Staff" });
}
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState(null, "", "/staff/tickets/1");
  vi.mocked(api.fetchActions).mockResolvedValue({ actions: [action], pagination, ticketVersion: 1 });
  vi.mocked(api.fetchAction).mockResolvedValue({ action, ticketVersion: 1 });
  vi.mocked(api.fetchActionRevisions).mockResolvedValue({ revisions: [], pagination: { ...pagination, totalItems: 0, totalPages: 0 } });
  vi.mocked(shared.fetchEligibleOwners).mockResolvedValue({ owners: [{ ...actor, role: "IT_STAFF" }, { ...actor, role: "IT_STAFF", id: 8, name: "Jamie Staff" }] });
});
describe("Lab 4 Actions Taken UI", () => {
  it("shows all action fields and independent identities to Requesters without write controls", async () => {
    renderActions({ actor: undefined });
    expect(await screen.findByText("Investigate Wi-Fi")).toBeInTheDocument();
    expect(screen.getByText("Alex Staff")).toBeInTheDocument(); expect(screen.getByText("Jamie Staff")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Action #4" })).not.toBeInTheDocument();
  });
  it("creates with the automatic performer, selected assignee and explicit Bangkok time", async () => {
    vi.mocked(api.createAction).mockResolvedValue({ action: { ...action, id: 5 }, ticketVersion: 2 });
    renderActions(); await screen.findByText("Investigate Wi-Fi");
    fireEvent.click(screen.getByRole("button", { name: "New Action" }));
    await screen.findByRole("option", { name: "Jamie Staff" });
    fireEvent.change(screen.getByLabelText("Action Description"), { target: { value: "Inspect router" } });
    fireEvent.change(screen.getByLabelText("Assigned to"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Action Date/Time (Asia/Bangkok)"), { target: { value: "2026-01-02T09:00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledWith(1, expect.objectContaining({ description: "Inspect router", assigneeId: 8, actionAt: "2026-01-02T02:00:00.000Z", expectedTicketVersion: 1, clientRequestId: expect.any(String) })));
    expect(screen.getByRole("status")).toHaveTextContent("Action saved");
  });
  it("validates required description and follow-up note with field-linked errors", async () => {
    renderActions(); await openCreate();
    fireEvent.change(screen.getByLabelText("Action Description"), { target: { value: " " } });
    fireEvent.click(screen.getByLabelText("Follow-Up Required?"));
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByLabelText("Action Description")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Follow-up Note")).toHaveAttribute("aria-invalid", "true");
    expect(api.createAction).not.toHaveBeenCalled();
  });
  it("requires a result and explicit confirmation before completing an Action", async () => {
    vi.mocked(api.updateAction).mockResolvedValue({ action: { ...action, status: "COMPLETED", result: "Fixed", version: 1 }, ticketVersion: 2 });
    renderActions(); await openEdit();
    fireEvent.change(screen.getByLabelText("Action Status"), { target: { value: "COMPLETED" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByLabelText("Result")).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "Fixed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(api.updateAction).not.toHaveBeenCalled(); expect(screen.getByRole("group", { name: "Confirm Action Status" })).toHaveTextContent("Complete this Action?");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Action Change" }));
    await waitFor(() => expect(api.updateAction).toHaveBeenCalledWith(1, 4, expect.objectContaining({ status: "COMPLETED", result: "Fixed", expectedTicketVersion: 1, expectedActionVersion: 0 })));
  });
  it("confirms cancellation with a result instead of deleting work", async () => {
    vi.mocked(api.updateAction).mockResolvedValue({ action: { ...action, status: "CANCELLED", result: "Duplicate task", version: 1 }, ticketVersion: 2 });
    renderActions(); await openEdit();
    fireEvent.change(screen.getByLabelText("Action Status"), { target: { value: "CANCELLED" } });
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "Duplicate task" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByRole("group", { name: "Confirm Action Status" })).toHaveTextContent("Cancel this Action?");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Action Change" }));
    await waitFor(() => expect(api.updateAction).toHaveBeenCalledWith(1, 4, expect.objectContaining({ status: "CANCELLED" })));
  });
  it("reuses the exact create request and UUID after an uncertain failure", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new TypeError("Network unavailable")).mockResolvedValueOnce({ action, ticketVersion: 2, replayed: true });
    renderActions(); await openCreate(); fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText(/The create request may have succeeded/)).toBeInTheDocument();
    expect(screen.getByLabelText("Action Description")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.createAction).mock.calls[0][1]).toEqual(vi.mocked(api.createAction).mock.calls[1][1]);
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
  });
  it("retains editable fields after a validation rejection", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new shared.ApiClientError("Assignee became inactive", 400, "INVALID_ASSIGNEE"));
    renderActions(); await openCreate(); fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText("Assignee became inactive")).toBeInTheDocument();
    expect(screen.getByLabelText("Action Description")).toHaveValue("Inspect router"); expect(screen.getByLabelText("Action Description")).not.toBeDisabled();
  });
  it("prevents repeated submissions while a save is pending", async () => {
    let finish!: (value: {action: TicketAction; ticketVersion:number}) => void;
    vi.mocked(api.createAction).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    renderActions(); await openCreate();
    fireEvent.submit(screen.getByRole("form", { name: "New Action" })); fireEvent.submit(screen.getByRole("form", { name: "New Action" }));
    expect(api.createAction).toHaveBeenCalledTimes(1);
    await act(async () => finish({ action, ticketVersion: 2 }));
  });
  it("preserves the draft and requires explicit version reconciliation after a conflict", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new shared.ApiClientError("Action changed", 409, "VERSION_CONFLICT")).mockResolvedValueOnce({ action: { ...action, version: 3 }, ticketVersion: 4 });
    vi.mocked(api.fetchActions).mockResolvedValueOnce({ actions: [action], pagination, ticketVersion: 1 }).mockResolvedValue({ actions: [{ ...action, version: 2, description: "Latest saved work" }], pagination, ticketVersion: 3 });
    vi.mocked(api.fetchAction).mockResolvedValue({ action: { ...action, version: 2, description: "Latest saved work" }, ticketVersion: 3 });
    renderActions(); await openEdit(); fireEvent.change(screen.getByLabelText("Action Description"), { target: { value: "My preserved draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    const reconcile = await screen.findByRole("button", { name: "Use Latest Versions and Review Draft" });
    expect(screen.getByLabelText("Action Description")).toHaveValue("My preserved draft"); expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled();
    expect(api.updateAction).toHaveBeenCalledTimes(1);
    fireEvent.click(reconcile); fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.updateAction).toHaveBeenLastCalledWith(1, 4, expect.objectContaining({ description: "My preserved draft", expectedTicketVersion: 3, expectedActionVersion: 2 })));
  });
  it("keeps terminal actions read-only and records completion of their pending follow-up separately", async () => {
    const completed: TicketAction = { ...action, status: "COMPLETED", result: "Fixed", followUpRequired: true, followUpNote: "Confirm with Requester", version: 1 };
    vi.mocked(api.fetchActions).mockResolvedValue({ actions: [completed], pagination, ticketVersion: 2 });
    const finished = { ...completed, followUpRequired: false, followUpCompletionNote: "Requester confirmed", followUpCompletedAt: "2026-01-03T02:00:00Z", followUpCompletedBy: actor, version: 2 };
    vi.mocked(api.completeActionFollowUp).mockResolvedValue({ action: finished, ticketVersion: 3 });
    vi.mocked(api.fetchAction).mockResolvedValue({ action: finished, ticketVersion: 3 });
    renderActions(); await screen.findByText("Fixed");
    expect(screen.queryByRole("button", { name: "Edit Action #4" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record Follow-up Completion for Action #4" }));
    expect(shared.fetchEligibleOwners).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Completion Note"), { target: { value: "Requester confirmed" } });
    fireEvent.click(screen.getByRole("button", { name: "Record Completion" }));
    await waitFor(() => expect(api.completeActionFollowUp).toHaveBeenCalledWith(1, 4, { completionNote: "Requester confirmed", expectedTicketVersion: 2, expectedActionVersion: 1 }));
    expect(await screen.findByText("Follow-up completion recorded. The original work and history are preserved.")).toBeInTheDocument();
    expect(screen.getByText("Requester confirmed")).toBeInTheDocument(); expect(api.updateAction).not.toHaveBeenCalled();
  });
  it("does not offer writes on frozen Tickets", async () => {
    renderActions({ ticketStatus: "CLOSED" }); await screen.findByText("Investigate Wi-Fi");
    expect(screen.queryByRole("button", { name: "New Action" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Edit Action #4" })).not.toBeInTheDocument();
  });
  it("retains a draft while eligible staff are unavailable and allows retry", async () => {
    vi.mocked(shared.fetchEligibleOwners).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({ owners: [{ ...actor, role: "IT_STAFF" }] });
    renderActions(); await screen.findByText("Investigate Wi-Fi"); fireEvent.click(screen.getByRole("button", { name: "New Action" }));
    expect(await screen.findByRole("button", { name: "Retry Eligible Staff" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Action Description"), { target: { value: "My draft" } });
    expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry Eligible Staff" }));
    await screen.findByRole("option", { name: "Alex Staff" }); expect(screen.getByLabelText("Action Description")).toHaveValue("My draft");
  });
  it("loads a selected Action directly even when it is not on the current page", async () => {
    window.history.replaceState(null, "", "/staff/tickets/1?actionId=99");
    vi.mocked(api.fetchAction).mockResolvedValue({ action: { ...action, id: 99, description: "Selected work from another page" }, ticketVersion: 2 });
    renderActions(); expect(await screen.findByText("Selected work from another page")).toBeInTheDocument();
    expect(api.fetchAction).toHaveBeenCalledWith(1, 99, expect.any(AbortSignal));
  });
  it("shows history snapshots read-only and supports pagination", async () => {
    const revision = { id: 1, actionId: 4, version: 0, editor: actor, createdAt: action.createdAt, snapshot: { actionAt: action.actionAt, description: "Original description", result: null, performedById: 7, assigneeId: 8, status: "IN_PROGRESS" as const, followUpRequired: true, followUpNote: "Original pending note", attachmentNotes: null, followUpCompletedAt: null, followUpCompletedById: null, followUpCompletionNote: null } };
    vi.mocked(api.fetchActionRevisions).mockResolvedValue({ revisions: [revision], pagination: { ...pagination, totalItems: 11, totalPages: 2 } });
    renderActions({ actor: undefined }); await screen.findByText("Investigate Wi-Fi");
    fireEvent.click(screen.getByRole("button", { name: "View History for Action #4" }));
    expect(await screen.findByText("Original pending note")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "History of Action #4" })).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next History Page" }));
    await waitFor(() => expect(api.fetchActionRevisions).toHaveBeenLastCalledWith(1, 4, 2, expect.any(AbortSignal)));
  });
  it("warns before navigation discards a dirty draft and clears private content on session expiry", async () => {
    const confirmation = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderActions(); await openCreate();
    expect(window.dispatchEvent(new Event("app:before-navigate", { cancelable: true }))).toBe(false);
    expect(confirmation).toHaveBeenCalled(); expect(screen.getByLabelText("Action Description")).toHaveValue("Inspect router");
    act(() => window.dispatchEvent(new Event("auth:expired")));
    expect(screen.queryByText("Investigate Wi-Fi")).not.toBeInTheDocument(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("shows saved success separately from a failed Ticket-summary refresh", async () => {
    vi.mocked(api.createAction).mockResolvedValue({ action, ticketVersion: 2 });
    const onTicketChanged = vi.fn().mockRejectedValueOnce(new Error("Summary unavailable")).mockResolvedValue(undefined);
    renderActions({ onTicketChanged }); await openCreate(); fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    const retry = await screen.findByRole("button", { name: "Retry Ticket Summary" });
    expect(screen.getByText("Action saved.")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "New Action" })).toBeDisabled();
    fireEvent.click(retry); await waitFor(() => expect(screen.queryByRole("button", { name: "Retry Ticket Summary" })).not.toBeInTheDocument());
    expect(api.createAction).toHaveBeenCalledTimes(1);
  });
  it("requires replacing an inactive or unavailable assignee before editing", async () => {
    vi.mocked(shared.fetchEligibleOwners).mockResolvedValue({ owners: [{ ...actor, role: 'IT_STAFF' }] });
    renderActions(); await screen.findByText('Investigate Wi-Fi'); fireEvent.click(screen.getByRole('button', { name: 'Edit Action #4' }));
    await screen.findByText('The saved assignee is inactive or ineligible. Choose an active replacement before saving.');
    fireEvent.change(screen.getByLabelText('Action Description'), { target: { value: 'Reassigned investigation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Action' }));
    expect(screen.getByLabelText('Assigned to')).toHaveAttribute('aria-invalid', 'true'); expect(api.updateAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Assigned to'), { target: { value: '7' } });
    expect(screen.getByLabelText('Assigned to')).toHaveValue('7');
  });
  it("paginates the list without mixing earlier page contents", async () => {
    vi.mocked(api.fetchActions).mockResolvedValueOnce({ actions: [action], ticketVersion: 1, pagination: { ...pagination, totalItems: 11, totalPages: 2 } })
      .mockResolvedValue({ actions: [{ ...action, id: 5, description: 'Second page work' }], ticketVersion: 1, pagination: { ...pagination, page: 2, totalItems: 11, totalPages: 2 } });
    renderActions({ actor: undefined }); await screen.findByText('Investigate Wi-Fi');
    fireEvent.click(screen.getByRole('button', { name: 'Next Actions Page' }));
    expect(await screen.findByText('Second page work')).toBeInTheDocument(); expect(screen.queryByText('Investigate Wi-Fi')).not.toBeInTheDocument();
    expect(api.fetchActions).toHaveBeenLastCalledWith(1, 2, expect.any(AbortSignal));
  });
  it("ignores a late response after moving to another Ticket", async () => {
    let finish!: (value: {actions: TicketAction[]; pagination: typeof pagination; ticketVersion:number}) => void;
    vi.mocked(api.fetchActions).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue({ actions: [{ ...action, ticketId: 2, id: 9, description: 'Current Ticket work' }], pagination, ticketVersion: 1 });
    const view = renderActions({ actor: undefined });
    view.rerender(<ActionsTaken ticketId={2} ticketStatus="OPEN" ticketCreatedAt="2026-01-01T00:00:00Z" ticketVersion={1} onTicketChanged={vi.fn().mockResolvedValue(undefined)} />);
    await screen.findByText('Current Ticket work');
    await act(async () => finish({ actions: [action], pagination, ticketVersion: 1 }));
    expect(screen.queryByText('Investigate Wi-Fi')).not.toBeInTheDocument(); expect(screen.getByText('Current Ticket work')).toBeInTheDocument();
  });
  it("shows a safe list failure and retries without inventing empty data", async () => {
    vi.mocked(api.fetchActions).mockRejectedValueOnce(new Error('Unavailable'));
    renderActions({ actor: undefined }); await screen.findByText('Unable to load Actions Taken. Try again.');
    expect(screen.queryByText('No Actions Taken have been recorded yet.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Actions' }));
    expect(await screen.findByText('Investigate Wi-Fi')).toBeInTheDocument();
  });
});
