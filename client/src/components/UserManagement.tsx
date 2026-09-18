import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext.js";
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  ApiClientError,
} from "../api.js";
import type {
  AdminUser,
  UserRole,
  CreateUserPayload,
  UpdateUserPayload,
  ResetInitialPasswordPayload,
} from "../types.js";
import { passwordRules } from "../utils/password-rules.js";

const VALID_ROLES: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

function roleLabel(role: UserRole): string {
  switch (role) {
    case "REQUESTER":
      return "Requester";
    case "IT_STAFF":
      return "IT Staff";
    case "ADMINISTRATOR":
      return "Administrator";
    default:
      return role;
  }
}

function roleBadgeClass(role: UserRole): string {
  switch (role) {
    case "ADMINISTRATOR":
      return "badge-admin";
    case "IT_STAFF":
      return "badge-staff";
    case "REQUESTER":
      return "badge-requester";
    default:
      return "badge-neutral";
  }
}

// Trap focus inside modal container
function useFocusTrap(isOpen: boolean, containerRef: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, containerRef]);
}

interface PasswordChecklistProps {
  password: string;
}

const PasswordChecklist: React.FC<PasswordChecklistProps> = ({ password }) => {
  const rules = passwordRules(password);

  return (
    <ul className="password-checklist" aria-label="Password requirements">
      {rules.map((r, i) => (
        <li key={i} className={r.valid ? "rule-met" : "rule-unmet"}>
          <span className="rule-icon" aria-hidden="true">
            {r.valid ? "✓" : "○"}
          </span>
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
};

// Create User Modal
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("REQUESTER");
  const [isActive, setIsActive] = useState(true);
  const [initialPassword, setInitialPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setEmail("");
      setRole("REQUESTER");
      setIsActive(true);
      setInitialPassword("");
      setShowPassword(false);
      setFieldErrors({});
      setApiError(null);
      setSubmitting(false);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = "Name is required";
    } else if (Array.from(trimmedName).length > 100) {
      errors.name = "Name must be 100 characters or fewer";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    if (!VALID_ROLES.includes(role)) {
      errors.role = "Please select a valid role";
    }

    const isPassValid = passwordRules(initialPassword).every((r) => r.valid);

    if (!initialPassword) {
      errors.initialPassword = "Initial password is required";
    } else if (!isPassValid) {
      errors.initialPassword = "Password does not meet all complexity requirements";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setApiError(null);

    const payload: CreateUserPayload = {
      name: name.trim(),
      email: email.trim(),
      role,
      isActive,
      initialPassword,
    };

    try {
      await createAdminUser(payload);
      setInitialPassword("");
      onSuccess();
      onClose();
    } catch (err: any) {
      // SECURITY: Clear initialPassword on failure while preserving other fields
      setInitialPassword("");
      if (err instanceof ApiClientError) {
        if (err.code === "DUPLICATE_EMAIL" || err.status === 409) {
          setApiError("Email address is already in use");
        } else {
          setApiError(err.message || "Failed to create user");
        }
      } else {
        setApiError(err?.message || "Failed to create user");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card user-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
      >
        <div className="modal-header">
          <h2 id="create-user-title">Create New User</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {apiError && (
              <div className="dialog-error-banner" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{apiError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="create-name" className="form-label">
                Full Name <span className="required-star">*</span>
              </label>
              <input
                id="create-name"
                ref={nameInputRef}
                type="text"
                className={`form-input ${fieldErrors.name ? "input-error" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                maxLength={150}
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "create-name-error" : undefined}
              />
              {fieldErrors.name && (
                <span id="create-name-error" className="form-error-msg">
                  {fieldErrors.name}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="create-email" className="form-label">
                Email Address <span className="required-star">*</span>
              </label>
              <input
                id="create-email"
                type="email"
                className={`form-input ${fieldErrors.email ? "input-error" : ""}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "create-email-error" : undefined}
              />
              {fieldErrors.email && (
                <span id="create-email-error" className="form-error-msg">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="create-role" className="form-label">
                Role <span className="required-star">*</span>
              </label>
              <select
                id="create-role"
                className={`form-select ${fieldErrors.role ? "input-error" : ""}`}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={submitting}
                aria-required="true"
              >
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
              {fieldErrors.role && (
                <span className="form-error-msg">{fieldErrors.role}</span>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label" htmlFor="create-active">
                <input
                  id="create-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={submitting}
                />
                <span>Active Account</span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="create-password" className="form-label">
                Initial Password <span className="required-star">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  id="create-password"
                  type={showPassword ? "text" : "password"}
                  className={`form-input ${fieldErrors.initialPassword ? "input-error" : ""}`}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  autoComplete="new-password"
                  disabled={submitting}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.initialPassword)}
                  aria-describedby={
                    fieldErrors.initialPassword ? "create-pass-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={0}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.initialPassword && (
                <span id="create-pass-error" className="form-error-msg">
                  {fieldErrors.initialPassword}
                </span>
              )}
              <PasswordChecklist password={initialPassword} />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Modal
interface EditUserModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onSuccess }) => {
  const { session, logout } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("REQUESTER");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive);
      setFieldErrors({});
      setApiError(null);
      setSubmitting(false);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !user) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = "Name is required";
    } else if (Array.from(trimmedName).length > 100) {
      errors.name = "Name must be 100 characters or fewer";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    if (!VALID_ROLES.includes(role)) {
      errors.role = "Please select a valid role";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setApiError(null);

    const payload: UpdateUserPayload = {};
    if (name.trim() !== user.name) payload.name = name.trim();
    if (email.trim() !== user.email) payload.email = email.trim();
    if (role !== user.role) payload.role = role;
    if (isActive !== user.isActive) payload.isActive = isActive;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    try {
      await updateAdminUser(user.id, payload);
      onSuccess();
      onClose();

      // If current admin was demoted, log out immediately
      if (session?.user?.id === user.id && role !== "ADMINISTRATOR") {
        await logout();
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.code === "SELF_DEACTIVATION") {
          setApiError("Administrators cannot deactivate their own account");
        } else if (err.code === "LAST_ACTIVE_ADMIN") {
          setApiError("Cannot deactivate or demote the last active administrator");
        } else if (err.code === "DUPLICATE_EMAIL" || err.status === 409) {
          setApiError("Email address is already in use");
        } else {
          setApiError(err.message || "Failed to update user");
        }
      } else {
        setApiError(err?.message || "Failed to update user");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isSelf = session?.user?.id === user.id;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card user-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
      >
        <div className="modal-header">
          <h2 id="edit-user-title">Edit User: {user.name}</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {apiError && (
              <div className="dialog-error-banner" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{apiError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="edit-name" className="form-label">
                Full Name <span className="required-star">*</span>
              </label>
              <input
                id="edit-name"
                ref={nameInputRef}
                type="text"
                className={`form-input ${fieldErrors.name ? "input-error" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && (
                <span className="form-error-msg">{fieldErrors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="edit-email" className="form-label">
                Email Address <span className="required-star">*</span>
              </label>
              <input
                id="edit-email"
                type="email"
                className={`form-input ${fieldErrors.email ? "input-error" : ""}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && (
                <span className="form-error-msg">{fieldErrors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="edit-role" className="form-label">
                Role <span className="required-star">*</span>
              </label>
              <select
                id="edit-role"
                className={`form-select ${fieldErrors.role ? "input-error" : ""}`}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={submitting}
                aria-required="true"
              >
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
              {isSelf && role !== "ADMINISTRATOR" && (
                <span className="form-warning-msg">
                  Warning: Demoting yourself will immediately end your administrator session.
                </span>
              )}
              {fieldErrors.role && (
                <span className="form-error-msg">{fieldErrors.role}</span>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label" htmlFor="edit-active">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={submitting || isSelf}
                />
                <span>Active Account</span>
              </label>
              {isSelf && (
                <span className="form-hint-msg">You cannot deactivate your own account.</span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reset Initial Password Modal
interface ResetPasswordModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [initialPassword, setInitialPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (isOpen) {
      setInitialPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setFieldErrors({});
      setApiError(null);
      setSubmitting(false);
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !user) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const isPassValid = passwordRules(initialPassword).every((r) => r.valid);

    if (!initialPassword) {
      errors.initialPassword = "New initial password is required";
    } else if (!isPassValid) {
      errors.initialPassword = "Password does not meet complexity requirements";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Password confirmation is required";
    } else if (initialPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setApiError(null);

    const payload: ResetInitialPasswordPayload = {
      initialPassword,
      confirmPassword,
    };

    try {
      await resetAdminUserPassword(user.id, payload);
      setInitialPassword("");
      setConfirmPassword("");
      onSuccess();
      onClose();
    } catch (err: any) {
      // SECURITY: Clear both password fields immediately on failure
      setInitialPassword("");
      setConfirmPassword("");
      if (err instanceof ApiClientError) {
        setApiError(err.message || "Failed to reset password");
      } else {
        setApiError(err?.message || "Failed to reset password");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card user-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        <div className="modal-header">
          <h2 id="reset-password-title">Reset Initial Password</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="user-context-banner">
              <span>Target User:</span> <strong>{user.name}</strong> ({user.email})
            </div>

            {apiError && (
              <div className="dialog-error-banner" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{apiError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reset-password" className="form-label">
                New Initial Password <span className="required-star">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  id="reset-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  className={`form-input ${fieldErrors.initialPassword ? "input-error" : ""}`}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Enter new temporary password"
                  autoComplete="new-password"
                  disabled={submitting}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.initialPassword)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.initialPassword && (
                <span className="form-error-msg">{fieldErrors.initialPassword}</span>
              )}
              <PasswordChecklist password={initialPassword} />
            </div>

            <div className="form-group">
              <label htmlFor="reset-confirm" className="form-label">
                Confirm New Password <span className="required-star">*</span>
              </label>
              <input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                className={`form-input ${fieldErrors.confirmPassword ? "input-error" : ""}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm temporary password"
                autoComplete="new-password"
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
              />
              {fieldErrors.confirmPassword && (
                <span className="form-error-msg">{fieldErrors.confirmPassword}</span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);

  // Focused trigger tracking for focus restoration
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);

  // Success toast message
  const [feedback, setFeedback] = useState<string | null>(null);

  // Search debouncing (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users with effect-scoped cancellation and request-generation guard to discard out-of-order responses
  const [refreshCount, setRefreshCount] = useState(0);
  const reloadUsers = useCallback(() => {
    setRefreshCount((c) => c + 1);
  }, []);
  const loadUsers = reloadUsers;

  const requestGenRef = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const generation = ++requestGenRef.current;

    setLoading(true);
    setError(null);

    fetchAdminUsers({
      search: debouncedSearch.trim() || undefined,
      role: roleFilter || undefined,
      signal: controller.signal,
    })
      .then((res) => {
        if (!active || requestGenRef.current !== generation) return;
        setUsers(res.users);
      })
      .catch((err: any) => {
        if (!active || requestGenRef.current !== generation) return;
        if (err?.name === "AbortError") return;
        setError(err?.message || "Failed to load user list");
      })
      .finally(() => {
        if (!active || requestGenRef.current !== generation) return;
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedSearch, roleFilter, refreshCount]);

  const hasActiveFilters = Boolean(search.trim() || roleFilter);

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("");
  };

  const handleOpenCreate = () => {
    activeTriggerRef.current = createTriggerRef.current;
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user: AdminUser, e: React.MouseEvent<HTMLButtonElement>) => {
    activeTriggerRef.current = e.currentTarget;
    setEditingUser(user);
  };

  const handleOpenReset = (user: AdminUser, e: React.MouseEvent<HTMLButtonElement>) => {
    activeTriggerRef.current = e.currentTarget;
    setResettingUser(user);
  };

  const handleModalClose = () => {
    setIsCreateOpen(false);
    setEditingUser(null);
    setResettingUser(null);
    setTimeout(() => {
      activeTriggerRef.current?.focus();
      activeTriggerRef.current = null;
    }, 50);
  };

  return (
    <div className="user-management-container">
      {/* Header */}
      <div className="user-management-header">
        <div>
          <h1 className="user-management-title">User Management</h1>
          <p className="user-management-subtitle">
            Manage system accounts, assign roles, and administer initial passwords.
          </p>
        </div>
        <button
          ref={createTriggerRef}
          type="button"
          className="btn-primary create-user-btn"
          onClick={handleOpenCreate}
        >
          <span aria-hidden="true">+</span> Create User
        </button>
      </div>

      {feedback && (
        <div className="toast-success" role="status">
          <span>✓ {feedback}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss feedback"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="user-filters-card" role="region" aria-label="User search and filters">
        <div className="user-filters-grid">
          <div className="filter-group search-filter">
            <label htmlFor="user-search" className="filter-label">
              Search users
            </label>
            <div className="search-input-wrapper">
              <input
                id="user-search"
                type="text"
                className="form-input"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch("")}
                  aria-label="Clear search input"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="filter-group role-filter">
            <label htmlFor="role-filter" className="filter-label">
              Filter by role
            </label>
            <select
              id="role-filter"
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
            >
              <option value="">All Roles</option>
              <option value="REQUESTER">Requester</option>
              <option value="IT_STAFF">IT Staff</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div className="filter-actions">
              <button
                type="button"
                className="btn-secondary clear-filters-btn"
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content State Handling */}
      {loading ? (
        <div className="loading-container" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading users...</p>
        </div>
      ) : error ? (
        <div className="error-alert-card" role="alert">
          <div className="error-alert-content">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <div>
              <h3>Error loading users</h3>
              <p>{error}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary retry-btn"
            onClick={() => loadUsers()}
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-users-card" role="status">
          <div className="empty-icon" aria-hidden="true">👥</div>
          <h3>{hasActiveFilters ? "No matching users found" : "No users exist"}</h3>
          <p>
            {hasActiveFilters
              ? "Try adjusting your search query or role filter."
              : "Create your first user account to get started."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenCreate}
            >
              Create User
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="users-table-container desktop-only">
            <table className="users-table" aria-label="Users">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Password State</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={!u.isActive ? "row-inactive" : ""}>
                    <td className="user-name-cell">
                      <strong>{u.name}</strong>
                    </td>
                    <td className="user-email-cell">{u.email}</td>
                    <td>
                      <span className={`role-badge ${roleBadgeClass(u.role)}`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          u.isActive ? "status-active" : "status-inactive"
                        }`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {u.mustChangePassword ? (
                        <span className="pwd-badge pwd-must-change">
                          Must change password
                        </span>
                      ) : (
                        <span className="pwd-badge pwd-active">Active</span>
                      )}
                    </td>
                    <td className="text-right actions-cell">
                      <button
                        type="button"
                        className="action-btn edit-btn"
                        onClick={(e) => handleOpenEdit(u, e)}
                        aria-label={`Edit user ${u.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="action-btn reset-btn"
                        onClick={(e) => handleOpenReset(u, e)}
                        aria-label={`Reset password for ${u.name}`}
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< 768px) */}
          <div className="users-cards-container mobile-only" role="region" aria-label="User cards">
            {users.map((u) => (
              <div
                key={u.id}
                className={`user-card ${!u.isActive ? "card-inactive" : ""}`}
              >
                <div className="user-card-header">
                  <div>
                    <h2 className="user-card-name">{u.name}</h2>
                    <p className="user-card-email">{u.email}</p>
                  </div>
                  <span
                    className={`status-pill ${
                      u.isActive ? "status-active" : "status-inactive"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="user-card-details">
                  <div className="detail-row">
                    <span className="detail-label">Role:</span>
                    <span className={`role-badge ${roleBadgeClass(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Password:</span>
                    {u.mustChangePassword ? (
                      <span className="pwd-badge pwd-must-change">
                        Must change password
                      </span>
                    ) : (
                      <span className="pwd-badge pwd-active">Active</span>
                    )}
                  </div>
                </div>

                <div className="user-card-actions">
                  <button
                    type="button"
                    className="action-btn-mobile edit-btn"
                    onClick={(e) => handleOpenEdit(u, e)}
                    aria-label={`Edit user ${u.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="action-btn-mobile reset-btn"
                    onClick={(e) => handleOpenReset(u, e)}
                    aria-label={`Reset password for ${u.name}`}
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={handleModalClose}
        onSuccess={() => {
          setFeedback("User created successfully");
          loadUsers();
        }}
      />

      <EditUserModal
        user={editingUser}
        isOpen={Boolean(editingUser)}
        onClose={handleModalClose}
        onSuccess={() => {
          setFeedback("User updated successfully");
          loadUsers();
        }}
      />

      <ResetPasswordModal
        user={resettingUser}
        isOpen={Boolean(resettingUser)}
        onClose={handleModalClose}
        onSuccess={() => {
          setFeedback("Initial password reset successfully");
          loadUsers();
        }}
      />
    </div>
  );
};
