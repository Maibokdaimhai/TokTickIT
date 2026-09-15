import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";

export const SESSION_COOKIE = "toktickit_session";
export const SESSION_LIFETIME = 8 * 60 * 60 * 1000;
export const authClock = { now: () => new Date() };
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newSessionToken = () => randomBytes(32).toString("base64url");

export function readSessionToken(req: Request): string | undefined {
  const entries = (req.headers.cookie ?? "").split(";").map(v => v.trim())
    .filter(v => v.startsWith(`${SESSION_COOKIE}=`));
  if (entries.length !== 1) return undefined;
  const token = entries[0].slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };
}
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_LIFETIME });
}
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}
