import { ApiError } from "../errors/api-error.js";

export function authBody(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Invalid request fields" });
  }
  return value as Record<string, unknown>;
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Enter a valid email address" });
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Enter a valid email address" });
  }
  return email;
}

export function passwordProblems(value: unknown): string[] {
  if (typeof value !== "string") return ["Password is required"];
  const errors: string[] = [];
  if (Array.from(value).length < 10) errors.push("Use at least 10 characters");
  if (Buffer.byteLength(value, "utf8") > 72) errors.push("Use at most 72 UTF-8 bytes");
  if (value.includes("\0")) errors.push("NUL characters are not allowed");
  if (!/[A-Z]/.test(value)) errors.push("Include an uppercase letter");
  if (!/[a-z]/.test(value)) errors.push("Include a lowercase letter");
  if (!/[0-9]/.test(value)) errors.push("Include a digit");
  if (!/[^\p{L}\p{N}\s]/u.test(value)) errors.push("Include a symbol");
  return errors;
}

export function validatePassword(value: unknown): asserts value is string {
  const details = passwordProblems(value);
  if (details.length) throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password does not meet the requirements", details });
}
