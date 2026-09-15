import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import express from "express";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import { authClock, digest, SESSION_LIFETIME } from "../../src/utils/session.js";
import { requireSession, requireRoles } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/middleware/error-handler.js";

const prisma = getPrisma();
const prefix = randomUUID();
const password = "Authentication-test1!";
let hash: string;
const ids: number[] = [];
const emails: string[] = [];
beforeAll(async () => { hash = await hashPassword(password); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.loginAttempt.deleteMany({ where: { emailDigest: { in: emails.map(digest) } } });
});
async function user(options: { isActive?: boolean; mustChangePassword?: boolean; role?: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" } = {}) {
  const email = `${prefix}-${ids.length}@auth.example`; emails.push(email);
  const value = await prisma.user.create({ data: { name: "Auth test", email, passwordHash: hash, mustChangePassword: false, ...options } }); ids.push(value.id); return value;
}
const post = (path: string) => request(app).post(`/api/auth/${path}`).set("Origin", "http://localhost:5173");
const signIn = (email: string, pass = password) => post("login").send({ email, password: pass });
const cookie = (response: request.Response) => response.headers["set-cookie"][0].split(";")[0];
const me = (value: string) => request(app).get("/api/auth/me").set("Cookie", value);

describe("Issue #27 authentication API", () => {
  it("normalizes login, exposes only safe identity, and stores only a digest", async () => {
    const account = await user();
    const response = await signIn(` ${account.email.toUpperCase()} `);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: { id: account.id, name: account.name, email: account.email, role: "REQUESTER", isActive: true }, mustChangePassword: false });
    const header = response.headers["set-cookie"][0];
    for (const flag of ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=28800"]) expect(header).toContain(flag);
    expect(header).not.toContain("Domain=");
    expect(response.headers["cache-control"]).toBe("no-store");
    const token = cookie(response).split("=")[1];
    const stored = await prisma.session.findUniqueOrThrow({ where: { tokenDigest: digest(token) } });
    expect(JSON.stringify(stored)).not.toContain(token);
    expect((await me(cookie(response))).body).toEqual(response.body);
  });
  it("uses Secure in production and rotates an existing login cookie", async () => {
    const account = await user();
    const first = await signIn(account.email);
    vi.stubEnv("NODE_ENV", "production");
    try {
      const second = await post("login").set("Cookie", cookie(first)).send({ email: account.email, password });
      expect(second.headers["set-cookie"][0]).toContain("Secure");
      expect(cookie(second)).not.toBe(cookie(first));
      expect((await me(cookie(first))).status).toBe(401);
    } finally { vi.unstubAllEnvs(); }
  });
  it("does not distinguish unknown, wrong-password and inactive/wrong-password failures", async () => {
    const active = await user(), inactive = await user({ isActive: false });
    const unknown = `${prefix}-unknown@auth.example`; emails.push(unknown);
    const responses = await Promise.all([signIn(active.email, "wrong"), signIn(inactive.email, "wrong"), signIn(unknown, "wrong")]);
    for (const response of responses) { expect(response.status).toBe(401); expect(response.body).toEqual(responses[0].body); }
    expect((await signIn(inactive.email)).status).toBe(403);
  });
  it.each([true, false])("throttles the fifth failure equally for known=%s, without extending expiry", async known => {
    const email = known ? (await user()).email : `${prefix}-throttle@auth.example`; emails.push(email);
    let now = new Date(); vi.spyOn(authClock, "now").mockImplementation(() => now);
    for (let i = 1; i <= 5; i++) expect((await signIn(email, "wrong")).status).toBe(i === 5 ? 429 : 401);
    const locked = await prisma.loginAttempt.findUniqueOrThrow({ where: { emailDigest: digest(email) } });
    now = new Date(now.getTime() + 60000);
    const denied = await signIn(email);
    expect(denied.status).toBe(429); expect(denied.headers["retry-after"]).toBe("840");
    expect((await prisma.loginAttempt.findUniqueOrThrow({ where: { emailDigest: digest(email) } })).lockedUntil).toEqual(locked.lockedUntil);
    now = locked.lockedUntil!;
    expect((await signIn(email)).status).toBe(known ? 200 : 401);
  });
  it("resets failures after a fixed window or successful login", async () => {
    const account = await user(); let now = new Date(); vi.spyOn(authClock, "now").mockImplementation(() => now);
    await signIn(account.email, "wrong"); now = new Date(now.getTime() + 15 * 60000);
    await signIn(account.email, "wrong");
    expect((await prisma.loginAttempt.findUniqueOrThrow({ where: { emailDigest: digest(account.email) } })).failureCount).toBe(1);
    await signIn(account.email);
    expect(await prisma.loginAttempt.findUnique({ where: { emailDigest: digest(account.email) } })).toBeNull();
  });
  it("restricts initial sessions; rejects invalid changes then rotates and revokes all sessions", async () => {
    const account = await user({ mustChangePassword: true });
    const first = await signIn(account.email), other = await signIn(account.email);
    expect((await me(cookie(first))).body.mustChangePassword).toBe(true);
    const restricted = await request(app).get("/api/categories").set("Cookie", cookie(first));
    expect(restricted.status).toBe(403); expect(restricted.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    const change = (body: object) => post("change-password").set("Cookie", cookie(first)).send(body);
    const newPassword = "Changed-auth-pass2!";
    for (const body of [
      { currentPassword: "wrong", newPassword, confirmPassword: newPassword },
      { currentPassword: password, newPassword: "short", confirmPassword: "short" },
      { currentPassword: password, newPassword, confirmPassword: newPassword + " " },
      { currentPassword: password, newPassword: password, confirmPassword: password },
    ]) expect((await change(body)).status).toBe(400);
    const changed = await change({ currentPassword: password, newPassword, confirmPassword: newPassword });
    expect(changed.status).toBe(200); expect(changed.body.mustChangePassword).toBe(false);
    expect((await me(cookie(first))).status).toBe(401); expect((await me(cookie(other))).status).toBe(401);
    expect((await me(cookie(changed))).status).toBe(200);
    expect((await signIn(account.email, newPassword)).status).toBe(200);
    expect((await signIn(account.email)).status).toBe(401);
  });
  it("rechecks activation, role and password restriction on every request", async () => {
    const account = await user(); const signed = await signIn(account.email);
    const guarded = express(); guarded.use(requireSession); guarded.get("/staff", requireRoles("IT_STAFF", "ADMINISTRATOR"), (_req, res) => res.sendStatus(200)); guarded.use(errorHandler);
    expect((await request(guarded).get("/staff").set("Cookie", cookie(signed))).status).toBe(403);
    await prisma.user.update({ where: { id: account.id }, data: { role: "IT_STAFF" } });
    expect((await request(guarded).get("/staff").set("Cookie", cookie(signed))).status).toBe(200);
    expect((await me(cookie(signed))).body.user.role).toBe("IT_STAFF");
    await prisma.user.update({ where: { id: account.id }, data: { mustChangePassword: true } });
    expect((await request(guarded).get("/staff").set("Cookie", cookie(signed))).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await prisma.user.update({ where: { id: account.id }, data: { isActive: false } });
    expect((await me(cookie(signed))).status).toBe(401);
  });
  it("expires at the absolute eight-hour boundary and logout is idempotent", async () => {
    const account = await user(); const now = new Date(); vi.spyOn(authClock, "now").mockReturnValue(now);
    const signed = await signIn(account.email);
    vi.mocked(authClock.now).mockReturnValue(new Date(now.getTime() + SESSION_LIFETIME - 1)); expect((await me(cookie(signed))).status).toBe(200);
    vi.mocked(authClock.now).mockReturnValue(new Date(now.getTime() + SESSION_LIFETIME)); expect((await me(cookie(signed))).status).toBe(401);
    const next = await signIn(account.email);
    expect((await post("logout").set("Cookie", cookie(next)).send({})).status).toBe(204);
    expect((await me(cookie(next))).status).toBe(401); expect((await post("logout").send({})).status).toBe(204);
  });
  it("denies anonymous protected routes and retires requester enumeration", async () => {
    for (const path of ["/api/categories", "/api/tickets?requesterId=1", "/api/auth/me"]) expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get("/api/requesters")).status).toBe(404);
    const account = await user(); const signed = await signIn(account.email);
    expect((await request(app).get("/api/requesters").set("Cookie", cookie(signed))).status).toBe(404);
  });
  it("enforces exact Origin on unsafe routes and supports credentialed preflight", async () => {
    for (const origin of [undefined, "null", "http://localhost:5173.evil.example", "http://localhost:5174"]) {
      let req = request(app).post("/api/auth/login"); if (origin) req = req.set("Origin", origin);
      expect((await req.send({ email: "a@b.co", password })).status).toBe(403);
    }
    const response = await request(app).options("/api/auth/login").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "POST");
    expect(response.status).toBe(204); expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173"); expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
  it("rejects malformed, oversized and unexpected auth input with safe JSON", async () => {
    expect((await post("login").send({ email: "bad", password })).status).toBe(400);
    expect((await post("login").send({ email: "a@b.co", password, role: "ADMINISTRATOR" })).status).toBe(400);
    expect((await post("login").set("Content-Type", "application/json").send('{"password":')).type).toBe("application/json");
    const large = await post("login").send({ email: "a@b.co", password: "a".repeat(66000) }); expect(large.status).toBe(413); expect(large.type).toBe("application/json");
  });
  it("serializes simultaneous password changes so a stale request cannot issue another session", async () => {
    const account = await user(); const signed = await signIn(account.email);
    const change = (newPassword: string) => post("change-password").set("Cookie", cookie(signed)).send({ currentPassword: password, newPassword, confirmPassword: newPassword });
    const responses = await Promise.all([change("Concurrent-change1!"), change("Concurrent-change2!")]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 401]);
    expect(await prisma.session.count({ where: { userId: account.id } })).toBe(1);
  });
});
