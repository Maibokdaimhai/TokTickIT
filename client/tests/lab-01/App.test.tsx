import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import App from "../../src/App.js";
vi.mock("../../src/api.js", async importOriginal => ({
  ...await importOriginal<typeof import("../../src/api.js")>(),
  getSession: vi.fn().mockResolvedValue({ user: { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", role: "REQUESTER", isActive: true }, mustChangePassword: false }),
  fetchCategories: vi.fn().mockResolvedValue([]), fetchRelatedSystems: vi.fn().mockResolvedValue([]),
  fetchMyTickets: vi.fn().mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } }),
}));

describe("App", () => {
  it("renders the TokTickIT heading", async () => {
    render(<App />);
    expect(await screen.findByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("renders navigation tabs for My Tickets and Create Ticket", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation");
    expect(within(nav).getByRole("button", { name: /My Tickets/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Create Ticket/i })).toBeInTheDocument();
  });

  it("switches navigation tabs when clicked", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation");
    const createTabBtn = within(nav).getByRole("button", { name: /Create Ticket/i });
    await act(async () => { fireEvent.click(createTabBtn); });
    expect(screen.getByText(/Create Support Ticket/i)).toBeInTheDocument();
  });
});
