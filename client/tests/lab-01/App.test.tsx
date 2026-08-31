import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("renders navigation tabs for My Tickets and Create Ticket", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /My Tickets/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Ticket/i })).toBeInTheDocument();
  });

  it("switches navigation tabs when clicked", () => {
    render(<App />);
    const createTabBtn = screen.getByRole("button", { name: /Create Ticket/i });
    fireEvent.click(createTabBtn);
    expect(screen.getByText(/Create Support Ticket/i)).toBeInTheDocument();
  });
});

