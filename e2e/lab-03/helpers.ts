import { PrismaClient } from "../../server/node_modules/@prisma/client/index.js";
import bcrypt from "../../server/node_modules/bcrypt/bcrypt.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { Page } from "@playwright/test";

export const initialPassword = "E2E-initial-pass1!";
export const changedPassword = "E2E-changed-pass2!";
export const origin = process.env.E2E_CLIENT_ORIGIN ?? "http://localhost:5173";
export const apiOrigin = process.env.E2E_API_ORIGIN ?? "http://localhost:3000";
const ids: number[] = [];
let prisma: PrismaClient;
function database() {
  if (process.env.E2E_ALLOW_DB_WRITE !== "1" || !process.env.DATABASE_URL) throw new Error("Use an explicitly configured disposable DATABASE_URL and E2E_ALLOW_DB_WRITE=1.");
  return prisma ??= new PrismaClient();
}
export async function createAccount(name: string, options: { role?: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; mustChangePassword?: boolean; isActive?: boolean } = {}) {
  const user = await database().user.create({ data: { name, email: `${randomUUID()}@e2e.example`, passwordHash: await bcrypt.hash(initialPassword, 12), mustChangePassword: false, ...options } });
  ids.push(user.id); return user;
}
export async function cleanAccounts() {
  if (!prisma) return;
  const tickets = await prisma.ticket.findMany({ where: { requesterId: { in: ids } }, select: { id: true } });
  const ticketIds = tickets.map(t => t.id);
  const files = await prisma.attachment.findMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const file of files) await fs.unlink(file.filePath).catch(() => {});
  await prisma.$disconnect();
}
export async function signIn(page: Page, email: string, password = initialPassword) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
}
