import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("renders safe error message when fetchRequesters API fails", async () => {
    (api.fetchRequesters as any).mockRejectedValue(new Error("Database connection failed"));

    render(
      <RequesterProvider>
        <TestComponent />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();
    });
  });
});
