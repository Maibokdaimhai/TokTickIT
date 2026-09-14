import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCategories, login, getSession, logout } from "../../src/api.js";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("credentialed browser API", () => {
  it("includes cookies on reads and writes without storing tokens", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); vi.stubGlobal("fetch", fetch);
    await getSession(); await login("a@example.com", "Test-password1!"); await logout();
    for (const [, options] of fetch.mock.calls) expect(options.credentials).toBe("include");
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
  });
  it("notifies the shell on protected 401, but not a login credential failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid email or password" } }) }));
    const dispatch = vi.spyOn(window, "dispatchEvent");
    await expect(login("a@example.com", "wrong")).rejects.toThrow("Invalid email or password"); expect(dispatch).not.toHaveBeenCalled();
    await expect(fetchCategories()).rejects.toThrow(); expect(dispatch.mock.calls[0][0].type).toBe("auth:expired");
  });
  it("notifies the shell on a newly mandatory password change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, clone: () => ({ json: async () => ({ error: { code: "PASSWORD_CHANGE_REQUIRED" } }) }) }));
    const dispatch = vi.spyOn(window, "dispatchEvent"); await expect(fetchCategories()).rejects.toThrow(); expect(dispatch.mock.calls[0][0].type).toBe("auth:password-required");
  });
});
