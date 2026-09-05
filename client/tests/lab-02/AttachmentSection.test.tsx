import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import { TicketDetailPage } from "../../src/components/TicketDetailPage.js";
import * as api from "../../src/api.js";
import { TicketDetail } from "../../src/types.js";

vi.mock("../../src/api.js", () => ({
  fetchRequesters: vi.fn(),
  fetchTicketDetail: vi.fn(),
  removeAttachment: vi.fn(),
  uploadAttachment: vi.fn(),
  getAttachmentDownloadUrl: vi.fn(
    (tId, aId, rId) => `http://localhost:3000/api/tickets/${tId}/attachments/${aId}?requesterId=${rId}`
  ),
}));

describe("AttachmentSection Component (Lab 2)", () => {
  const mockRequester = {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    department: "Accounting",
    isActive: true,
  };

  const sampleTicketDetail: TicketDetail = {
    id: 101,
    ticketNumber: "TKT-2026-000101",
    requesterId: 1,
    requester: mockRequester,
    categoryId: 2,
    category: { id: 2, name: "Hardware" },
    relatedSystemId: 7,
    relatedSystem: { id: 7, name: "Corporate Laptop" },
    summary: "Laptop battery drains quickly",
    description: "My laptop battery drains in less than an hour even when idling.",
    requestedPriority: "HIGH",
    status: "NEW",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    attachments: [
      {
        id: 11,
        ticketId: 101,
        fileName: "battery-diag.pdf",
        originalName: "battery-diag.pdf",
        mimeType: "application/pdf",
        fileSize: 204800,
        isRemoved: false,
        removalReason: null,
        removedAt: null,
        createdAt: "2026-09-01T10:05:00.000Z",
      },
      {
        id: 12,
        ticketId: 101,
        fileName: "old-screenshot.png",
        originalName: "old-screenshot.png",
        mimeType: "image/png",
        fileSize: 102400,
        isRemoved: true,
        removalReason: "Uploaded wrong screenshot by mistake",
        removedAt: "2026-09-01T10:15:00.000Z",
        createdAt: "2026-09-01T10:02:00.000Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    localStorage.setItem("toktickit_selected_requester_id", JSON.stringify(mockRequester));
    (api.fetchRequesters as any).mockResolvedValue([mockRequester]);
    (api.fetchTicketDetail as any).mockResolvedValue(sampleTicketDetail);
  });

  const renderComponent = (ticketId = 101, onBack = vi.fn()) => {
    return render(
      <RequesterProvider>
        <TicketDetailPage ticketId={ticketId} onBack={onBack} />
      </RequesterProvider>
    );
  };

  it("FR-12: renders active attachment with download action and soft-removed attachment with reason", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("attachment-active-11")).toBeInTheDocument();
    });

    // Active attachment
    expect(screen.getByText("battery-diag.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("btn-download-11")).toBeInTheDocument();
    expect(screen.getByTestId("btn-remove-11")).toBeInTheDocument();

    // Removed attachment
    expect(screen.getByTestId("attachment-removed-12")).toBeInTheDocument();
    expect(screen.getByText("old-screenshot.png")).toBeInTheDocument();
    expect(screen.getByText(/Uploaded wrong screenshot by mistake/i)).toBeInTheDocument();
    expect(screen.getByText("Download unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-download-12")).not.toBeInTheDocument();
  });

  it("UI-06 / AC-08: opens soft removal modal and requires at least 3 characters for removal reason", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("btn-remove-11")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-remove-11"));

    expect(screen.getByTestId("soft-remove-modal")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("btn-confirm-removal");
    const reasonTextarea = screen.getByTestId("removal-reason-textarea");

    expect(confirmBtn).toBeDisabled();

    fireEvent.change(reasonTextarea, { target: { value: "ab" } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(reasonTextarea, { target: { value: "Wrong document version" } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("UI-06 / AC-07: successfully submits soft removal with valid reason and updates attachment card", async () => {
    const updatedAtt = {
      id: 11,
      ticketId: 101,
      fileName: "battery-diag.pdf",
      originalName: "battery-diag.pdf",
      mimeType: "application/pdf",
      fileSize: 204800,
      isRemoved: true,
      removalReason: "Document contained sensitive personal notes",
      removedAt: "2026-09-01T11:00:00.000Z",
      createdAt: "2026-09-01T10:05:00.000Z",
    };

    (api.removeAttachment as any).mockResolvedValue(updatedAtt);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("btn-remove-11")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-remove-11"));

    const reasonTextarea = screen.getByTestId("removal-reason-textarea");
    fireEvent.change(reasonTextarea, {
      target: { value: "Document contained sensitive personal notes" },
    });

    fireEvent.click(screen.getByTestId("btn-confirm-removal"));

    await waitFor(() => {
      expect(api.removeAttachment).toHaveBeenCalledWith(
        101,
        11,
        1,
        "Document contained sensitive personal notes"
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId("soft-remove-modal")).not.toBeInTheDocument();
      expect(screen.getByTestId("attachment-removed-11")).toBeInTheDocument();
      expect(screen.getByText(/Document contained sensitive personal notes/i)).toBeInTheDocument();
    });
  });

  it("BR-08: shows attachment limit indicator when 5 active attachments exist", async () => {
    const fiveAttachmentsTicket: TicketDetail = {
      ...sampleTicketDetail,
      attachments: Array.from({ length: 5 }).map((_, i) => ({
        id: 20 + i,
        ticketId: 101,
        fileName: `file-${i + 1}.pdf`,
        originalName: `file-${i + 1}.pdf`,
        mimeType: "application/pdf",
        fileSize: 50000,
        isRemoved: false,
        removalReason: null,
        removedAt: null,
        createdAt: "2026-09-01T10:00:00.000Z",
      })),
    };

    (api.fetchTicketDetail as any).mockResolvedValue(fiveAttachmentsTicket);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("attachment-limit-notice")).toHaveTextContent(
        "Attachment limit reached (5/5)"
      );
    });

    expect(screen.queryByTestId("btn-add-attachment")).not.toBeInTheDocument();
  });
});
