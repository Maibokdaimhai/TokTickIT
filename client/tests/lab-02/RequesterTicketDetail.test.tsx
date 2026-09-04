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

describe("RequesterTicketDetail Component (Lab 2)", () => {
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
    attachments: [],
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

  it("FR-11: loads and displays read-only ticket details and system classification", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("ticket-number-heading")).toHaveTextContent("TKT-2026-000101");
    });

    expect(screen.getByTestId("detail-category")).toHaveTextContent("Hardware");
    expect(screen.getByTestId("detail-related-system")).toHaveTextContent("Corporate Laptop");
    expect(screen.getByTestId("detail-summary")).toHaveTextContent("Laptop battery drains quickly");
    expect(screen.getByTestId("detail-description")).toHaveTextContent("My laptop battery drains in less than an hour");
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText(/● NEW/i)).toBeInTheDocument();
  });

  it("calls onBack when clicking Back to My Tickets link", async () => {
    const onBackMock = vi.fn();
    renderComponent(101, onBackMock);

    await waitFor(() => {
      expect(screen.getByTestId("btn-back-to-tickets")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-back-to-tickets"));
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });
});
