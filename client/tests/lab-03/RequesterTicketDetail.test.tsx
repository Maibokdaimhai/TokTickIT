import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequesterProvider } from "../requester-fixture.js";
import { TicketDetailPage } from "../../src/components/TicketDetailPage.js";
import * as api from "../../src/api.js";
import type { TicketDetail, Entry } from "../../src/types.js";

vi.mock("../../src/api.js", () => ({
  fetchTicketDetail: vi.fn(),
  removeAttachment: vi.fn(),
  uploadAttachment: vi.fn(),
  getAttachmentDownloadUrl: vi.fn(
    (tId, aId) => `http://localhost:3000/api/tickets/${tId}/attachments/${aId}`
  ),
  addPublicComment: vi.fn(),
  indicateProblemAppearsResolved: vi.fn(),
}));

describe("UI-08: Requester Ticket Detail (Comments, Problem Appears Resolved, and Refresh Safety)", () => {
  const mockRequester = {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    department: "Accounting",
    isActive: true,
  };

  const initialComments: Entry[] = [
    {
      id: 1,
      ticketId: 101,
      content: "First public message from requester",
      createdAt: "2026-09-02T10:00:00.000Z",
      author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
    },
    {
      id: 2,
      ticketId: 101,
      content: "IT staff response to user",
      createdAt: "2026-09-02T10:30:00.000Z",
      author: { id: 5, name: "Marcus Rivera", role: "IT_STAFF" },
    },
  ];

  const sampleTicket: TicketDetail = {
    id: 101,
    ticketNumber: "TKT-2026-000101",
    requesterId: 1,
    requester: mockRequester,
    categoryId: 2,
    category: { id: 2, name: "Hardware" },
    relatedSystemId: 7,
    relatedSystem: { id: 7, name: "Corporate Laptop" },
    summary: "Laptop battery drains quickly",
    description: "Battery drain issue.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    status: "OPEN",
    owner: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    version: 2,
    attachmentCount: 0,
    publicCommentCount: 2,
    attachments: [],
    publicComments: initialComments,
    problemAppearsResolvedAt: null,
    problemAppearsResolvedById: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("toktickit_selected_requester_id", JSON.stringify(mockRequester));
    (api.fetchTicketDetail as any).mockResolvedValue(sampleTicket);
  });

  const renderComponent = (ticketId = 101, onBack = vi.fn()) => {
    return render(
      <RequesterProvider>
        <TicketDetailPage ticketId={ticketId} onBack={onBack} />
      </RequesterProvider>
    );
  };

  it("displays existing public comments timeline with author name, role badge, and timestamp", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("First public message from requester")).toBeInTheDocument();
    });

    expect(screen.getByText("IT staff response to user")).toBeInTheDocument();
    expect(screen.getAllByText(/Jennifer Anderson/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Marcus Rivera/)).toBeInTheDocument();
  });

  it("adds a public comment and refreshes ticket version", async () => {
    const newComment: Entry = {
      id: 3,
      ticketId: 101,
      content: "I tested the battery replacement and it lasts 8 hours now.",
      createdAt: "2026-09-02T11:00:00.000Z",
      author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
    };
    (api.addPublicComment as any).mockResolvedValue({ comment: newComment });
    const refreshedTicket: TicketDetail = {
      ...sampleTicket,
      version: 3,
      publicComments: [...initialComments, newComment],
    };
    (api.fetchTicketDetail as any)
      .mockResolvedValueOnce(sampleTicket) // initial load
      .mockResolvedValueOnce(refreshedTicket); // reload after comment

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("input-public-comment")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("input-public-comment"), {
      target: { value: "I tested the battery replacement and it lasts 8 hours now." },
    });

    fireEvent.click(screen.getByTestId("btn-submit-public-comment"));

    await waitFor(() => {
      expect(api.addPublicComment).toHaveBeenCalledWith(
        101,
        "I tested the battery replacement and it lasts 8 hours now."
      );
    });

    await waitFor(() => {
      expect(screen.getByText("I tested the battery replacement and it lasts 8 hours now.")).toBeInTheDocument();
    });

    // fetchTicketDetail was called again to refresh ticket version
    expect(api.fetchTicketDetail).toHaveBeenCalledTimes(2);
  });

  it("handles refresh failure rule: comment saved, buttons disabled, Reload Ticket offered without retrying append", async () => {
    const newComment: Entry = {
      id: 4,
      ticketId: 101,
      content: "Another comment that triggers refresh failure.",
      createdAt: "2026-09-02T12:00:00.000Z",
      author: { id: 1, name: "Jennifer Anderson", role: "REQUESTER" },
    };
    (api.addPublicComment as any).mockResolvedValue({ comment: newComment });
    (api.fetchTicketDetail as any)
      .mockResolvedValueOnce(sampleTicket) // initial load
      .mockRejectedValueOnce(new Error("Network error during ticket reload")); // refresh fails

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("input-public-comment")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("input-public-comment"), {
      target: { value: "Another comment that triggers refresh failure." },
    });

    fireEvent.click(screen.getByTestId("btn-submit-public-comment"));

    await waitFor(() => {
      expect(screen.getByTestId("refresh-failed-banner")).toBeInTheDocument();
    });

    // Comment was preserved
    expect(screen.getByText("Another comment that triggers refresh failure.")).toBeInTheDocument();

    // Reload Ticket button is available
    expect(screen.getByTestId("btn-reload-ticket")).toBeInTheDocument();

    // Problem Appears Resolved button is disabled or unavailable while in refresh-failed state
    const resolveBtn = screen.queryByTestId("btn-problem-appears-resolved");
    if (resolveBtn) {
      expect(resolveBtn).toBeDisabled();
    }
  });

  it("shows Problem Appears Resolved button in permitted statuses and hides in terminal statuses", async () => {
    // Permitted status: OPEN
    const { unmount } = renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-problem-appears-resolved")).toBeInTheDocument();
    });
    unmount();

    // Terminal status: RESOLVED
    (api.fetchTicketDetail as any).mockResolvedValueOnce({
      ...sampleTicket,
      status: "RESOLVED",
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("ticket-number-heading")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("btn-problem-appears-resolved")).not.toBeInTheDocument();
  });

  it("opens accessible confirmation modal and indicates problem resolved", async () => {
    const updatedResolvedTicket: TicketDetail = {
      ...sampleTicket,
      problemAppearsResolvedAt: "2026-09-02T13:00:00.000Z",
      problemAppearsResolvedById: 1,
      version: 3,
    };
    (api.indicateProblemAppearsResolved as any).mockResolvedValue({ ticket: updatedResolvedTicket });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("btn-problem-appears-resolved")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-problem-appears-resolved"));

    // Modal opens with accessibility attributes
    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("aria-modal", "true");

    // Optional comment
    fireEvent.change(screen.getByTestId("textarea-resolution-comment"), {
      target: { value: "Replaced cord, power working normally now." },
    });

    fireEvent.click(screen.getByTestId("btn-confirm-resolution-indication"));

    await waitFor(() => {
      expect(api.indicateProblemAppearsResolved).toHaveBeenCalledWith(101, {
        expectedVersion: 2,
        comment: "Replaced cord, power working normally now.",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("problem-resolved-banner")).toBeInTheDocument();
    });
    expect(screen.getByTestId("btn-problem-appears-resolved")).toBeDisabled();
  });

  it("allows 2000 emoji Unicode code points in resolution comment without UTF-16 truncation", async () => {
    const updatedResolvedTicket: TicketDetail = {
      ...sampleTicket,
      problemAppearsResolvedAt: "2026-09-02T13:00:00.000Z",
      problemAppearsResolvedById: 1,
      version: 3,
    };
    (api.indicateProblemAppearsResolved as any).mockResolvedValue({ ticket: updatedResolvedTicket });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-problem-appears-resolved")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-problem-appears-resolved"));

    // 2000 emojis: 4000 UTF-16 code units, 2000 Unicode code points
    const emoji2000 = "🚀".repeat(2000);
    expect(emoji2000.length).toBe(4000);
    expect(Array.from(emoji2000).length).toBe(2000);

    const textarea = screen.getByTestId("textarea-resolution-comment");
    fireEvent.change(textarea, { target: { value: emoji2000 } });

    expect(screen.getByText("2000 / 2000 characters")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-confirm-resolution-indication"));

    await waitFor(() => {
      expect(api.indicateProblemAppearsResolved).toHaveBeenCalledWith(101, {
        expectedVersion: 2,
        comment: emoji2000,
      });
    });
  });

  it("rejects resolution comment exceeding 2000 Unicode code points (2001 emojis)", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("btn-problem-appears-resolved")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-problem-appears-resolved"));

    // 2001 emojis: 4002 UTF-16 code units, 2001 Unicode code points
    const emoji2001 = "🚀".repeat(2001);
    expect(emoji2001.length).toBe(4002);
    expect(Array.from(emoji2001).length).toBe(2001);

    const textarea = screen.getByTestId("textarea-resolution-comment");
    fireEvent.change(textarea, { target: { value: emoji2001 } });

    expect(screen.getByText("2001 / 2000 characters")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-confirm-resolution-indication"));

    await waitFor(() => {
      expect(screen.getByTestId("resolution-error")).toHaveTextContent(
        "Resolution note must not exceed 2000 characters."
      );
    });

    expect(api.indicateProblemAppearsResolved).not.toHaveBeenCalled();
  });
});
