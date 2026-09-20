import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { UserManagement } from "../../src/components/UserManagement.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import * as api from "../../src/api.js";
import { ApiClientError } from "../../src/api.js";
import type { AdminUser, AuthResult } from "../../src/types.js";

// Mock API
vi.mock("../../src/api.js", async (original) => ({
  ...(await original<typeof import("../../src/api.js")>()),
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  fetchAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  resetAdminUserPassword: vi.fn(),
}));

describe("UI-07: Administrator User Management Component", () => {
  const adminSession: AuthResult = {
    user: {
      id: 1,
      name: "Admin Alice",
      email: "admin.alice@example.com",
      role: "ADMINISTRATOR",
      isActive: true,
    },
    mustChangePassword: false,
  };

  const sampleUsers: AdminUser[] = [
    {
      id: 1,
      name: "Admin Alice",
      email: "admin.alice@example.com",
      role: "ADMINISTRATOR",
      isActive: true,
      mustChangePassword: false,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: 2,
      name: "Bob Staff",
      email: "bob.staff@example.com",
      role: "IT_STAFF",
      isActive: true,
      mustChangePassword: true,
      createdAt: "2026-09-02T11:00:00.000Z",
      updatedAt: "2026-09-02T11:00:00.000Z",
    },
    {
      id: 3,
      name: "Charlie Requester",
      email: "charlie@example.com",
      role: "REQUESTER",
      isActive: false,
      mustChangePassword: false,
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSession).mockResolvedValue(adminSession);
    vi.mocked(api.fetchAdminUsers).mockResolvedValue({ users: sampleUsers });
    vi.mocked(api.logout).mockResolvedValue();
  });

  const renderComponent = () =>
    render(
      <AuthProvider>
        <UserManagement />
      </AuthProvider>
    );

  describe("Loading, Rendering & Filter Interactions", () => {
    it("renders user table and cards with correct details", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "User Management" })).toBeInTheDocument();
      });

      // Verify all sample users rendered
      expect(screen.getAllByText("Admin Alice").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Bob Staff").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Charlie Requester").length).toBeGreaterThanOrEqual(1);

      // Verify role labels
      expect(screen.getAllByText("Administrator").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("IT Staff").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Requester").length).toBeGreaterThanOrEqual(1);

      // Verify status and password states
      expect(screen.getAllByText("Must change password").length).toBeGreaterThanOrEqual(1);
    });

    it("debounces search input by 300ms", async () => {
      renderComponent();

      await waitFor(() => {
        expect(api.fetchAdminUsers).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByLabelText("Search users");
      fireEvent.change(searchInput, { target: { value: "Charlie" } });

      await waitFor(
        () => {
          expect(api.fetchAdminUsers).toHaveBeenCalledWith(
            expect.objectContaining({ search: "Charlie" })
          );
        },
        { timeout: 1500 }
      );
    });

    it("filters by role when dropdown changes", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText("Filter by role")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("Filter by role"), {
        target: { value: "IT_STAFF" },
      });

      await waitFor(() => {
        expect(api.fetchAdminUsers).toHaveBeenCalledWith(
          expect.objectContaining({ role: "IT_STAFF" })
        );
      });
    });

    it("displays filtered no-results state and allows clearing filters", async () => {
      vi.mocked(api.fetchAdminUsers).mockResolvedValueOnce({ users: [] });
      renderComponent();

      const searchInput = screen.getByLabelText("Search users");
      fireEvent.change(searchInput, { target: { value: "NonExistent" } });

      await waitFor(() => {
        expect(screen.getByText("No matching users found")).toBeInTheDocument();
      });

      const clearBtn = screen.getAllByRole("button", { name: /clear filters/i })[0];
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(searchInput).toHaveValue("");
      });
    });

    it("renders error state with retry button on failure", async () => {
      vi.mocked(api.fetchAdminUsers).mockRejectedValueOnce(new Error("Network connection failed"));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Error loading users")).toBeInTheDocument();
        expect(screen.getByText("Network connection failed")).toBeInTheDocument();
      });

      // Click retry
      vi.mocked(api.fetchAdminUsers).mockResolvedValueOnce({ users: sampleUsers });
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => {
        expect(screen.getAllByText("Admin Alice").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("discards deferred out-of-order responses and does not overwrite current results", async () => {
      let resolveFirst: (value: { users: AdminUser[] }) => void;
      const firstPromise = new Promise<{ users: AdminUser[] }>((resolve) => {
        resolveFirst = resolve;
      });

      const secondResult: AdminUser[] = [
        {
          id: 3,
          name: "Charlie Requester",
          email: "charlie@example.com",
          role: "REQUESTER",
          isActive: false,
          mustChangePassword: false,
          createdAt: "2026-09-18T10:00:00.000Z",
          updatedAt: "2026-09-18T10:00:00.000Z",
        },
      ];

      const firstResult: AdminUser[] = [
        {
          id: 2,
          name: "Bob Staff",
          email: "bob.staff@example.com",
          role: "IT_STAFF",
          isActive: true,
          mustChangePassword: true,
          createdAt: "2026-09-18T10:00:00.000Z",
          updatedAt: "2026-09-18T10:00:00.000Z",
        },
      ];

      vi.mocked(api.fetchAdminUsers).mockResolvedValueOnce({ users: sampleUsers });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText("Admin Alice").length).toBeGreaterThanOrEqual(1);
      });

      vi.mocked(api.fetchAdminUsers)
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValueOnce({ users: secondResult });

      const searchInput = screen.getByLabelText("Search users");

      // Trigger request 1
      fireEvent.change(searchInput, { target: { value: "bob" } });
      await waitFor(() => {
        expect(api.fetchAdminUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: "bob" })
        );
      }, { timeout: 1500 });

      // Trigger request 2 before request 1 resolves
      fireEvent.change(searchInput, { target: { value: "charlie" } });
      await waitFor(() => {
        expect(api.fetchAdminUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: "charlie" })
        );
      }, { timeout: 1500 });

      // Request 2 finishes first, rendering Charlie
      await waitFor(() => {
        expect(screen.getAllByText("Charlie Requester").length).toBeGreaterThanOrEqual(1);
      });

      // Now resolve request 1 late (out-of-order)
      act(() => {
        resolveFirst!({ users: firstResult });
      });

      // Give event loop time to process any stale response
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Charlie remains rendered; Bob must NOT overwrite Charlie
      expect(screen.getAllByText("Charlie Requester").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Bob Staff")).not.toBeInTheDocument();
      expect(screen.queryByText("Loading users...")).not.toBeInTheDocument();
    });
  });

  describe("Create User Dialog & Password Security", () => {
    it("opens create user modal with focus on name input", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Create User" }));

      const modal = screen.getByRole("dialog", { name: "Create New User" });
      expect(modal).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Full Name/i);
      await waitFor(() => {
        expect(document.activeElement).toBe(nameInput);
      });
    });

    it("validates required fields and password policy on client side", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Create User" }));

      const modal = screen.getByRole("dialog", { name: "Create New User" });
      // Submit empty form
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));

      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Initial password is required")).toBeInTheDocument();
      expect(api.createAdminUser).not.toHaveBeenCalled();
    });

    it("clears initial password field immediately upon API failure (Password Privacy)", async () => {
      vi.mocked(api.createAdminUser).mockRejectedValueOnce(
        new ApiClientError("Email address is already in use", 409, "DUPLICATE_EMAIL")
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Create User" }));

      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: "New User" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "duplicate@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Initial Password/i), {
        target: { value: "SecretTempPassword123!" },
      });

      const modal = screen.getByRole("dialog", { name: "Create New User" });
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));

      // Error banner displays safe message
      await waitFor(() => {
        expect(screen.getByText("Email address is already in use")).toBeInTheDocument();
      });

      // SECURITY CRITICAL: Password field is wiped clean on failure
      expect(screen.getByLabelText(/Initial Password/i)).toHaveValue("");

      // Other fields are preserved so the user doesn't lose their inputs
      expect(screen.getByLabelText(/Full Name/i)).toHaveValue("New User");
      expect(screen.getByLabelText(/Email Address/i)).toHaveValue("duplicate@example.com");

      // Password value is NEVER rendered in DOM or error banner
      expect(screen.queryByText("SecretTempPassword123!")).not.toBeInTheDocument();
    });

    it("successfully creates user, closes modal, and refreshes list", async () => {
      const newUser: AdminUser = {
        id: 4,
        name: "David New",
        email: "david@example.com",
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
        createdAt: "2026-09-18T10:00:00.000Z",
        updatedAt: "2026-09-18T10:00:00.000Z",
      };
      vi.mocked(api.createAdminUser).mockResolvedValueOnce({ user: newUser });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Create User" }));

      const modal = screen.getByRole("dialog", { name: "Create New User" });
      fireEvent.change(within(modal).getByLabelText(/Full Name/i), { target: { value: "David New" } });
      fireEvent.change(within(modal).getByLabelText(/Email Address/i), { target: { value: "david@example.com" } });
      fireEvent.change(within(modal).getByLabelText(/Role/i), { target: { value: "IT_STAFF" } });
      fireEvent.change(within(modal).getByLabelText(/Initial Password/i), { target: { value: "ValidPassword1!" } });

      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));

      await waitFor(() => {
        expect(api.createAdminUser).toHaveBeenCalledWith({
          name: "David New",
          email: "david@example.com",
          role: "IT_STAFF",
          isActive: true,
          initialPassword: "ValidPassword1!",
        });
      });

      // Modal closed and toast displayed
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("✓ User created successfully")).toBeInTheDocument();
      });
    });

    it("enforces server-equivalent password boundaries (10 chars, no NUL, symbol not space, <=72 bytes)", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Create User" }));

      const modal = screen.getByRole("dialog", { name: "Create New User" });

      fireEvent.change(within(modal).getByLabelText(/Full Name/i), { target: { value: "Test Boundary" } });
      fireEvent.change(within(modal).getByLabelText(/Email Address/i), { target: { value: "test@example.com" } });

      // 1. 9 characters (less than 10): "Short12!a"
      fireEvent.change(within(modal).getByLabelText(/Initial Password/i), { target: { value: "Short12!a" } });
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));
      expect(screen.getByText("Password does not meet all complexity requirements")).toBeInTheDocument();
      expect(api.createAdminUser).not.toHaveBeenCalled();

      // 2. Whitespace used as symbol: "Password12 "
      fireEvent.change(within(modal).getByLabelText(/Initial Password/i), { target: { value: "Password12 " } });
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));
      expect(screen.getByText("Password does not meet all complexity requirements")).toBeInTheDocument();
      expect(api.createAdminUser).not.toHaveBeenCalled();

      // 3. Contains NUL character: "ValidPass1!\0"
      fireEvent.change(within(modal).getByLabelText(/Initial Password/i), { target: { value: "ValidPass1!\0" } });
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));
      expect(screen.getByText("Password does not meet all complexity requirements")).toBeInTheDocument();
      expect(api.createAdminUser).not.toHaveBeenCalled();

      // 4. Exceeds 72 UTF-8 bytes
      const longPass = "ValidPass1!" + "a".repeat(65);
      fireEvent.change(within(modal).getByLabelText(/Initial Password/i), { target: { value: longPass } });
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));
      expect(screen.getByText("Password does not meet all complexity requirements")).toBeInTheDocument();
      expect(api.createAdminUser).not.toHaveBeenCalled();

      // 5. Valid 10-character password: "ValidPass1!"
      vi.mocked(api.createAdminUser).mockResolvedValueOnce({
        user: {
          id: 10,
          name: "Test Boundary",
          email: "test@example.com",
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: true,
          createdAt: "2026-09-18T10:00:00.000Z",
          updatedAt: "2026-09-18T10:00:00.000Z",
        },
      });
      fireEvent.change(within(modal).getByLabelText(/Initial Password/i), { target: { value: "ValidPass1!" } });
      fireEvent.click(within(modal).getByRole("button", { name: "Create User" }));

      await waitFor(() => {
        expect(api.createAdminUser).toHaveBeenCalledWith({
          name: "Test Boundary",
          email: "test@example.com",
          role: "REQUESTER",
          isActive: true,
          initialPassword: "ValidPass1!",
        });
      });
    });
  });

  describe("Edit User Dialog & Protections", () => {
    it("opens edit modal prefilled with user data", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Edit user Bob Staff" })[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole("button", { name: "Edit user Bob Staff" })[0]);

      const modal = screen.getByRole("dialog", { name: "Edit User: Bob Staff" });
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByLabelText(/Full Name/i)).toHaveValue("Bob Staff");
      expect(within(modal).getByLabelText(/Email Address/i)).toHaveValue("bob.staff@example.com");
      expect(within(modal).getByLabelText(/Role/i)).toHaveValue("IT_STAFF");
      expect(within(modal).getByLabelText(/Active Account/i)).toBeChecked();
    });

    it("disables Active Account checkbox for own administrator account", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Edit user Admin Alice" })[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole("button", { name: "Edit user Admin Alice" })[0]);

      const activeCheckbox = screen.getByLabelText(/Active Account/i);
      expect(activeCheckbox).toBeDisabled();
      expect(screen.getByText("You cannot deactivate your own account.")).toBeInTheDocument();
    });

    it("displays error when server returns LAST_ACTIVE_ADMIN conflict", async () => {
      vi.mocked(api.updateAdminUser).mockRejectedValueOnce(
        new ApiClientError("Cannot deactivate or demote the last active administrator", 409, "LAST_ACTIVE_ADMIN")
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Edit user Admin Alice" })[0]).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByRole("button", { name: "Edit user Admin Alice" })[0]);

      const modal = screen.getByRole("dialog", { name: "Edit User: Admin Alice" });
      fireEvent.change(within(modal).getByLabelText(/Role/i), { target: { value: "IT_STAFF" } });
      fireEvent.click(within(modal).getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(screen.getByText("Cannot deactivate or demote the last active administrator")).toBeInTheDocument();
      });
    });
  });

  describe("Reset Initial Password Dialog & Password Security", () => {
    it("validates password confirmation matching and password checklist", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]);

      expect(screen.getByRole("dialog", { name: "Reset Initial Password" })).toBeInTheDocument();

      // Mismatch
      fireEvent.change(screen.getByLabelText(/New Initial Password/i), {
        target: { value: "ValidPassword1!" },
      });
      fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
        target: { value: "DifferentPassword1!" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
      expect(api.resetAdminUserPassword).not.toHaveBeenCalled();
    });

    it("clears both password fields immediately upon API failure (Password Privacy)", async () => {
      vi.mocked(api.resetAdminUserPassword).mockRejectedValueOnce(
        new ApiClientError("Failed to update password", 500)
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]);

      const passInput = screen.getByLabelText(/New Initial Password/i);
      const confirmInput = screen.getByLabelText(/Confirm New Password/i);

      fireEvent.change(passInput, { target: { value: "TemporaryPassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "TemporaryPassword123!" } });

      fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

      await waitFor(() => {
        expect(screen.getByText("Failed to update password")).toBeInTheDocument();
      });

      // SECURITY CRITICAL: Both password fields must be cleared on failure
      expect(passInput).toHaveValue("");
      expect(confirmInput).toHaveValue("");

      // Never display submitted password in DOM
      expect(screen.queryByText("TemporaryPassword123!")).not.toBeInTheDocument();
    });

    it("successfully resets initial password and closes modal", async () => {
      vi.mocked(api.resetAdminUserPassword).mockResolvedValueOnce();

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]);

      fireEvent.change(screen.getByLabelText(/New Initial Password/i), {
        target: { value: "TemporaryPassword123!" },
      });
      fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
        target: { value: "TemporaryPassword123!" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

      await waitFor(() => {
        expect(api.resetAdminUserPassword).toHaveBeenCalledWith(2, {
          initialPassword: "TemporaryPassword123!",
          confirmPassword: "TemporaryPassword123!",
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("✓ Initial password reset successfully")).toBeInTheDocument();
      });
    });

    it("enforces server-equivalent password boundaries on reset initial password form", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]
        ).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByRole("button", { name: "Reset password for Bob Staff" })[0]);

      const modal = screen.getByRole("dialog", { name: "Reset Initial Password" });
      const passInput = within(modal).getByLabelText(/New Initial Password/i);
      const confirmInput = within(modal).getByLabelText(/Confirm New Password/i);

      // 1. 9 chars
      fireEvent.change(passInput, { target: { value: "Short12!a" } });
      fireEvent.change(confirmInput, { target: { value: "Short12!a" } });
      fireEvent.click(within(modal).getByRole("button", { name: "Reset Password" }));
      expect(screen.getByText("Password does not meet complexity requirements")).toBeInTheDocument();
      expect(api.resetAdminUserPassword).not.toHaveBeenCalled();

      // 2. Whitespace as symbol
      fireEvent.change(passInput, { target: { value: "Password12 " } });
      fireEvent.change(confirmInput, { target: { value: "Password12 " } });
      fireEvent.click(within(modal).getByRole("button", { name: "Reset Password" }));
      expect(screen.getByText("Password does not meet complexity requirements")).toBeInTheDocument();
      expect(api.resetAdminUserPassword).not.toHaveBeenCalled();

      // 3. Contains NUL
      fireEvent.change(passInput, { target: { value: "ValidPass1!\0" } });
      fireEvent.change(confirmInput, { target: { value: "ValidPass1!\0" } });
      fireEvent.click(within(modal).getByRole("button", { name: "Reset Password" }));
      expect(screen.getByText("Password does not meet complexity requirements")).toBeInTheDocument();
      expect(api.resetAdminUserPassword).not.toHaveBeenCalled();

      // 4. Exceeds 72 UTF-8 bytes
      const longPass = "ValidPass1!" + "a".repeat(65);
      fireEvent.change(passInput, { target: { value: longPass } });
      fireEvent.change(confirmInput, { target: { value: longPass } });
      fireEvent.click(within(modal).getByRole("button", { name: "Reset Password" }));
      expect(screen.getByText("Password does not meet complexity requirements")).toBeInTheDocument();
      expect(api.resetAdminUserPassword).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility & Dialog Keyboard Behavior", () => {
    it("dismisses modal when Escape key is pressed", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create User" })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Create User" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });
});
