import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TicketHistory, ResolutionSummary } from "../../src/components/TicketHistory.js";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail.js";
import * as api from "../../src/api.js";
import * as workflow from "../../src/workflow-api.js";
import type { StaffTicketDetail as Detail, TicketHistoryPage, AuthUser } from "../../src/types.js";
import { actionDraft, validateActionDraft } from "../../src/utils/action-form.js";

vi.mock("../../src/workflow-api.js", () => ({ fetchTicketHistory: vi.fn() }));
vi.mock("../../src/api.js", async original => ({ ...await original<typeof api>(), fetchStaffTicketDetail: vi.fn(), fetchEligibleOwners: vi.fn(), updateTicketStatus: vi.fn() }));
vi.mock("../../src/components/ActionsTaken.js", () => ({ ActionsTaken: ({ onTicketChanged }: { onTicketChanged: () => Promise<void> }) => <section className="actions-taken" aria-label="Actions Taken"><h2 tabIndex={-1}>Actions Taken</h2><button onClick={() => { void onTicketChanged(); }}>Simulate Saved Action</button></section> }));
const staff: AuthUser = { id: 7, name: "Alex Staff", email: "alex@example.com", role: "IT_STAFF", isActive: true };
const detail: Detail = { id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1, requester: { id: 1, name: "Requester", email: "requester@example.com" }, categoryId: 1, category: { id: 1, name: "Network" }, relatedSystemId: 1, relatedSystem: { id: 1, name: "Wi-Fi" }, summary: "Connection problem", description: "Original details", requestedPriority: "HIGH", itPriority: "HIGH", status: "OPEN", version: 1, owner: { ...staff, role: "IT_STAFF" }, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", attachments: [], publicComments: [], internalNotes: [] };
const history: TicketHistoryPage = { events: [{ id: 1, ticketId: 1, fromStatus: "NEW", toStatus: "OPEN", actor: staff, createdAt: "2026-10-27T01:00:00Z", ticketVersion: 1 }], pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 }, historyStartsAt: "2026-10-27T00:00:00Z" };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(workflow.fetchTicketHistory).mockResolvedValue(history);
  vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail);
  vi.mocked(api.fetchEligibleOwners).mockResolvedValue({ owners: [{ ...staff, role: "IT_STAFF" }] });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
async function resolveDialog() {
  await screen.findByTestId("select-status");
  await act(async () => { fireEvent.change(screen.getByLabelText("Next Status"), { target: { value: "RESOLVED" } }); fireEvent.click(screen.getByTestId("btn-save-status")); });
  await screen.findByRole("dialog"); await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm Status Change" })));
}
describe("Lab 4 workflow feedback and public history", () => {
  it("shows actionable resolution blockers instead of treating them as a stale-write conflict", async () => {
    vi.mocked(api.updateTicketStatus).mockRejectedValue(new api.ApiClientError("Finish work", 409, "RESOLUTION_BLOCKED", [{ field: "followUp", message: "Record the outstanding follow-up completion." }]));
    render(<StaffTicketDetail ticketId={1} actor={staff} onBack={vi.fn()} />); await resolveDialog();
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText("Record the outstanding follow-up completion.");
    expect(screen.queryByTestId("conflict-banner")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Review Actions Taken" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Actions Taken" })).toHaveFocus());
  });
  it("refreshes summary, actual resolution time and history after successful formal resolution", async () => {
    vi.mocked(api.updateTicketStatus).mockResolvedValue({ ticket: { ...detail, status: "RESOLVED", version: 2, resolvedAt: "2026-10-27T02:00:00Z", resolvedAtEstimated: false } });
    render(<StaffTicketDetail ticketId={1} actor={staff} onBack={vi.fn()} />); await resolveDialog();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/^Resolved /)).toBeInTheDocument();
    expect(screen.getByLabelText("Next Status")).toHaveValue("CLOSED");
    await waitFor(() => expect(workflow.fetchTicketHistory).toHaveBeenCalledTimes(2));
  });
  it("retains the stale-write conflict behavior for genuine version conflicts", async () => {
    vi.mocked(api.updateTicketStatus).mockRejectedValue(new api.ApiClientError("Ticket version changed", 409, "VERSION_CONFLICT"));
    render(<StaffTicketDetail ticketId={1} actor={staff} onBack={vi.fn()} />); await resolveDialog();
    await screen.findByText(/Ticket version changed/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Review Actions Taken" })).not.toBeInTheDocument();
  });
  it("explains legacy resolution estimates and removes the summary on reopening", () => {
    const view = render(<ResolutionSummary status="CLOSED" resolvedAt="2026-01-02T00:00:00Z" estimated />);
    expect(screen.getByRole("status")).toHaveTextContent("Estimated from the legacy record");
    view.rerender(<ResolutionSummary status="REOPENED" resolvedAt={null} />); expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("does not invent a resolution timestamp when legacy time is unknown", () => {
    render(<ResolutionSummary status="RESOLVED" resolvedAt={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Resolution time is not available");
  });
  it("shows read-only, ordered Ticket transitions with the migration boundary", async () => {
    render(<TicketHistory ticketId={1} refreshKey={1} />);
    expect(await screen.findByText("New → Open")).toBeInTheDocument();
    expect(screen.getByText(/History available since/)).toHaveTextContent("Earlier transitions were not backfilled");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /Delete|Edit/ })).not.toBeInTheDocument();
  });
  it("paginates history with an abortable scoped request", async () => {
    vi.mocked(workflow.fetchTicketHistory).mockResolvedValue({ ...history, pagination: { ...history.pagination, totalItems: 11, totalPages: 2 } });
    render(<TicketHistory ticketId={1} refreshKey={1} />); await screen.findByText("New → Open");
    fireEvent.click(screen.getByRole("button", { name: "Next Ticket History Page" }));
    await waitFor(() => expect(workflow.fetchTicketHistory).toHaveBeenLastCalledWith(1, 2, expect.any(AbortSignal)));
  });
  it("distinguishes unavailable history from an honest empty legacy history", async () => {
    vi.mocked(workflow.fetchTicketHistory).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({ ...history, events: [], pagination: { ...history.pagination, totalItems: 0, totalPages: 0 } });
    render(<TicketHistory ticketId={1} refreshKey={1} />);
    await screen.findByRole("alert"); expect(screen.queryByText("No recorded Ticket transitions yet.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Ticket History" }));
    expect(await screen.findByText("No recorded Ticket transitions yet.")).toBeInTheDocument();
  });
  it("ignores a late history response from the previous Ticket", async () => {
    let finish!: (value: TicketHistoryPage) => void;
    vi.mocked(workflow.fetchTicketHistory).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...history, events: [] });
    const view = render(<TicketHistory ticketId={1} refreshKey={1} />); view.rerender(<TicketHistory ticketId={2} refreshKey={0} />);
    await screen.findByText("No recorded Ticket transitions yet."); await act(async () => finish(history));
    expect(screen.queryByText("New → Open")).not.toBeInTheDocument();
  });
  it("keeps a same-second Action timestamp at or after Ticket creation", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T02:00:00.789Z"));
    const draft = actionDraft(undefined, 7); draft.description = "Inspect newly created Ticket";
    expect(validateActionDraft(draft, "2026-10-27T02:00:00.500Z", [7])).toEqual({});
  });
  it("retains a legal selected status and pauses controls while the Action summary refreshes", async () => {
    let finish!: (value: Detail) => void;
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValueOnce(detail).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<StaffTicketDetail ticketId={1} actor={staff} onBack={vi.fn()} />);
    const status = await screen.findByLabelText('Next Status');
    fireEvent.change(status, { target: { value: 'RESOLVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Saved Action' }));
    expect(status).toBeDisabled(); expect(screen.getByTestId('btn-save-status')).toBeDisabled();
    await act(async () => finish({ ...detail, version: 2 }));
    expect(status).not.toBeDisabled(); expect(status).toHaveValue('RESOLVED');
  });
});
