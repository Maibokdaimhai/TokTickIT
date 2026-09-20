import type { User, Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import { authBody, normalizeEmail, validatePassword } from "../validators/auth.validator.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { authClock, digest, newSessionToken, SESSION_LIFETIME } from "../utils/session.js";

const WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10000;
export class ThrottledError extends ApiError {
  constructor(public readonly retryAfter: number) {
    super(429, { code: "LOGIN_THROTTLED", message: "Too many login attempts. Please try again later." });
  }
}
export const safeUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
export const authResult = (user: User) => ({ user: safeUser(user), mustChangePassword: user.mustChangePassword });
const unauthorized = () => new ApiError(401, { code: "UNAUTHORIZED", message: "Please sign in" });

async function issueSession(tx: Prisma.TransactionClient, userId: number, now: Date) {
  const token = newSessionToken();
  await tx.session.create({ data: { userId, tokenDigest: digest(token), expiresAt: new Date(now.getTime() + SESSION_LIFETIME) } });
  return token;
}

export async function login(value: unknown, previousToken?: string) {
  const body = authBody(value, ["email", "password"]);
  const email = normalizeEmail(body.email);
  if (typeof body.password !== "string" || !body.password) throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password is required" });
  const prisma = getPrisma();
  const emailDigest = digest(email);
  const now = authClock.now();
  const existing = await prisma.loginAttempt.findUnique({ where: { emailDigest } });
  if (existing?.lockedUntil && existing.lockedUntil > now) throw new ThrottledError(Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / 1000));
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(body.password, user?.passwordHash);

  // Hash comparison occurs outside the transaction; reread under lock before issuing a session.
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('auth-login-attempts'))`;
    const currentTime = authClock.now();
    await tx.loginAttempt.deleteMany({ where: { windowStartedAt: { lte: new Date(currentTime.getTime() - WINDOW) }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: currentTime } }] } });
    const attempt = await tx.loginAttempt.findUnique({ where: { emailDigest } });
    if (attempt?.lockedUntil && attempt.lockedUntil > currentTime) return { error: new ThrottledError(Math.ceil((attempt.lockedUntil.getTime() - currentTime.getTime()) / 1000)) };
    if (user) await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const current = user ? await tx.user.findUnique({ where: { id: user.id } }) : null;
    if (!valid || !current || current.passwordHash !== user?.passwordHash || current.email !== email) {
      if (!attempt && await tx.loginAttempt.count() >= MAX_ATTEMPTS) return { error: new ThrottledError(60) };
      const count = (attempt?.failureCount ?? 0) + 1;
      const lockedUntil = count >= 5 ? new Date(currentTime.getTime() + WINDOW) : null;
      await tx.loginAttempt.upsert({ where: { emailDigest }, create: { emailDigest, failureCount: count, windowStartedAt: currentTime, lockedUntil }, update: { failureCount: count, lockedUntil } });
      return { error: lockedUntil ? new ThrottledError(WINDOW / 1000) : new ApiError(401, { code: "INVALID_CREDENTIALS", message: "Invalid email or password" }) };
    }
    if (!current.isActive) return { error: new ApiError(403, { code: "ACCOUNT_INACTIVE", message: "This account is inactive. Contact your administrator." }) };
    await tx.loginAttempt.deleteMany({ where: { emailDigest } });
    await tx.session.deleteMany({ where: { OR: [{ expiresAt: { lte: currentTime } }, ...(previousToken ? [{ tokenDigest: digest(previousToken) }] : [])] } });
    const token = await issueSession(tx, current.id, currentTime);
    return { token, result: authResult(current) };
  });
  if (result.error) throw result.error;
  return { token: result.token!, result: result.result! };
}

export async function currentSession(token?: string) {
  if (!token) throw unauthorized();
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({ where: { tokenDigest: digest(token) }, include: { user: true } });
  if (!session || session.expiresAt <= authClock.now() || !session.user.isActive) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } });
    throw unauthorized();
  }
  return session;
}

export async function logout(token?: string) {
  if (token) await getPrisma().session.deleteMany({ where: { tokenDigest: digest(token) } });
}

export async function changePassword(value: unknown, token?: string) {
  const session = await currentSession(token);
  const body = authBody(value, ["currentPassword", "newPassword", "confirmPassword"]);
  if (typeof body.currentPassword !== "string" || !await verifyPassword(body.currentPassword, session.user.passwordHash)) {
    throw new ApiError(400, { code: "CURRENT_PASSWORD_INVALID", message: "Current password is incorrect" });
  }
  validatePassword(body.newPassword);
  if (body.newPassword !== body.confirmPassword) throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password confirmation must match" });
  if (await verifyPassword(body.newPassword, session.user.passwordHash)) throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Choose a different password" });
  const hash = await hashPassword(body.newPassword);
  return getPrisma().$transaction(async tx => {
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${session.userId} FOR UPDATE`;
    const current = await tx.session.findUnique({ where: { id: session.id }, include: { user: true } });
    const now = authClock.now();
    if (!current || !current.user.isActive || current.expiresAt <= now || current.user.passwordHash !== session.user.passwordHash) throw unauthorized();
    const user = await tx.user.update({ where: { id: session.userId }, data: { passwordHash: hash, mustChangePassword: false } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    return { token: await issueSession(tx, user.id, now), result: authResult(user) };
  });
}

export async function ensureAuthReady(prisma = getPrisma()) {
  const rows = await prisma.$queryRaw<{ ready: boolean }[]>`
    SELECT NOT EXISTS(SELECT 1 FROM "User" WHERE "passwordHash" IS NULL) AND EXISTS(
      SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'User'
      AND column_name = 'passwordHash' AND is_nullable = 'NO') AS ready`;
  if (!rows[0]?.ready) throw new Error("Complete prisma:bootstrap before starting the server.");
}
