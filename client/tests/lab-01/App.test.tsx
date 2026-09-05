import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../../src/App.js";

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("renders navigation tabs for My Tickets and Create Ticket", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("button", { name: /My Tickets/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Create Ticket/i })).toBeInTheDocument();
  });

  it("switches navigation tabs when clicked", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    const createTabBtn = within(nav).getByRole("button", { name: /Create Ticket/i });
    fireEvent.click(createTabBtn);
    expect(screen.getByText(/Create Support Ticket/i)).toBeInTheDocument();
  });
});
