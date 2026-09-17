import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffTicketDetail } from "../../src/components/StaffTicketDetail.js";
import * as api from "../../src/api.js";
import type { StaffTicketDetail as StaffTicketDetailType, EligibleOwner } from "../../src/types.js";

vi.mock("../../src/api.js", () => ({
  API_URL: "http://localhost:3000",
  fetchStaffTicketDetail: vi.fn(),
  fetchEligibleOwners: vi.fn(),
  claimTicket: vi.fn(),
  updateTicketOwner: vi.fn(),
  updateTicketItPriority: vi.fn(),
  updateTicketStatus: vi.fn(),
  addPublicComment: vi.fn(),
  addInternalNote: vi.fn(),
  getAttachmentDownloadUrl: vi.fn(
    (tId, aId) => `http://localhost:3000/api/tickets/${tId}/attachments/${aId}`
  ),
  downloadAttachmentByUrl: vi.fn(),
}));

describe("UI-05, UI-06, UI-09: Staff Ticket Detail Operations Component", () => {
  const mockOwners: EligibleOwner[] = [
    { id: 4, name: "Sarah Chen", email: "sarah.chen@example.com", role: "IT_STAFF" },
    { id: 5, name: "Marcus Rivera", email: "marcus.rivera@example.com", role: "IT_STAFF" },
    { id: 2, name: "Alex Morgan", email: "alex.morgan@example.com", role: "ADMINISTRATOR" },
  ];

  const sampleStaffTicket: StaffTicketDetailType = {
    id: 105,
    ticketNumber: "TKT-2026-000105",
    requesterId: 1,
    requester: {
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      department: "Accounting",
    },
    categoryId: 1,
    category: { id: 1, name: "Network" },
    relatedSystemId: 3,
    relatedSystem: { id: 3, name: "VPN Access" },
    summary: "Cannot connect to VPN from remote site",
    description: "Connection drops immediately after 2FA challenge.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    status: "NEW",
    owner: null,
    createdAt: "2026-09-03T10:00:00.000Z",
    updatedAt: "2026-09-03T10:00:00.000Z",
    version: 0,
    attachmentCount: 1,
    publicCommentCount: 1,
    attachments: [
      {
        id: 10,
        ticketId: 105,
        fileName: "10-vpn_log.txt",
        originalName: "vpn_log.txt",
        mimeType: "text/plain",
        fileSize: 2048,
        isRemoved: false,
        createdAt: "2026-09-03T10:00:00.000Z",
        downloadUrl: "/api/tickets/105/attachments/10",
      },
    ],
    publicComments: [
      {
        id: 1,
        ticketId: 105,
        content: "Please help urgent.",
        createdAt: "2026-09-03T10:05:00.000Z",
        author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
      },
    ],
    internalNotes: [
      {
        id: 2,
        ticketId: 105,
        content: "Checked RADIUS logs, IP range looks blocked.",
        createdAt: "2026-09-03T10:15:00.000Z",
        author: { id: 4, name: "Sarah Chen", role: "IT_STAFF" },
      },
    ],
    problemAppearsResolvedAt: null,
    problemAppearsResolvedById: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.fetchStaffTicketDetail as any).mockResolvedValue(sampleStaffTicket);
    (api.fetchEligibleOwners as any).mockResolvedValue({ owners: mockOwners });
  });

  const renderComponent = (ticketId = 105, onBack = vi.fn()) => {
    return render(<StaffTicketDetail ticketId={ticketId} onBack={onBack} />);
  };

  it("renders loading spinner initially, and displays error with retry on failure", async () => {
    (api.fetchStaffTicketDetail as any).mockRejectedValueOnce(new Error("Network connection dropped"));
    renderComponent();

    expect(screen.getByTestId("staff-detail-loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("staff-detail-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Network connection dropped")).toBeInTheDocument();

    // Clicking retry refetches
    (api.fetchStaffTicketDetail as any).mockResolvedValueOnce(sampleStaffTicket);
    fireEvent.click(screen.getByTestId("btn-retry-load-detail"));

    await waitFor(() => {
      expect(screen.getByTestId("staff-ticket-number-heading")).toHaveTextContent("TKT-2026-000105");
    });
  });

  it("renders 403 forbidden callout when user is not authorized", async () => {
    const error403: any = new Error("Forbidden access");
    error403.status = 403;
    (api.fetchStaffTicketDetail as any).mockRejectedValueOnce(error403);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("staff-detail-forbidden")).toBeInTheDocument();
    });
  });

  it("renders 404 not found when ticket does not exist", async () => {
    const error404: any = new Error("Ticket not found");
    error404.status = 404;
    (api.fetchStaffTicketDetail as any).mockRejectedValueOnce(error404);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("staff-detail-not-found")).toBeInTheDocument();
    });
  });

  it("displays Unassigned when ticket has no owner, and shows Claim button which claims ticket", async () => {
    const claimedTicket: StaffTicketDetailType = {
      ...sampleStaffTicket,
      owner: { id: 4, name: "Sarah Chen", email: "sarah.chen@example.com", role: "IT_STAFF" },
      status: "OPEN",
      version: 1,
    };
    (api.claimTicket as any).mockResolvedValue({ ticket: claimedTicket });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("owner-display")).toHaveTextContent("Unassigned");
    });
    expect(screen.getByTestId("btn-claim-ticket")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-claim-ticket"));

    await waitFor(() => {
      expect(api.claimTicket).toHaveBeenCalledWith(105, { expectedVersion: 0 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("owner-display")).toHaveTextContent("Sarah Chen");
    });
    // Claim button is no longer visible once assigned
    expect(screen.queryByTestId("btn-claim-ticket")).not.toBeInTheDocument();
  });

  it("disables owner selector while eligible owners are loading, and handles reassignment", async () => {
    let resolveOwners: (value: any) => void;
    (api.fetchEligibleOwners as any).mockReturnValue(
      new Promise((resolve) => {
        resolveOwners = resolve;
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("staff-ticket-number-heading")).toBeInTheDocument();
    });

    // While owners are pending, selector is disabled
    expect(screen.getByTestId("select-owner")).toBeDisabled();

    // Resolve owners
    resolveOwners!({ owners: mockOwners });

    await waitFor(() => {
      expect(screen.getByTestId("select-owner")).not.toBeDisabled();
    });

    // Select Marcus Rivera (id 5) and save
    const reassignedTicket: StaffTicketDetailType = {
      ...sampleStaffTicket,
      owner: { id: 5, name: "Marcus Rivera", email: "marcus.rivera@example.com", role: "IT_STAFF" },
      version: 1,
    };
    (api.updateTicketOwner as any).mockResolvedValue({ ticket: reassignedTicket });

    fireEvent.change(screen.getByTestId("select-owner"), { target: { value: "5" } });
    fireEvent.click(screen.getByTestId("btn-save-owner"));

    await waitFor(() => {
      expect(api.updateTicketOwner).toHaveBeenCalledWith(105, {
        ownerId: 5,
        expectedVersion: 0,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("owner-display")).toHaveTextContent("Marcus Rivera");
    });
  });

  it("refreshes eligible owners on 400 INVALID_OWNER error", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("select-owner")).not.toBeDisabled();
    });

    const invalidOwnerError: any = new Error("Selected owner is not eligible");
    invalidOwnerError.status = 400;
    (api.updateTicketOwner as any).mockRejectedValueOnce(invalidOwnerError);

    fireEvent.change(screen.getByTestId("select-owner"), { target: { value: "5" } });
    fireEvent.click(screen.getByTestId("btn-save-owner"));

    await waitFor(() => {
      expect(screen.getByTestId("owner-error-callout")).toBeInTheDocument();
    });

    // fetchEligibleOwners was called a 2nd time to refresh list
    expect(api.fetchEligibleOwners).toHaveBeenCalledTimes(2);
  });

  it("updates IT Priority and displays updated value", async () => {
    const updatedPriorityTicket: StaffTicketDetailType = {
      ...sampleStaffTicket,
      itPriority: "URGENT",
      version: 1,
    };
    (api.updateTicketItPriority as any).mockResolvedValue({ ticket: updatedPriorityTicket });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("select-it-priority")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("select-it-priority"), { target: { value: "URGENT" } });
    fireEvent.click(screen.getByTestId("btn-save-it-priority"));

    await waitFor(() => {
      expect(api.updateTicketItPriority).toHaveBeenCalledWith(105, {
        itPriority: "URGENT",
        expectedVersion: 0,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("it-priority-badge")).toHaveTextContent("URGENT");
    });
  });

  it("shows only legal next statuses and opens accessible confirmation dialog for confirmed transitions", async () => {
    // Ticket starts at NEW -> legal transitions: OPEN, CANCELLED
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("select-status")).toBeInTheDocument();
    });

    const options = screen.getByTestId("select-status").querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.value);
    expect(optionValues).toContain("OPEN");
    expect(optionValues).toContain("CANCELLED");
    expect(optionValues).not.toContain("RESOLVED");
    expect(optionValues).not.toContain("CLOSED");

    // CANCELLED requires confirmation dialog
    fireEvent.change(screen.getByTestId("select-status"), { target: { value: "CANCELLED" } });
    fireEvent.click(screen.getByTestId("btn-save-status"));

    // Modal dialog is displayed
    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("aria-modal", "true");

    const cancelledTicket: StaffTicketDetailType = {
      ...sampleStaffTicket,
      status: "CANCELLED",
      version: 1,
    };
    (api.updateTicketStatus as any).mockResolvedValue({ ticket: cancelledTicket });

    fireEvent.click(screen.getByTestId("btn-confirm-status-modal"));

    await waitFor(() => {
      expect(api.updateTicketStatus).toHaveBeenCalledWith(105, {
        status: "CANCELLED",
        expectedStatus: "NEW",
        expectedVersion: 0,
        confirmed: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-badge")).toHaveTextContent("CANCELLED");
    });
  });

  it("validates owner requirement when transitioning to IN_PROGRESS without an owner", async () => {
    // Put ticket into OPEN without owner
    (api.fetchStaffTicketDetail as any).mockResolvedValueOnce({
      ...sampleStaffTicket,
      status: "OPEN",
      owner: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("select-status")).toBeInTheDocument();
    });

    // OPEN -> IN_PROGRESS requires owner
    fireEvent.change(screen.getByTestId("select-status"), { target: { value: "IN_PROGRESS" } });
    fireEvent.click(screen.getByTestId("btn-save-status"));

    await waitFor(() => {
      expect(screen.getByTestId("status-owner-required-error")).toBeInTheDocument();
    });
    // API was NOT called
    expect(api.updateTicketStatus).not.toHaveBeenCalled();
  });

  it("handles 409 conflict error on status mutation and allows reloading ticket", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("select-status")).toBeInTheDocument();
    });

    const conflictErr: any = new Error("Ticket was modified by another user");
    conflictErr.status = 409;
    conflictErr.code = "VERSION_CONFLICT";
    (api.updateTicketStatus as any).mockRejectedValueOnce(conflictErr);

    fireEvent.change(screen.getByTestId("select-status"), { target: { value: "OPEN" } });
    fireEvent.click(screen.getByTestId("btn-save-status"));

    await waitFor(() => {
      expect(screen.getByTestId("conflict-banner")).toBeInTheDocument();
    });

    // Click reload button to clear conflict and refresh
    const refreshedTicket: StaffTicketDetailType = {
      ...sampleStaffTicket,
      version: 1,
      status: "OPEN",
    };
    (api.fetchStaffTicketDetail as any).mockResolvedValueOnce(refreshedTicket);

    fireEvent.click(screen.getByTestId("btn-reload-conflict"));

    await waitFor(() => {
      expect(screen.queryByTestId("conflict-banner")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("status-badge")).toHaveTextContent("OPEN");
  });

  it("renders distinct Public Comments and Internal Notes sections with separate composers and draft preservation", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Please help urgent.")).toBeInTheDocument();
    });
    expect(screen.getByText("Checked RADIUS logs, IP range looks blocked.")).toBeInTheDocument();

    // Internal note draft submission failure preserves draft
    (api.addInternalNote as any).mockRejectedValueOnce(new Error("Server error saving internal note"));

    fireEvent.change(screen.getByTestId("input-internal-note"), {
      target: { value: "Attempting firewall exception rule." },
    });
    fireEvent.click(screen.getByTestId("btn-submit-internal-note"));

    await waitFor(() => {
      expect(screen.getByTestId("internal-note-error")).toBeInTheDocument();
    });
    // Draft was preserved
    expect(screen.getByTestId("input-internal-note")).toHaveValue("Attempting firewall exception rule.");

    // Successful submit clears draft and reloads ticket
    const newNote = {
      id: 3,
      ticketId: 105,
      content: "Attempting firewall exception rule.",
      createdAt: "2026-09-03T10:30:00.000Z",
      author: { id: 4, name: "Sarah Chen", role: "IT_STAFF" as const },
    };
    (api.addInternalNote as any).mockResolvedValueOnce({ note: newNote });
    (api.fetchStaffTicketDetail as any).mockResolvedValueOnce({
      ...sampleStaffTicket,
      version: 1,
      internalNotes: [...sampleStaffTicket.internalNotes, newNote],
    });

    fireEvent.click(screen.getByTestId("btn-submit-internal-note"));

    await waitFor(() => {
      expect(screen.getByText("Attempting firewall exception rule.")).toBeInTheDocument();
    });
    expect(screen.getByTestId("input-internal-note")).toHaveValue("");
  });

  it("handles refresh failure rule: note saved, mutation buttons disabled, reload offered without retrying note", async () => {
    const newNote = {
      id: 4,
      ticketId: 105,
      content: "Note created but reload fails.",
      createdAt: "2026-09-03T10:40:00.000Z",
      author: { id: 4, name: "Sarah Chen", role: "IT_STAFF" as const },
    };
    (api.addInternalNote as any).mockResolvedValueOnce({ note: newNote });
    (api.fetchStaffTicketDetail as any)
      .mockResolvedValueOnce(sampleStaffTicket)
      .mockRejectedValueOnce(new Error("Reload failure"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("input-internal-note")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("input-internal-note"), {
      target: { value: "Note created but reload fails." },
    });
    fireEvent.click(screen.getByTestId("btn-submit-internal-note"));

    await waitFor(() => {
      expect(screen.getByTestId("staff-refresh-failed-banner")).toBeInTheDocument();
    });

    // Note is rendered
    expect(screen.getByText("Note created but reload fails.")).toBeInTheDocument();

    // Mutation buttons are disabled
    expect(screen.getByTestId("btn-save-it-priority")).toBeDisabled();
    expect(screen.getByTestId("btn-save-status")).toBeDisabled();

    // Reload Ticket button is available
    expect(screen.getByTestId("btn-reload-staff-ticket")).toBeInTheDocument();
  });

  it("renders attachments list without upload/remove controls, and displays removed attachments as download unavailable", async () => {
    (api.fetchStaffTicketDetail as any).mockResolvedValueOnce({
      ...sampleStaffTicket,
      attachments: [
        {
          id: 11,
          ticketId: 105,
          fileName: "11-active_spec.pdf",
          originalName: "active_spec.pdf",
          mimeType: "application/pdf",
          fileSize: 10240,
          isRemoved: false,
          createdAt: "2026-09-03T10:00:00.000Z",
          downloadUrl: "/api/tickets/105/attachments/11",
        },
        {
          id: 12,
          ticketId: 105,
          fileName: "12-old_log.txt",
          originalName: "old_log.txt",
          mimeType: "text/plain",
          fileSize: 512,
          isRemoved: true,
          removalReason: "Uploaded wrong customer log",
          removedAt: "2026-09-03T10:20:00.000Z",
          createdAt: "2026-09-03T10:00:00.000Z",
          downloadUrl: null,
        },
      ],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("active_spec.pdf")).toBeInTheDocument();
    });

    // Active attachment has download link
    expect(screen.getByTestId("btn-staff-download-11")).toBeInTheDocument();

    // Removed attachment has removal details and Download unavailable
    expect(screen.getByText("old_log.txt")).toBeInTheDocument();
    expect(screen.getByText(/Uploaded wrong customer log/)).toBeInTheDocument();
    expect(screen.getByTestId("attachment-removed-unavailable-12")).toBeInTheDocument();

    // NO upload or remove buttons should exist for staff
    expect(screen.queryByTestId("btn-add-attachment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-remove-11")).not.toBeInTheDocument();
  });

  it("handles credentialed attachment download success with relative downloadUrl resolved against API_URL", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({
      ...sampleStaffTicket,
      attachments: [
        {
          id: 11,
          ticketId: 105,
          fileName: "11-spec.pdf",
          originalName: "active_spec.pdf",
          mimeType: "application/pdf",
          fileSize: 10240,
          isRemoved: false,
          createdAt: "2026-09-03T10:00:00.000Z",
          downloadUrl: "/api/tickets/105/attachments/11",
        },
      ],
    });

    const mockBlob = new Blob(["test-bytes"], { type: "application/pdf" });
    vi.mocked(api.downloadAttachmentByUrl).mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(mockBlob),
    } as any);

    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-staff-download-11")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-staff-download-11"));

    await waitFor(() => {
      expect(api.downloadAttachmentByUrl).toHaveBeenCalledWith(
        "http://localhost:3000/api/tickets/105/attachments/11"
      );
      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/test-blob");
    });
    clickSpy.mockRestore();
  });

  it("falls back to getAttachmentDownloadUrl when active attachment downloadUrl is missing", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({
      ...sampleStaffTicket,
      attachments: [
        {
          id: 11,
          ticketId: 105,
          fileName: "11-spec.pdf",
          originalName: "active_spec.pdf",
          mimeType: "application/pdf",
          fileSize: 10240,
          isRemoved: false,
          createdAt: "2026-09-03T10:00:00.000Z",
          downloadUrl: null,
        },
      ],
    });

    const mockBlob = new Blob(["test-bytes"], { type: "application/pdf" });
    vi.mocked(api.downloadAttachmentByUrl).mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(mockBlob),
    } as any);

    const createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-staff-download-11")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-staff-download-11"));

    await waitFor(() => {
      expect(api.getAttachmentDownloadUrl).toHaveBeenCalledWith(105, 11);
      expect(api.downloadAttachmentByUrl).toHaveBeenCalledWith(
        "http://localhost:3000/api/tickets/105/attachments/11"
      );
    });
    clickSpy.mockRestore();
  });

  it("handles attachment download error with 403 ATTACHMENT_REMOVED, shows safe callout, and refreshes ticket metadata", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({
      ...sampleStaffTicket,
      attachments: [
        {
          id: 11,
          ticketId: 105,
          fileName: "11-spec.pdf",
          originalName: "active_spec.pdf",
          mimeType: "application/pdf",
          fileSize: 10240,
          isRemoved: false,
          createdAt: "2026-09-03T10:00:00.000Z",
          downloadUrl: "/api/tickets/105/attachments/11",
        },
      ],
    });

    vi.mocked(api.downloadAttachmentByUrl).mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({
        error: { code: "ATTACHMENT_REMOVED", message: "Attachment has been removed" },
      }),
    } as any);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-staff-download-11")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-staff-download-11"));

    await waitFor(() => {
      expect(screen.getByTestId("attachment-download-error")).toHaveTextContent(
        /This attachment has been removed and is no longer available/i
      );
    });

    // Metadata refresh was triggered
    expect(api.fetchStaffTicketDetail).toHaveBeenCalledTimes(2);
  });

  it("handles attachment download error with 404 missing-file, shows safe callout, and refreshes ticket metadata", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue({
      ...sampleStaffTicket,
      attachments: [
        {
          id: 11,
          ticketId: 105,
          fileName: "11-spec.pdf",
          originalName: "active_spec.pdf",
          mimeType: "application/pdf",
          fileSize: 10240,
          isRemoved: false,
          createdAt: "2026-09-03T10:00:00.000Z",
          downloadUrl: "/api/tickets/105/attachments/11",
        },
      ],
    });

    vi.mocked(api.downloadAttachmentByUrl).mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({
        error: { code: "NOT_FOUND", message: "Attachment file could not be found" },
      }),
    } as any);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-staff-download-11")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-staff-download-11"));

    await waitFor(() => {
      expect(screen.getByTestId("attachment-download-error")).toHaveTextContent(
        /Attachment file could not be found on the server/i
      );
    });

    // Metadata refresh was triggered
    expect(api.fetchStaffTicketDetail).toHaveBeenCalledTimes(2);
  });

  it("counts Unicode code points allowing emoji boundary input in public comments and internal notes", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("TKT-2026-000105")).toBeInTheDocument();
    });

    // An emoji like "🚀" has UTF-16 length of 2, but Unicode code point length of 1.
    // 2000 emojis has UTF-16 length of 4000, but code point length of 2000.
    const emoji2000 = "🚀".repeat(2000);
    expect(emoji2000.length).toBe(4000);
    expect(Array.from(emoji2000).length).toBe(2000);

    vi.mocked(api.addPublicComment).mockResolvedValue({
      comment: {
        id: 99,
        ticketId: 105,
        content: emoji2000,
        author: {
          id: 1,
          name: "Sarah Chen",
          role: "IT_STAFF",
        },
        createdAt: "2026-09-17T12:00:00.000Z",
      },
    });

    const commentInput = screen.getByPlaceholderText(/Post comment visible to requester/i);
    fireEvent.change(commentInput, { target: { value: emoji2000 } });

    // Counter shows 2000 / 2000
    expect(screen.getByText("2000 / 2000")).toBeInTheDocument();

    const submitCommentBtn = screen.getByTestId("btn-submit-staff-public-comment");
    expect(submitCommentBtn).not.toBeDisabled();
    fireEvent.click(submitCommentBtn);

    await waitFor(() => {
      expect(api.addPublicComment).toHaveBeenCalledWith(105, emoji2000);
    });
  });
});
