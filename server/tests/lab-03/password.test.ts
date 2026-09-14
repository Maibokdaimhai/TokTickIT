import { describe, it, expect } from "vitest";
import { passwordProblems, normalizeEmail, authBody } from "../../src/validators/auth.validator.js";
import { hashPassword, verifyPassword } from "../../src/utils/password.js";
describe("password policy and safe normalization", () => {
  it("counts Unicode code points and preserves whitespace", () => {
    expect(passwordProblems("Aa1!ก😀abc")).toContain("Use at least 10 characters");
    expect(passwordProblems("Aa1!ก😀abcd")).toEqual([]);
    expect(passwordProblems(" Aa1!abcde ")).toEqual([]);
  });
  it.each([71, 72, 73])("enforces the bcrypt byte limit at %i bytes", bytes => {
    const password = "Aa1!ก😀" + "x".repeat(bytes - 11);
    expect(Buffer.byteLength(password)).toBe(bytes);
    expect(passwordProblems(password).includes("Use at most 72 UTF-8 bytes")).toBe(bytes > 72);
  });
  it.each(["abcdefgh1!", "ABCDEFGH1!", "Abcdefghij!", "Abcdefgh12", "Abcdefg12 ", "Abcdefg12!\0"])("rejects a missing class or NUL: %s", value => {
    expect(passwordProblems(value).length).toBeGreaterThan(0);
  });
  it("uses fresh cost-12 salts and never silently truncates", async () => {
    const value = " Aa1!ก😀abcd ";
    const a = await hashPassword(value), b = await hashPassword(value);
    expect(a).toMatch(/^\$2[ab]\$12\$/); expect(a).not.toBe(b);
    expect(await verifyPassword(value, a)).toBe(true);
    expect(await verifyPassword(value.trim(), a)).toBe(false);
    expect(await verifyPassword("Aa1!" + "a".repeat(69), a)).toBe(false);
    expect(await verifyPassword(value + "\0", a)).toBe(false);
  });
  it("normalizes emails and rejects unexpected fields", () => {
    expect(normalizeEmail(" User@Example.com ")).toBe("user@example.com");
    expect(() => normalizeEmail("invalid")).toThrow();
    expect(() => authBody({ email: "a@b.co", role: "ADMINISTRATOR" }, ["email"])).toThrow();
  });
});
