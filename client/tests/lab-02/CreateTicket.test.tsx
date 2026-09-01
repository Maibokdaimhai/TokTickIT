import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import { CreateTicketForm } from "../../src/components/CreateTicketForm.js";
import * as api from "../../src/api.js";

vi.mock("../../src/api.js", () => ({
  fetchCategories: vi.fn(),
  fetchRelatedSystems: vi.fn(),
  createTicket: vi.fn(),
  fetchRequesters: vi.fn(),
}));

describe("CreateTicketForm Component (Lab 2)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    localStorage.setItem(
      "toktickit_selected_requester_id",
      JSON.stringify({ id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", department: "Engineering" })
    );

    (api.fetchCategories as any).mockResolvedValue([
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
    ]);

    (api.fetchRelatedSystems as any).mockResolvedValue([
      { id: 10, name: "Campus Wi-Fi" },
      { id: 20, name: "VPN" },
    ]);

    (api.fetchRequesters as any).mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", department: "Engineering" },
    ]);
  });

  it("renders reference dropdown options and read-only ticket header info", async () => {
    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Account and Access")).toBeInTheDocument();
      expect(screen.getByText("Campus Wi-Fi")).toBeInTheDocument();
      expect(screen.getByText(/TKT-2026-AUTO/i)).toBeInTheDocument();
    });
  });

  it("UI-02: displays field error messages directly below affected controls when inputs are invalid", async () => {
    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    await waitFor(() => expect(screen.getByText("Account and Access")).toBeInTheDocument());

    const submitBtn = screen.getByRole("button", { name: /Submit Ticket/i });
    fireEvent.click(submitBtn);

    // Verify inline field error messages appear
    await waitFor(() => {
      expect(screen.getByText(/Summary is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Description is required/i)).toBeInTheDocument();
    });
  });

  it("UI-03: disables Submit button and renders busy spinner state during processing", async () => {
    (api.createTicket as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 101,
                ticketNumber: "TKT-2026-000001",
                status: "NEW",
              }),
            100
          );
        })
    );

    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    await waitFor(() => expect(screen.getByText("Account and Access")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Summary/i), { target: { value: "Valid Summary Title" } });
    fireEvent.change(screen.getByLabelText(/Detailed Description/i), { target: { value: "This is a valid long description text for IT support." } });

    const submitBtn = screen.getByRole("button", { name: /Submit Ticket/i });
    fireEvent.click(submitBtn);

    // Busy state verified
    expect(screen.getByRole("button", { name: /Submitting Ticket/i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/Ticket Created Successfully!/i)).toBeInTheDocument();
      expect(screen.getByText(/TKT-2026-000001/i)).toBeInTheDocument();
    });
  });

  it("UI-07: preserves user-entered values in form fields when submission fails with API error", async () => {
    (api.createTicket as any).mockRejectedValue(new Error("Database connection timeout"));

    render(
      <RequesterProvider>
        <CreateTicketForm />
      </RequesterProvider>
    );

    await waitFor(() => expect(screen.getByText("Account and Access")).toBeInTheDocument());

    const summaryInput = screen.getByLabelText(/Summary/i) as HTMLInputElement;
    const descInput = screen.getByLabelText(/Detailed Description/i) as HTMLTextAreaElement;

    fireEvent.change(summaryInput, { target: { value: "Preserved Summary Content" } });
    fireEvent.change(descInput, { target: { value: "Preserved Description Content text for testing." } });

    fireEvent.click(screen.getByRole("button", { name: /Submit Ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
      // Values preserved
      expect(summaryInput.value).toBe("Preserved Summary Content");
      expect(descInput.value).toBe("Preserved Description Content text for testing.");
    });
  });
});
