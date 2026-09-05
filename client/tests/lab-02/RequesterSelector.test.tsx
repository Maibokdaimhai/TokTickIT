import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import { RequesterSelectorModal } from "../../src/components/RequesterSelectorModal.js";
import * as api from "../../src/api.js";

vi.mock("../../src/api.js", () => ({
  fetchRequesters: vi.fn(),
}));

const TestComponent: React.FC = () => {
  const { openSelector, selectedRequester } = useRequester();
  return (
    <div>
      <button onClick={openSelector}>Open Selector</button>
      <span data-testid="selected-user">
        {selectedRequester ? selectedRequester.name : "None"}
      </span>
      <RequesterSelectorModal />
    </div>
  );
};

describe("RequesterSelectorModal UI Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders testing disclaimer banner and loaded requester dropdown options", async () => {
    (api.fetchRequesters as any).mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", department: "Engineering" },
      { id: 2, name: "Michael Brown", email: "michael@example.com", department: "IT" },
    ]);

    render(
      <RequesterProvider>
        <TestComponent />
      </RequesterProvider>
    );

    // Modal opens automatically when no saved requester exists
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(options[0].textContent).toContain("Jennifer Anderson");
      expect(options[1].textContent).toContain("Michael Brown");
    });
  });

  it("renders safe error message when fetchRequesters API fails and disables Continue button", async () => {
    (api.fetchRequesters as any).mockRejectedValue(new Error("Database connection failed"));

    render(
      <RequesterProvider>
        <TestComponent />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();
      const continueBtn = screen.getByRole("button", { name: /Continue/i });
      expect(continueBtn).toBeDisabled();
    });
  });

  it("resets stale draft selection on reopen and disables Continue if API fails during reopen", async () => {
    // 1. Initial success fetch
    (api.fetchRequesters as any).mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", department: "Engineering" },
      { id: 2, name: "Michael Brown", email: "michael@example.com", department: "IT" },
    ]);

    render(
      <RequesterProvider>
        <TestComponent />
      </RequesterProvider>
    );

    // Initial confirmation of User 1
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("selected-user").textContent).toBe("Jennifer Anderson");

    // 2. Open selector, select User 2, but click Cancel
    fireEvent.click(screen.getByRole("button", { name: /Open Selector/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    // 3. Mock API failure and reopen selector
    (api.fetchRequesters as any).mockRejectedValue(new Error("Network Error"));
    fireEvent.click(screen.getByRole("button", { name: /Open Selector/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue/i })).toBeDisabled();
    });

    // Context remains User 1
    expect(screen.getByTestId("selected-user").textContent).toBe("Jennifer Anderson");
  });

  it("handles saved requester that becomes inactive by selecting first active user", async () => {
    // Saved user #99 is inactive/missing from active API list
    localStorage.setItem(
      "toktickit_selected_requester_id",
      JSON.stringify({ id: 99, name: "Old Inactive User", email: "old@example.com", department: "HR" })
    );

    (api.fetchRequesters as any).mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", department: "Engineering" },
      { id: 2, name: "Michael Brown", email: "michael@example.com", department: "IT" },
    ]);

    render(
      <RequesterProvider>
        <TestComponent />
      </RequesterProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Selector/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      // Should auto-select User 1 (id: 1) instead of retaining stale invalid ID 99
      expect(select.value).toBe("1");
    });

    // Clicking Continue updates context to active User 1
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("selected-user").textContent).toBe("Jennifer Anderson");
  });

  it("validates saved requester on startup and automatically opens modal if saved user is inactive", async () => {
    // Pre-populate localStorage with an inactive/deactivated user #99
    localStorage.setItem(
      "toktickit_selected_requester_id",
      JSON.stringify({ id: 99, name: "Deactivated User", email: "deactivated@example.com", department: "HR" })
    );

    (api.fetchRequesters as any).mockResolvedValue([
      { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", department: "Engineering" },
      { id: 2, name: "Michael Brown", email: "michael@example.com", department: "IT" },
    ]);

    // Render without clicking "Open Selector"
    render(
      <RequesterProvider>
        <TestComponent />
      </RequesterProvider>
    );

    // Modal should automatically open on startup because saved user #99 is inactive
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(localStorage.getItem("toktickit_selected_requester_id")).toBeNull();
    });

    // Dropdown auto-selects first available active user (User 1)
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("1");

    // Submitting sets valid active user
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("selected-user").textContent).toBe("Jennifer Anderson");
  });
});
