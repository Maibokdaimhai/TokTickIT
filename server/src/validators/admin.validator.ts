import { ApiError } from "../errors/api-error.js";
import { normalizeEmail, validatePassword } from "./auth.validator.js";
import type { UserRole } from "@prisma/client";

const VALID_ROLES: readonly UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

export function parseAdminUserQuery(query: Record<string, unknown>): { search?: string; role?: UserRole } {
  const allowedKeys = ["search", "role"];
  for (const key of Object.keys(query)) {
    if (!allowedKeys.includes(key)) {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: `Unknown query parameter: ${key}`,
      });
    }
  }

  let search: string | undefined;
  if (query.search !== undefined) {
    if (typeof query.search !== "string") {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "search parameter must be a string",
      });
    }
    const trimmed = query.search.trim();
    const searchCodePoints = Array.from(trimmed).length;
    if (searchCodePoints > 150) {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "search query cannot exceed 150 characters",
      });
    }
    if (searchCodePoints > 0) {
      search = trimmed;
    }
  }

  let role: UserRole | undefined;
  if (query.role !== undefined) {
    if (typeof query.role !== "string") {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "role parameter must be a string",
      });
    }
    const trimmedRole = query.role.trim();
    if (trimmedRole.length > 0) {
      if (!VALID_ROLES.includes(trimmedRole as UserRole)) {
        throw new ApiError(400, {
          code: "VALIDATION_ERROR",
          message: "role must be REQUESTER, IT_STAFF, or ADMINISTRATOR",
        });
      }
      role = trimmedRole as UserRole;
    }
  }

  return { ...(search && { search }), ...(role && { role }) };
}

export function parseCreateUser(body: unknown): {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  initialPassword: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" });
  }

  const record = body as Record<string, unknown>;
  const requiredFields = ["name", "email", "role", "isActive", "initialPassword"];
  const bodyKeys = Object.keys(record);

  for (const field of requiredFields) {
    if (!bodyKeys.includes(field)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Missing required field: ${field}` });
    }
  }
  for (const key of bodyKeys) {
    if (!requiredFields.includes(key)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Unknown field: ${key}` });
    }
  }

  if (typeof record.name !== "string") {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be a string" });
  }
  const trimmedName = record.name.trim();
  const nameLength = Array.from(trimmedName).length;
  if (nameLength < 1 || nameLength > 100) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be between 1 and 100 characters" });
  }

  const email = normalizeEmail(record.email);

  if (typeof record.role !== "string" || !VALID_ROLES.includes(record.role as UserRole)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR" });
  }

  if (typeof record.isActive !== "boolean") {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "isActive must be a boolean" });
  }

  validatePassword(record.initialPassword);

  return {
    name: trimmedName,
    email,
    role: record.role as UserRole,
    isActive: record.isActive,
    initialPassword: record.initialPassword,
  };
}

export function parseUpdateUser(body: unknown): {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" });
  }

  const record = body as Record<string, unknown>;
  const allowedFields = ["name", "email", "role", "isActive"];
  const bodyKeys = Object.keys(record);

  if (bodyKeys.length === 0) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Update payload cannot be empty" });
  }

  for (const key of bodyKeys) {
    if (!allowedFields.includes(key)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Unknown field: ${key}` });
    }
  }

  const result: { name?: string; email?: string; role?: UserRole; isActive?: boolean } = {};

  if (record.name !== undefined) {
    if (typeof record.name !== "string") {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be a string" });
    }
    const trimmedName = record.name.trim();
    const nameLength = Array.from(trimmedName).length;
    if (nameLength < 1 || nameLength > 100) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be between 1 and 100 characters" });
    }
    result.name = trimmedName;
  }

  if (record.email !== undefined) {
    result.email = normalizeEmail(record.email);
  }

  if (record.role !== undefined) {
    if (typeof record.role !== "string" || !VALID_ROLES.includes(record.role as UserRole)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR" });
    }
    result.role = record.role as UserRole;
  }

  if (record.isActive !== undefined) {
    if (typeof record.isActive !== "boolean") {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "isActive must be a boolean" });
    }
    result.isActive = record.isActive;
  }

  return result;
}

export function parseInitialPasswordReset(body: unknown): {
  initialPassword: string;
  confirmPassword: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" });
  }

  const record = body as Record<string, unknown>;
  const requiredFields = ["initialPassword", "confirmPassword"];
  const bodyKeys = Object.keys(record);

  for (const field of requiredFields) {
    if (!bodyKeys.includes(field)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Missing required field: ${field}` });
    }
  }
  for (const key of bodyKeys) {
    if (!requiredFields.includes(key)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Unknown field: ${key}` });
    }
  }

  if (typeof record.initialPassword !== "string" || typeof record.confirmPassword !== "string") {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password fields must be strings" });
  }

  if (record.initialPassword !== record.confirmPassword) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password confirmation must match" });
  }

  validatePassword(record.initialPassword);

  return {
    initialPassword: record.initialPassword,
    confirmPassword: record.confirmPassword,
  };
}
