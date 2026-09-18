import { describe, expect, it } from "vitest";
import {
  parseAdminUserQuery,
  parseCreateUser,
  parseUpdateUser,
  parseInitialPasswordReset,
} from "../../src/validators/admin.validator.js";
import { ApiError } from "../../src/errors/api-error.js";

describe("UNIT-04: Admin User Management Validators", () => {
  describe("parseAdminUserQuery", () => {
    it("accepts empty query and returns empty filters", () => {
      expect(parseAdminUserQuery({})).toEqual({});
    });

    it("accepts valid search and role, trimming search", () => {
      expect(parseAdminUserQuery({ search: "  Alice  ", role: "IT_STAFF" })).toEqual({
        search: "Alice",
        role: "IT_STAFF",
      });
    });

    it("treats empty string search and role as undefined", () => {
      expect(parseAdminUserQuery({ search: "   ", role: "" })).toEqual({});
    });

    it("accepts search up to 150 Unicode code points and rejects 151 Unicode code points (emoji boundary test)", () => {
      // 150 emoji characters: each emoji is 2 UTF-16 code units (length 300), but exactly 150 Unicode code points
      const exact150Emoji = "🎫".repeat(150);
      expect(Array.from(exact150Emoji).length).toBe(150);
      expect(parseAdminUserQuery({ search: exact150Emoji })).toEqual({ search: exact150Emoji });

      const overflow151Emoji = "🎫".repeat(151);
      expect(Array.from(overflow151Emoji).length).toBe(151);
      expect(() => parseAdminUserQuery({ search: overflow151Emoji })).toThrowError(ApiError);
    });

    it("rejects search longer than 150 characters (ASCII boundary)", () => {
      expect(() => parseAdminUserQuery({ search: "a".repeat(151) })).toThrowError(ApiError);
    });

    it("rejects invalid role value", () => {
      expect(() => parseAdminUserQuery({ role: "SUPERUSER" })).toThrowError(ApiError);
    });

    it("rejects array query parameters", () => {
      expect(() => parseAdminUserQuery({ search: ["a", "b"] })).toThrowError(ApiError);
      expect(() => parseAdminUserQuery({ role: ["IT_STAFF"] })).toThrowError(ApiError);
    });

    it("rejects unknown query parameters", () => {
      expect(() => parseAdminUserQuery({ search: "test", page: "1" })).toThrowError(ApiError);
      expect(() => parseAdminUserQuery({ unknownKey: "value" })).toThrowError(ApiError);
    });
  });

  describe("parseCreateUser", () => {
    const validBody = {
      name: "Alice Smith",
      email: "Alice.Smith@Example.COM",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "TempPassword123!",
    };

    it("accepts exact valid body, normalizes email, and trims name", () => {
      const result = parseCreateUser(validBody);
      expect(result).toEqual({
        name: "Alice Smith",
        email: "alice.smith@example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "TempPassword123!",
      });
    });

    it("accepts unicode name within 1-100 code points", () => {
      const thaiName = "สมชาย ใจดี";
      const result = parseCreateUser({ ...validBody, name: thaiName });
      expect(result.name).toBe(thaiName);
    });

    it("rejects missing required fields", () => {
      const { initialPassword, ...missingPassword } = validBody;
      expect(() => parseCreateUser(missingPassword)).toThrowError(ApiError);
      const { email, ...missingEmail } = validBody;
      expect(() => parseCreateUser(missingEmail)).toThrowError(ApiError);
    });

    it("rejects unknown or extra fields", () => {
      expect(() => parseCreateUser({ ...validBody, extra: "field" })).toThrowError(ApiError);
    });

    it("rejects non-boolean isActive", () => {
      expect(() => parseCreateUser({ ...validBody, isActive: "true" })).toThrowError(ApiError);
      expect(() => parseCreateUser({ ...validBody, isActive: 1 })).toThrowError(ApiError);
    });

    it("rejects invalid role", () => {
      expect(() => parseCreateUser({ ...validBody, role: "MANAGER" })).toThrowError(ApiError);
    });

    it("rejects empty name or name > 100 code points", () => {
      expect(() => parseCreateUser({ ...validBody, name: "   " })).toThrowError(ApiError);
      expect(() => parseCreateUser({ ...validBody, name: "a".repeat(101) })).toThrowError(ApiError);
    });

    it("rejects invalid initial password violating Lab 3 policy", () => {
      expect(() => parseCreateUser({ ...validBody, initialPassword: "short" })).toThrowError(ApiError);
      expect(() => parseCreateUser({ ...validBody, initialPassword: "NoSpecialChars123" })).toThrowError(ApiError);
    });
  });

  describe("parseUpdateUser", () => {
    it("accepts non-empty subset of allowed fields", () => {
      expect(parseUpdateUser({ name: "Bob New" })).toEqual({ name: "Bob New" });
      expect(parseUpdateUser({ email: "BOB@EXAMPLE.COM" })).toEqual({ email: "bob@example.com" });
      expect(parseUpdateUser({ role: "ADMINISTRATOR" })).toEqual({ role: "ADMINISTRATOR" });
      expect(parseUpdateUser({ isActive: false })).toEqual({ isActive: false });
    });

    it("rejects empty update body", () => {
      expect(() => parseUpdateUser({})).toThrowError(ApiError);
    });

    it("rejects unknown fields in update", () => {
      expect(() => parseUpdateUser({ name: "Bob", password: "Password123!" })).toThrowError(ApiError);
      expect(() => parseUpdateUser({ id: 5 })).toThrowError(ApiError);
    });

    it("rejects invalid role in update", () => {
      expect(() => parseUpdateUser({ role: "ROOT" })).toThrowError(ApiError);
    });

    it("rejects non-boolean isActive in update", () => {
      expect(() => parseUpdateUser({ isActive: "false" })).toThrowError(ApiError);
    });

    it("rejects invalid name in update", () => {
      expect(() => parseUpdateUser({ name: " " })).toThrowError(ApiError);
      expect(() => parseUpdateUser({ name: "x".repeat(101) })).toThrowError(ApiError);
    });
  });

  describe("parseInitialPasswordReset", () => {
    it("accepts matching valid passwords", () => {
      const result = parseInitialPasswordReset({
        initialPassword: "NewSecurePassword1!",
        confirmPassword: "NewSecurePassword1!",
      });
      expect(result).toEqual({
        initialPassword: "NewSecurePassword1!",
        confirmPassword: "NewSecurePassword1!",
      });
    });

    it("rejects confirmation mismatch", () => {
      expect(() =>
        parseInitialPasswordReset({
          initialPassword: "NewSecurePassword1!",
          confirmPassword: "DifferentPassword1!",
        })
      ).toThrowError(ApiError);
    });

    it("rejects missing fields or extra fields", () => {
      expect(() => parseInitialPasswordReset({ initialPassword: "NewSecurePassword1!" })).toThrowError(ApiError);
      expect(() =>
        parseInitialPasswordReset({
          initialPassword: "NewSecurePassword1!",
          confirmPassword: "NewSecurePassword1!",
          extra: "nope",
        })
      ).toThrowError(ApiError);
    });

    it("rejects weak password violating Lab 3 policy", () => {
      expect(() =>
        parseInitialPasswordReset({
          initialPassword: "weak",
          confirmPassword: "weak",
        })
      ).toThrowError(ApiError);
    });
  });
});
