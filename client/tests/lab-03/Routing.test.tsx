import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import type { AuthResult, StaffTicketDetail, TicketDetail } from "../../src/types.js";

vi.mock("../../src/api.js", async (original) => ({
  ...(await original<typeof import("../../src/api.js")>()),
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  fetchCategories: vi.fn().mockResolvedValue([]),
  fetchEligibleOwners: vi.fn().mockResolvedValue({ owners: [] }),
  fetchStaffTickets: vi.fn().mockResolvedValue({
    tickets: [
      {
        id: 201,
        ticketNumber: "TKT-2026-000201",
        summary: "Staff queue item",
        category: { id: 1, name: "Hardware" },
        relatedSystem: { id: 1, name: "Laptop" },
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
  }),
  fetchStaffTicketDetail: vi.fn(),
  fetchTicketDetail: vi.fn(),
  fetchMyTickets: vi.fn().mockResolvedValue({
    tickets: [],
    pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
  }),
}));

describe("Routing & Direct Path Navigation Tests", () => {
  const requesterSession: AuthResult = {
    user: {
      id: 1,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      isActive: true,
    },
    mustChangePassword: false,
  };

  const staffSession: AuthResult = {
    user: {
      id: 4,
      name: "Sarah Chen",
      email: "sarah.chen@example.com",
      role: "IT_STAFF",
      isActive: true,
    },
    mustChangePassword: false,
  };

  const adminSession: AuthResult = {
    user: {
      id: 2,
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      role: "ADMINISTRATOR",
      isActive: true,
    },
    mustChangePassword: false,
  };

  const mustChangeSession: AuthResult = {
    user: {
      id: 6,
      name: "Temp User",
      email: "temp@example.com",
      role: "REQUESTER",
      isActive: true,
    },
    mustChangePassword: true,
  };

  const sampleStaffDetail: StaffTicketDetail = {
    id: 201,
    ticketNumber: "TKT-2026-000201",
    requesterId: 1,
    requester: { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" },
    categoryId: 1,
    category: { id: 1, name: "Hardware" },
    relatedSystemId: 1,
    relatedSystem: { id: 1, name: "Laptop" },
    summary: "Staff queue item",
    description: "Detailed staff issue description",
    requestedPriority: "LOW",
    itPriority: "LOW",
    status: "OPEN",
    owner: null,
    createdAt: "2026-09-16T12:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
    version: 1,
    attachmentCount: 0,
    publicCommentCount: 0,
    attachments: [],
    publicComments: [],
    internalNotes: [],
    problemAppearsResolvedAt: null,
    problemAppearsResolvedById: null,
  };

  const sampleRequesterDetail: TicketDetail = {
    id: 101,
    ticketNumber: "TKT-2026-000101",
    requesterId: 1,
    requester: { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" },
    categoryId: 1,
    category: { id: 1, name: "Hardware" },
    relatedSystemId: 1,
    relatedSystem: { id: 1, name: "Laptop" },
    summary: "Requester issue",
    description: "Detailed requester issue description",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    status: "OPEN",
    owner: null,
    createdAt: "2026-09-16T12:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
    version: 1,
    attachmentCount: 0,
    publicCommentCount: 0,
    attachments: [],
    publicComments: [],
    problemAppearsResolvedAt: null,
    problemAppearsResolvedById: null,
  };

  const originalPathname = window.location.pathname;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState(null, "", "/");
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(sampleStaffDetail);
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(sampleRequesterDetail);
  });

  afterEach(() => {
    window.history.pushState(null, "", originalPathname);
  });

  it("unauthenticated access to protected path redirects to /login", async () => {
    window.history.pushState(null, "", "/staff/tickets");
    vi.mocked(api.getSession).mockRejectedValue(new api.AuthError("Unauthorized", 401));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/login");
  });

  it("authenticated IT Staff visiting /login routes to permitted home /staff/tickets", async () => {
    window.history.pushState(null, "", "/login");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/staff/tickets");
  });

  it("forces password change when mustChangePassword is true", async () => {
    window.history.pushState(null, "", "/my-tickets");
    vi.mocked(api.getSession).mockResolvedValue(mustChangeSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/change-password");
  });

  it("direct navigation to /staff/tickets/201 loads staff ticket detail directly", async () => {
    window.history.pushState(null, "", "/staff/tickets/201");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("staff-ticket-number-heading")).toHaveTextContent("TKT-2026-000201");
    });
    expect(api.fetchStaffTicketDetail).toHaveBeenCalledWith(201);
  });

  it("direct navigation to /tickets/101 loads requester ticket detail directly", async () => {
    window.history.pushState(null, "", "/tickets/101");
    vi.mocked(api.getSession).mockResolvedValue(requesterSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("ticket-number-heading")).toHaveTextContent("TKT-2026-000101");
    });
    expect(api.fetchTicketDetail).toHaveBeenCalledWith(101);
  });

  it("direct navigation to /tickets/invalid shows safe invalid ticket ID error", async () => {
    window.history.pushState(null, "", "/tickets/abc");
    vi.mocked(api.getSession).mockResolvedValue(requesterSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("route-invalid-ticket")).toBeInTheDocument();
    });
  });

  it("unknown URL path /not-found shows safe not-found state with return home link", async () => {
    window.history.pushState(null, "", "/not-found");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("route-not-found")).toBeInTheDocument();
    });
    expect(screen.getByTestId("btn-not-found-home")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-not-found-home"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/staff/tickets");
  });

  it("cross-role protection: requester accessing /staff/tickets gets safe forbidden message", async () => {
    window.history.pushState(null, "", "/staff/tickets");
    vi.mocked(api.getSession).mockResolvedValue(requesterSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("route-forbidden")).toBeInTheDocument();
    });
  });

  it("cross-role protection: IT Staff accessing /admin/users gets safe forbidden message", async () => {
    window.history.pushState(null, "", "/admin/users");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("route-forbidden")).toBeInTheDocument();
    });
  });

  it("cross-role protection: Staff accessing /my-tickets gets safe forbidden message", async () => {
    window.history.pushState(null, "", "/my-tickets");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("route-forbidden")).toBeInTheDocument();
    });
  });

  it("cross-role protection: Staff accessing /tickets/101 gets safe forbidden message", async () => {
    window.history.pushState(null, "", "/tickets/101");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("route-forbidden")).toBeInTheDocument();
    });
  });

  it("browser popstate transitions between queue and detail views", async () => {
    window.history.pushState(null, "", "/staff/tickets");
    vi.mocked(api.getSession).mockResolvedValue(staffSession);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });

    // Navigate to ticket detail by clicking open
    const openBtn = screen.getAllByRole("button", { name: /open/i })[0];
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(screen.getByTestId("staff-ticket-number-heading")).toHaveTextContent("TKT-2026-000201");
    });
    expect(window.location.pathname).toBe("/staff/tickets/201");

    // Simulate browser back button (popstate to /staff/tickets)
    window.history.pushState(null, "", "/staff/tickets");
    fireEvent(window, new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /IT Staff Ticket Queue/i })).toBeInTheDocument();
    });
  });
});
