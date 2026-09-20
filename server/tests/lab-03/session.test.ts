import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { digest, newSessionToken, readSessionToken, SESSION_LIFETIME } from "../../src/utils/session.js";
describe("opaque sessions", () => {
  it("generates independent 256-bit tokens and one-way digests", () => {
    const tokens = Array.from({ length: 100 }, newSessionToken);
    expect(new Set(tokens).size).toBe(100);
    for (const token of tokens) { expect(token).toMatch(/^[\w-]{43}$/); expect(digest(token)).toMatch(/^[a-f0-9]{64}$/); expect(digest(token)).not.toContain(token); }
    expect(SESSION_LIFETIME).toBe(8 * 60 * 60 * 1000);
  });
  it("rejects duplicate, missing and malformed session cookies", () => {
    const token = newSessionToken();
    const read = (cookie?: string) => readSessionToken({ headers: { cookie } } as Request);
    expect(read()).toBeUndefined(); expect(read("toktickit_session=bad")).toBeUndefined();
    expect(read(`toktickit_session=${token}; toktickit_session=${token}`)).toBeUndefined();
    expect(read(`other=ok; toktickit_session=${token}`)).toBe(token);
  });
});
