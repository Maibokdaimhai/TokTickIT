import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import { MyTicketsPage } from "../../src/components/MyTicketsPage.js";
import * as api from "../../src/api.js";

// Mock API module
vi.mock("../../src/api.js", () => ({
  fetchCategories: vi.fn(),
  fetchRequesters: vi.fn(),
  fetchMyTickets: vi.fn(),
}));

describe("MyTicketsPage Component (Lab 2)", () => {
  const mockCategories = [
    { id: 1, name: "Hardware" },
    { id: 2, name: "Software" },
  ];

  const mockRequester = {
    id: 1,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    department: "Accounting",
    isActive: true,
  };

  const sampleTickets = [
    {
      id: 101,
      ticketNumber: "TKT-2026-000101",
      summary: "Laptop keyboard not responding",
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 7, name: "Corporate Laptop" },
      requestedPriority: "HIGH" as const,
      status: "NEW" as const,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
      attachmentCount: 2,
    },
    {
      id: 102,
      ticketNumber: "TKT-2026-000102",
      summary: "VPN access expired after password change",
      category: { id: 2, name: "Software" },
      relatedSystem: { id: 3, name: "VPN" },
      requestedPriority: "MEDIUM" as const,
      status: "IN_PROGRESS" as const,
      createdAt: "2026-08-30T14:30:00.000Z",
      updatedAt: "2026-08-31T09:15:00.000Z",
      attachmentCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    localStorage.setItem(
      "toktickit_selected_requester_id",
      JSON.stringify(mockRequester)
    );

    (api.fetchCategories as any).mockResolvedValue(mockCategories);
    (api.fetchRequesters as any).mockResolvedValue([mockRequester]);
    (api.fetchMyTickets as any).mockResolvedValue({
      tickets: sampleTickets,
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 2,
        totalPages: 1,
      },
    });
  });

  it("UI-04 / AC-09: renders ticket table with correct columns, ticket details, and badges", async () => {
    render(
      <RequesterProvider>
        <MyTicketsPage />
      </RequesterProvider>
    );

    // Verify header and requester name
    await waitFor(() => {
      expect(screen.getByText(/Jennifer Anderson/i)).toBeInTheDocument();
      expect(screen.getAllByText("TKT-2026-000101")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Laptop keyboard not responding")[0]).toBeInTheDocument();
      expect(screen.getAllByText("TKT-2026-000102")[0]).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByRole("columnheader", { name: "Ticket Number" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date Created" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Priority" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Attachments" })).toBeInTheDocument();

    // Check attachment badges
    expect(screen.getAllByText(/📎 2/i)[0]).toBeInTheDocument();

    // Check pagination count display
    expect(screen.getByText(/Showing/i)).toHaveTextContent("Showing 1 to 2 of 2 tickets");
  });

  it("UI-04 / AC-09: updates search and filter dropdowns and refetches tickets", async () => {
    render(
      <RequesterProvider>
        <MyTicketsPage />
      </RequesterProvider>
    );

    await waitFor(() => expect(screen.getAllByText("TKT-2026-000101")[0]).toBeInTheDocument());

    // Search filter
    const searchInput = screen.getByLabelText(/Search tickets/i);
    fireEvent.change(searchInput, { target: { value: "keyboard" } });

    // Category filter
    const categorySelect = screen.getByLabelText(/Filter by category/i);
    fireEvent.change(categorySelect, { target: { value: "1" } });

    // Priority filter
    const prioritySelect = screen.getByLabelText(/Filter by priority/i);
    fireEvent.change(prioritySelect, { target: { value: "HIGH" } });

    // Status filter
    const statusSelect = screen.getByLabelText(/Filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "NEW" } });

    // Sort filter
    const sortSelect = screen.getByLabelText(/Sort tickets/i);
    fireEvent.change(sortSelect, { target: { value: "ticketNumber_asc" } });

    // Wait for debounced fetch
    await waitFor(() => {
      expect(api.fetchMyTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 1,
          search: "keyboard",
          category: 1,
          priority: "HIGH",
          status: "NEW",
          sort: "ticketNumber_asc",
          page: 1,
          limit: 10,
        })
      );
    });

    // Clear filters button appears and can be clicked
    const clearBtn = screen.getByRole("button", { name: /Clear Filters/i });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(categorySelect).toHaveValue("");
      expect(prioritySelect).toHaveValue("");
      expect(statusSelect).toHaveValue("");
    });
  });

  it("UI-04 / AC-10: handles pagination navigation between pages", async () => {
    (api.fetchMyTickets as any).mockResolvedValue({
      tickets: sampleTickets,
      pagination: {
        page: 1,
        limit: 2,
        totalItems: 4,
        totalPages: 2,
      },
    });

    render(
      <RequesterProvider>
        <MyTicketsPage />
      </RequesterProvider>
    );

    await waitFor(() => expect(screen.getAllByText("TKT-2026-000101")[0]).toBeInTheDocument());

    // Previous button should be disabled on page 1
    const prevBtn = screen.getByRole("button", { name: /Previous page/i });
    expect(prevBtn).toBeDisabled();

    // Next button should be enabled
    const nextBtn = screen.getByRole("button", { name: /Next page/i });
    expect(nextBtn).not.toBeDisabled();

    // Click Next page
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(api.fetchMyTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it("UI-08 / AC-17: renders distinct true empty state when requester has 0 tickets", async () => {
    (api.fetchMyTickets as any).mockResolvedValue({
      tickets: [],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
      },
    });

    const onNavigateMock = vi.fn();

    render(
      <RequesterProvider>
        <MyTicketsPage onNavigateToCreate={onNavigateMock} />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-ticket-state")).toBeInTheDocument();
      expect(screen.getByText(/You haven't submitted any support requests yet/i)).toBeInTheDocument();
    });

    // "Create First Ticket" CTA button
    const createFirstBtn = screen.getByRole("button", { name: /Create First Ticket/i });
    fireEvent.click(createFirstBtn);
    expect(onNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("UI-08: renders distinct filtered no-results state when search/filters match 0 tickets", async () => {
    (api.fetchMyTickets as any).mockResolvedValue({
      tickets: [],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
      },
    });

    render(
      <RequesterProvider>
        <MyTicketsPage />
      </RequesterProvider>
    );

    await waitFor(() => expect(screen.getByLabelText(/Search tickets/i)).toBeInTheDocument());

    // Apply a search filter
    const searchInput = screen.getByLabelText(/Search tickets/i);
    fireEvent.change(searchInput, { target: { value: "nonexistent query" } });

    await waitFor(() => {
      expect(screen.getByTestId("no-results-state")).toBeInTheDocument();
      expect(screen.getByText(/No tickets match your search or active filter criteria/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Clear All Filters/i })).toBeInTheDocument();
    });
  });

  it("UI-05 / AC-11: resets and refetches tickets when context requester changes", async () => {
    const requesterB = {
      id: 2,
      name: "Marcus Vance",
      email: "marcus.vance@example.com",
      department: "Marketing",
      isActive: true,
    };

    (api.fetchRequesters as any).mockResolvedValue([mockRequester, requesterB]);

    const ContextSwitchWrapper: React.FC = () => {
      const { setSelectedRequester } = useRequester();
      return (
        <div>
          <button
            onClick={() => setSelectedRequester(requesterB)}
            data-testid="switch-user-btn"
          >
            Switch to Marcus
          </button>
          <MyTicketsPage />
        </div>
      );
    };

    render(
      <RequesterProvider>
        <ContextSwitchWrapper />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-000101")[0]).toBeInTheDocument();
      expect(api.fetchMyTickets).toHaveBeenCalledWith(
        expect.objectContaining({ requesterId: 1 })
      );
    });

    // Click switch button
    fireEvent.click(screen.getByTestId("switch-user-btn"));

    await waitFor(() => {
      expect(api.fetchMyTickets).toHaveBeenCalledWith(
        expect.objectContaining({ requesterId: 2 })
      );
    });
  });
});
