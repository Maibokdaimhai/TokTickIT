import React from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import type { AuthResult } from "../../src/types.js";
vi.mock("../../src/api.js", async original => ({
  ...await original<typeof import("../../src/api.js")>(),
  getSession: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn(),
  fetchCategories: vi.fn().mockResolvedValue([]), fetchRelatedSystems: vi.fn().mockResolvedValue([]),
  fetchMyTickets: vi.fn().mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } }),
}));
const session: AuthResult = { user: { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", role: "REQUESTER", isActive: true }, mustChangePassword: false };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); vi.mocked(api.getSession).mockRejectedValue(new api.AuthError("Sign in", 401)); vi.mocked(api.login).mockResolvedValue(session); vi.mocked(api.logout).mockResolvedValue(); });
async function loginForm() {
  render(<App />); await screen.findByRole("heading", { name: "Sign in to TokTickIT" });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: session.user.email } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "Initial-test1!" } });
}
describe("cookie-authenticated shell", () => {
  it("ignores a forged stored identity and restores no protected content before /me", async () => {
    localStorage.setItem("toktickit_selected_requester_id", JSON.stringify(session.user));
    render(<App />); expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Sign in" });
    expect(localStorage.getItem("toktickit_selected_requester_id")).toBeNull();
    expect(api.fetchMyTickets).not.toHaveBeenCalled();
  });
  it("shows login busy state, safe failure and clears the password", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(api.login).mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    await loginForm(); fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
    await act(async () => reject(new api.AuthError("Invalid email or password", 401)));
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  });
  it("signs in, displays name/role, signs out and removes protected content", async () => {
    await loginForm(); fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("navigation"); expect(screen.getByText("REQUESTER")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" })); fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Sign in to TokTickIT" }); expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
  it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("does not expose requester navigation for %s", async role => {
    vi.mocked(api.getSession).mockResolvedValue({ ...session, user: { ...session.user, role } }); render(<App />);
    await screen.findByRole("navigation"); expect(screen.queryByRole("button", { name: /My Tickets/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Ticket/ })).not.toBeInTheDocument();
  });
  it("mandatory password change has no normal navigation, validates and completes", async () => {
    vi.mocked(api.getSession).mockResolvedValue({ ...session, mustChangePassword: true });
    vi.mocked(api.changePassword).mockResolvedValue(session); render(<App />);
    await screen.findByRole("heading", { name: "Change password" }); expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Password requirements" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Initial-test1!" } });
    fireEvent.change(screen.getByLabelText("New password", { exact: true }), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" })); expect(api.changePassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New password", { exact: true })).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("New password", { exact: true }), { target: { value: "Changed-test2!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" })); expect(screen.getByText("Password confirmation must match exactly.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Changed-test2!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" })); await screen.findByRole("navigation");
    expect(api.changePassword).toHaveBeenCalledWith("Initial-test1!", "Changed-test2!", "Changed-test2!");
  });
  it("returns to sign-in on expired-session feedback and gates a newly restricted session", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session); render(<App />); await screen.findByRole("navigation");
    act(() => window.dispatchEvent(new Event("auth:password-required"))); await screen.findByRole("heading", { name: "Change password" });
    act(() => window.dispatchEvent(new Event("auth:expired"))); await screen.findByRole("heading", { name: "Sign in to TokTickIT" });
    expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended");
  });
  it("preserves the signed-in shell on logout network failure", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session); vi.mocked(api.logout).mockRejectedValue(new Error("Unable to sign out"));
    render(<App />); await screen.findByRole("navigation"); fireEvent.click(screen.getByRole("button", { name: "Account menu" })); fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to sign out")); expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
  it("opens self-service password change from the account menu and shows server field feedback", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session);
    vi.mocked(api.changePassword).mockRejectedValue(new api.AuthError("Current password is incorrect", 400, "CURRENT_PASSWORD_INVALID"));
    render(<App />); await screen.findByRole("navigation");
    fireEvent.click(screen.getByRole("button", { name: "Account menu" })); fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Wrong-password1!" } });
    fireEvent.change(screen.getByLabelText("New password", { exact: true }), { target: { value: "Changed-test2!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Changed-test2!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    await screen.findByText("Current password is incorrect"); expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); }); expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
