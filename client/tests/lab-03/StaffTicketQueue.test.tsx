import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffTicketQueue } from "../../src/components/StaffTicketQueue.js";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { ApiClientError } from "../../src/api.js";
import type {
  StaffTicketRow,
  StaffTicketsResponse,
  EligibleOwner,
  Category,
  AuthResult,
} from "../../src/types.js";

// Mock the API module
vi.mock("../../src/api.js", async (original) => ({
  ...(await original<typeof import("../../src/api.js")>()),
  fetchCategories: vi.fn(),
  fetchEligibleOwners: vi.fn(),
  fetchStaffTickets: vi.fn(),
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  fetchMyTickets: vi.fn().mockResolvedValue({
    tickets: [],
    pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
  }),
}));

describe("UI-04: Staff Ticket Queue Component", () => {
  const mockCategories: Category[] = [
    { id: 1, name: "Hardware" },
    { id: 2, name: "Software" },
  ];

  const mockEligibleOwners: EligibleOwner[] = [
    { id: 2, name: "Alex IT", email: "alex@example.com", role: "IT_STAFF" },
    { id: 3, name: "Bob Admin", email: "bob@example.com", role: "ADMINISTRATOR" },
  ];

  const sampleTickets: StaffTicketRow[] = [
    {
      id: 101,
      ticketNumber: "TKT-2026-000101",
      summary: "Cannot connect to office printer",
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 7, name: "Corporate Laptop" },
      owner: { id: 2, name: "Alex IT", email: "alex@example.com", role: "IT_STAFF" },
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      status: "OPEN",
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-15T09:30:00.000Z",
      version: 1,
      attachmentCount: 0,
      publicCommentCount: 0,
    },
    {
      id: 102,
      ticketNumber: "TKT-2026-000102",
      summary: "Database query timeout",
      category: { id: 2, name: "Software" },
      relatedSystem: { id: 3, name: "VPN" },
      owner: null,
      requestedPriority: "URGENT",
      itPriority: "URGENT",
      status: "NEW",
      createdAt: "2026-09-15T10:00:00.000Z",
      updatedAt: "2026-09-15T10:00:00.000Z",
      version: 1,
      attachmentCount: 0,
      publicCommentCount: 0,
    },
  ];

  const sampleResponse: StaffTicketsResponse = {
    tickets: sampleTickets,
    pagination: {
      page: 1,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchCategories).mockResolvedValue(mockCategories);
    vi.mocked(api.fetchEligibleOwners).mockResolvedValue({ owners: mockEligibleOwners });
    vi.mocked(api.fetchStaffTickets).mockResolvedValue(sampleResponse);
  });

  it("renders queue table columns, ticket rows, and badges correctly", async () => {
    const handleOpen = vi.fn();
    render(<StaffTicketQueue onOpenTicket={handleOpen} />);

    // Check header
    expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();

    // Wait for tickets to load (both desktop table and mobile card exist)
    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-000101")[0]).toBeInTheDocument();
    });

    // Check table headers using columnheader role to disambiguate from filter labels
    expect(screen.getByRole("columnheader", { name: "Ticket Number" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Updated" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Requested Priority" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "IT Priority" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Owner" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Action" })).toBeInTheDocument();

    // Check ticket rows
    expect(screen.getAllByText("Cannot connect to office printer")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Alex IT")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Unassigned")[0]).toBeInTheDocument();

    // Check action buttons (desktop + mobile card for each ticket)
    const openButtons = screen.getAllByRole("button", { name: /open/i });
    expect(openButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(openButtons[0]);
    expect(handleOpen).toHaveBeenCalledWith(101);
  });

  it("updates search filter with debounce and calls fetchStaffTickets", async () => {
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByLabelText(/search tickets/i);
    fireEvent.change(searchInput, { target: { value: "printer" } });

    await waitFor(
      () => {
        expect(api.fetchStaffTickets).toHaveBeenCalledWith(
          expect.objectContaining({
            search: "printer",
            page: 1,
          })
        );
      },
      { timeout: 1500 }
    );
  });

  it("updates Category, Requested Priority, IT Priority, Status, and Owner filters", async () => {
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenCalledTimes(1);
    });

    // Category filter
    const categorySelect = screen.getByLabelText(/filter by category/i);
    fireEvent.change(categorySelect, { target: { value: "1" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 1, page: 1 })
      );
    });

    // Requested Priority filter
    const reqPrioritySelect = screen.getByLabelText(/filter by requested priority/i);
    fireEvent.change(reqPrioritySelect, { target: { value: "URGENT" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ requestedPriority: "URGENT", page: 1 })
      );
    });

    // IT Priority filter
    const itPrioritySelect = screen.getByLabelText(/filter by it priority/i);
    fireEvent.change(itPrioritySelect, { target: { value: "HIGH" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ itPriority: "HIGH", page: 1 })
      );
    });

    // Status filter
    const statusSelect = screen.getByLabelText(/filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "OPEN" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "OPEN", page: 1 })
      );
    });

    // Owner filter
    const ownerSelect = screen.getByLabelText(/filter by owner/i);
    fireEvent.change(ownerSelect, { target: { value: "unassigned" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ owner: "unassigned", page: 1 })
      );
    });
  });

  it("updates Sort dropdown and requests custom itPriority_desc sorting", async () => {
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenCalledTimes(1);
    });

    const sortSelect = screen.getByLabelText(/sort queue/i);
    fireEvent.change(sortSelect, { target: { value: "itPriority_desc" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: "itPriority_desc" })
      );
    });
  });

  it("handles pagination navigation and limit changes", async () => {
    vi.mocked(api.fetchStaffTickets).mockResolvedValue({
      tickets: sampleTickets,
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
      },
    });

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          (_, el) => el?.textContent?.replace(/\s+/g, " ").trim() === "Showing 1 to 10 of 25 tickets"
        )
      ).toBeInTheDocument();
    });

    // Next page
    const nextBtn = screen.getByLabelText(/next page/i);
    expect(nextBtn).toBeEnabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, limit: 10 })
      );
    });

    // Limit change
    const limitSelect = screen.getByLabelText(/page size/i);
    fireEvent.change(limitSelect, { target: { value: "20" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, limit: 20 })
      );
    });
  });

  it("renders distinct true empty state when queue has 0 tickets and no filters active", async () => {
    vi.mocked(api.fetchStaffTickets).mockResolvedValue({
      tickets: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("queue-empty")).toBeInTheDocument();
    });
    expect(screen.getByText("No Tickets in Queue")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear All Filters/i })).not.toBeInTheDocument();
  });

  it("renders distinct filtered no-results state with clear filters button when filters are active", async () => {
    vi.mocked(api.fetchStaffTickets).mockResolvedValue({
      tickets: [],
      pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });

    render(
      <StaffTicketQueue
        initialParams={{ status: "CLOSED" }}
        onOpenTicket={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("queue-no-results")).toBeInTheDocument();
    });
    expect(screen.getByText("No Matching Tickets Found")).toBeInTheDocument();

    // Click clear filters
    const clearBtn = screen.getByRole("button", { name: "Clear All Filters" });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: undefined,
          page: 1,
        })
      );
    });
  });

  it("renders safe error banner with retry button on network / 500 failure", async () => {
    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(
      new ApiClientError("Server temporarily unavailable", 500)
    );

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("queue-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/Server temporarily unavailable/)).toBeInTheDocument();

    // Retry button works
    vi.mocked(api.fetchStaffTickets).mockResolvedValue(sampleResponse);
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Cannot connect to office printer")[0]).toBeInTheDocument();
    });
  });

  it("renders distinct HTTP 403 Forbidden callout without retry button", async () => {
    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(
      new ApiClientError("Forbidden: Insufficient privileges", 403, "FORBIDDEN")
    );

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("queue-forbidden")).toBeInTheDocument();
    });
    expect(screen.getByText(/Access Forbidden/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You do not have permission to access the IT Staff queue/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows reference-data warning and provides retry when categories or eligible owners fail", async () => {
    vi.mocked(api.fetchCategories).mockRejectedValueOnce(new Error("Failed to load categories"));
    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("queue-ref-warning")).toBeInTheDocument();
    });
    expect(screen.getByText(/Unable to load filter options/i)).toBeInTheDocument();

    // Retry succeeds
    vi.mocked(api.fetchCategories).mockResolvedValue(mockCategories);
    const retryBtn = screen.getByRole("button", { name: /Retry Options/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("queue-ref-warning")).not.toBeInTheDocument();
    });
  });

  it("REGRESSION: ignores stale out-of-order responses when switching filters", async () => {
    let resolveInitialRequest!: (value: any) => void;
    const delayedInitialPromise = new Promise((resolve) => {
      resolveInitialRequest = resolve;
    });

    const newerTickets: StaffTicketRow[] = [
      {
        id: 301,
        ticketNumber: "TKT-2026-000301",
        summary: "Newer in-progress server reboot",
        category: { id: 2, name: "Software" },
        relatedSystem: { id: 3, name: "VPN" },
        owner: null,
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        status: "IN_PROGRESS",
        createdAt: "2026-09-17T09:00:00.000Z",
        updatedAt: "2026-09-17T09:00:00.000Z",
        version: 1,
        attachmentCount: 0,
        publicCommentCount: 0,
      },
    ];

    let fetchCount = 0;
    vi.mocked(api.fetchStaffTickets).mockImplementation(() => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return delayedInitialPromise as any;
      }
      return Promise.resolve({
        tickets: newerTickets,
        pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      });
    });

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);

    // Request 1 is in-flight
    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenCalledTimes(1);
    });

    // User changes filter to IN_PROGRESS, triggering Request 2
    const statusSelect = screen.getByLabelText(/filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "IN_PROGRESS" } });

    // Request 2 resolves and shows newer ticket
    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-000301")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Newer in-progress server reboot")[0]).toBeInTheDocument();
    });

    // Now Request 1 resolves with older sampleTickets
    resolveInitialRequest({
      tickets: sampleTickets,
      pagination: { page: 1, limit: 10, totalItems: 2, totalPages: 1 },
    });

    // Allow any pending microtasks / state updates to run
    await new Promise((r) => setTimeout(r, 60));

    // Stale Request 1 response must NOT overwrite Request 2
    expect(screen.getAllByText("TKT-2026-000301")[0]).toBeInTheDocument();
    expect(screen.queryByText("Cannot connect to office printer")).not.toBeInTheDocument();
  });
});
describe("Role Navigation & Queue State Preservation Integration", () => {
  const staffSession: AuthResult = {
    user: {
      id: 2,
      name: "Alex IT Staff",
      email: "alex@example.com",
      role: "IT_STAFF",
      isActive: true,
    },
    mustChangePassword: false,
  };

  const adminSession: AuthResult = {
    user: {
      id: 3,
      name: "Bob Administrator",
      email: "bob@example.com",
      role: "ADMINISTRATOR",
      isActive: true,
    },
    mustChangePassword: false,
  };

  const requesterSession: AuthResult = {
    user: {
      id: 1,
      name: "Jennifer Requester",
      email: "jennifer@example.com",
      role: "REQUESTER",
      isActive: true,
    },
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchCategories).mockResolvedValue([]);
    vi.mocked(api.fetchEligibleOwners).mockResolvedValue({ owners: [] });
    vi.mocked(api.fetchStaffTickets).mockResolvedValue({
      tickets: [
        {
          id: 201,
          ticketNumber: "TKT-2026-000201",
          summary: "Monitor display glitch",
          category: { id: 1, name: "Hardware" },
          relatedSystem: { id: 7, name: "Corporate Laptop" },
          owner: null,
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "OPEN",
          createdAt: "2026-09-16T12:00:00.000Z",
          updatedAt: "2026-09-16T12:00:00.000Z",
          version: 1,
          attachmentCount: 0,
          publicCommentCount: 0,
        },
      ],
      pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
  });

  it("IT_STAFF session defaults to Ticket Queue and shows nav button", async () => {
    vi.mocked(api.getSession).mockResolvedValue(staffSession);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("nav-ticket-queue")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /My Tickets/ })).not.toBeInTheDocument();
  });

  it("ADMINISTRATOR session defaults to User Management placeholder and can navigate to Ticket Queue", async () => {
    vi.mocked(api.getSession).mockResolvedValue(adminSession);
    render(<App />);

    // Defaults to User Management placeholder
    await waitFor(() => {
      expect(screen.getByTestId("user-management-placeholder")).toBeInTheDocument();
    });
    expect(screen.getByText("Administrator user management workspace will be added in Issue #31.")).toBeInTheDocument();

    // Both User Management and Ticket Queue buttons exist
    expect(screen.getByTestId("nav-user-management")).toBeInTheDocument();
    const queueNavBtn = screen.getByTestId("nav-ticket-queue");
    expect(queueNavBtn).toBeInTheDocument();

    // Click Ticket Queue nav button
    fireEvent.click(queueNavBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });
  });

  it("REQUESTER session defaults to My Tickets and has no staff queue navigation", async () => {
    vi.mocked(api.getSession).mockResolvedValue(requesterSession);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /My Tickets/ })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("nav-ticket-queue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-user-management")).not.toBeInTheDocument();
  });

  it("preserves lifted filter criteria when navigating to ticket detail placeholder and back", async () => {
    vi.mocked(api.getSession).mockResolvedValue(staffSession);
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-000201")[0]).toBeInTheDocument();
    });

    // Change status filter to "OPEN"
    const statusSelect = screen.getByLabelText(/filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "OPEN" } });

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "OPEN" })
      );
    });

    // Click "Open" action on ticket #201
    const openButtons = screen.getAllByRole("button", { name: /open/i });
    fireEvent.click(openButtons[0]);

    // Detail placeholder is shown
    await waitFor(() => {
      expect(screen.getByTestId("ticket-detail-placeholder")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Ticket #201" })).toBeInTheDocument();
    expect(screen.getByText(/Ticket operations, comments, and internal notes belong to Issue #30/i)).toBeInTheDocument();

    // Click "← Back to Ticket Queue"
    const backBtn = screen.getByRole("button", { name: "← Back to Ticket Queue" });
    fireEvent.click(backBtn);

    // Back on Queue: queue should be rendered and the status filter should still be "OPEN"
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });
    const restoredStatusSelect = screen.getByLabelText(/filter by status/i) as HTMLSelectElement;
    expect(restoredStatusSelect.value).toBe("OPEN");
  });

  it("preserves both filters and a non-first page across detail navigation without resetting after 300ms", async () => {
    vi.mocked(api.getSession).mockResolvedValue(staffSession);
    vi.mocked(api.fetchStaffTickets).mockResolvedValue({
      tickets: [
        {
          id: 201,
          ticketNumber: "TKT-2026-000201",
          summary: "Monitor display glitch",
          category: { id: 1, name: "Hardware" },
          relatedSystem: { id: 7, name: "Corporate Laptop" },
          owner: null,
          requestedPriority: "LOW",
          itPriority: "LOW",
          status: "OPEN",
          createdAt: "2026-09-16T12:00:00.000Z",
          updatedAt: "2026-09-16T12:00:00.000Z",
          version: 1,
          attachmentCount: 0,
          publicCommentCount: 0,
        },
      ],
      pagination: { page: 1, limit: 10, totalItems: 25, totalPages: 3 },
    });

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    await waitFor(() => {
      expect(screen.getAllByText("TKT-2026-000201")[0]).toBeInTheDocument();
    });

    // Set search and status filter
    const searchInput = screen.getByLabelText(/search tickets/i);
    fireEvent.change(searchInput, { target: { value: "glitch" } });

    const statusSelect = screen.getByLabelText(/filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "OPEN" } });

    // Wait for debounced search and status to trigger fetch
    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "glitch", status: "OPEN" })
      );
    });

    // Wait for the table to re-render after filters before clicking next page
    await waitFor(() => {
      expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
    });

    // Navigate to page 2
    const nextBtn = screen.getByLabelText(/next page/i);
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(api.fetchStaffTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "glitch", status: "OPEN", page: 2 })
      );
    });

    // Click "Open" to navigate into detail placeholder
    const openButtons = screen.getAllByRole("button", { name: /open/i });
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("ticket-detail-placeholder")).toBeInTheDocument();
    });

    // Click "← Back to Ticket Queue" to return
    const backBtn = screen.getByRole("button", { name: "← Back to Ticket Queue" });
    fireEvent.click(backBtn);

    // Queue is restored with search "glitch", status "OPEN", and page 2 inside StrictMode
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });

    const restoredSearchInput = screen.getByLabelText(/search tickets/i) as HTMLInputElement;
    expect(restoredSearchInput.value).toBe("glitch");

    const restoredStatusSelect = screen.getByLabelText(/filter by status/i) as HTMLSelectElement;
    expect(restoredStatusSelect.value).toBe("OPEN");

    // Clear calls to monitor if debounce wrongly triggers page 1 after 300ms
    vi.mocked(api.fetchStaffTickets).mockClear();

    // Wait 350ms (longer than the 300ms debounce)
    await new Promise((r) => setTimeout(r, 350));

    // Verify fetchStaffTickets was NOT called to reset page to 1
    const page1Calls = vi
      .mocked(api.fetchStaffTickets)
      .mock.calls.filter((call) => call[0]?.page === 1);
    expect(page1Calls).toHaveLength(0);
  });
});
