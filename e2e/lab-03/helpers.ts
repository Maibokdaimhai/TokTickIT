import { PrismaClient } from "../../server/node_modules/@prisma/client/index.js";
import bcrypt from "../../server/node_modules/bcrypt/bcrypt.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { assertSafeDatabaseUrl } from "./db-guard.js";

export function getInitialPassword(): string {
  const pass = process.env.E2E_INITIAL_PASSWORD || process.env.LAB3_INITIAL_PASSWORD;
  if (!pass) {
    throw new Error("Missing required environment variable: E2E_INITIAL_PASSWORD or LAB3_INITIAL_PASSWORD");
  }
  return pass;
}

export function getChangedPassword(): string {
  const pass = process.env.E2E_CHANGED_PASSWORD;
  if (!pass) {
    throw new Error("Missing required environment variable: E2E_CHANGED_PASSWORD");
  }
  return pass;
}

export const origin = process.env.E2E_CLIENT_ORIGIN ?? "http://localhost:5174";
export const apiOrigin = process.env.E2E_API_ORIGIN ?? "http://localhost:3104";

const ids: number[] = [];
const createdTicketIds: number[] = [];
let prisma: PrismaClient | undefined;

export function database(): PrismaClient {
  assertSafeDatabaseUrl(process.env.DATABASE_URL, process.env.E2E_ALLOW_DB_WRITE);
  return (prisma ??= new PrismaClient());
}

export async function createAccount(
  name: string,
  options: {
    role?: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
    mustChangePassword?: boolean;
    isActive?: boolean;
    password?: string;
  } = {}
) {
  const pwd = options.password ?? getInitialPassword();
  const user = await database().user.create({
    data: {
      name,
      email: `${randomUUID()}@e2e.example`,
      passwordHash: await bcrypt.hash(pwd, 12),
      mustChangePassword: options.mustChangePassword ?? false,
      role: options.role ?? "REQUESTER",
      isActive: options.isActive ?? true,
    },
  });
  ids.push(user.id);
  return user;
}

export async function createTicketFixture(options: {
  requesterId: number;
  categoryId?: number;
  relatedSystemId?: number;
  summary?: string;
  description?: string;
  requestedPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  itPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status?: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  ownerId?: number | null;
}) {
  const db = database();
  let catId = options.categoryId;
  if (!catId) {
    const cat = await db.category.findFirst({ where: { isActive: true } });
    catId = cat?.id ?? 1;
  }
  let sysId = options.relatedSystemId;
  if (!sysId) {
    const sys = await db.relatedSystem.findFirst({ where: { isActive: true } });
    sysId = sys?.id ?? 1;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const ticketNumber = `TKT-${currentYear}-${randomSuffix}`;

  const ticket = await db.ticket.create({
    data: {
      ticketNumber,
      requesterId: options.requesterId,
      categoryId: catId,
      relatedSystemId: sysId,
      summary: options.summary ?? `E2E Test Ticket ${randomSuffix}`,
      description: options.description ?? "This is an automated E2E test ticket description with sufficient length.",
      requestedPriority: options.requestedPriority ?? "MEDIUM",
      itPriority: options.itPriority ?? options.requestedPriority ?? "MEDIUM",
      status: options.status ?? "NEW",
      ownerId: options.ownerId ?? null,
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket;
}

export async function cleanAccounts() {
  if (!prisma) return;
  const db = prisma;
  try {
    // 1. Discover all test users (tracked IDs + @e2e.example namespace, never seeded users)
    const discoveredUsers = await db.user.findMany({
      where: {
        seedKey: null,
        OR: [
          { id: { in: ids } },
          { email: { endsWith: "@e2e.example" } },
        ],
      },
      select: { id: true, email: true },
    });
    const allTestUserIds = Array.from(new Set([...ids, ...discoveredUsers.map((u) => u.id)]));

    // 2. Discover all E2E created tickets (never seeded tickets)
    const e2eCreatedTickets = await db.ticket.findMany({
      where: {
        seedKey: null,
        OR: [
          { id: { in: createdTicketIds } },
          { requesterId: { in: allTestUserIds } },
          { summary: { contains: "E2E" } },
        ],
      },
      select: { id: true },
    });
    const e2eCreatedTicketIds = Array.from(
      new Set([...createdTicketIds, ...e2eCreatedTickets.map((t) => t.id)])
    );

    // 3. Clear ownerId and problemAppearsResolved on retained/seeded tickets pointing to test users
    if (allTestUserIds.length > 0) {
      await db.ticket.updateMany({
        where: {
          id: { notIn: e2eCreatedTicketIds },
          ownerId: { in: allTestUserIds },
        },
        data: {
          ownerId: null,
        },
      });

      await db.ticket.updateMany({
        where: {
          id: { notIn: e2eCreatedTicketIds },
          problemAppearsResolvedById: { in: allTestUserIds },
        },
        data: {
          problemAppearsResolvedAt: null,
          problemAppearsResolvedById: null,
        },
      });
    }

    // 4. Delete sessions for all test users
    if (allTestUserIds.length > 0) {
      await db.session.deleteMany({
        where: { userId: { in: allTestUserIds } },
      });
    }

    // 5. Delete attachments and un-link files on disk
    const attachments = await db.attachment.findMany({
      where: {
        ticketId: { in: e2eCreatedTicketIds },
      },
      select: { id: true, filePath: true },
    });

    if (attachments.length > 0) {
      await db.attachment.deleteMany({
        where: { id: { in: attachments.map((a) => a.id) } },
      });

      for (const att of attachments) {
        if (att.filePath) {
          await fs.unlink(att.filePath).catch(() => {});
        }
      }
    }

    // 6. Delete public comments and internal notes on E2E created tickets or authored by test users
    await db.publicComment.deleteMany({
      where: {
        seedKey: null,
        OR: [
          { ticketId: { in: e2eCreatedTicketIds } },
          { authorId: { in: allTestUserIds } },
        ],
      },
    });

    await db.internalNote.deleteMany({
      where: {
        seedKey: null,
        OR: [
          { ticketId: { in: e2eCreatedTicketIds } },
          { authorId: { in: allTestUserIds } },
        ],
      },
    });

    // 7. Delete E2E created tickets
    if (e2eCreatedTicketIds.length > 0) {
      await db.ticket.deleteMany({
        where: { id: { in: e2eCreatedTicketIds } },
      });
    }

    // 8. Delete E2E created test users
    if (allTestUserIds.length > 0) {
      await db.user.deleteMany({
        where: {
          seedKey: null,
          id: { in: allTestUserIds },
        },
      });
    }

    // Reset tracked arrays only after cleanup handling is complete
    ids.length = 0;
    createdTicketIds.length = 0;
  } finally {
    await db.$disconnect();
    prisma = undefined;
  }
}

export async function signIn(page: Page, email: string, password?: string) {
  const pwd = password || getInitialPassword();
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pwd);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
}

export async function captureScreenshot(
  page: Page,
  filename: string,
  options?: { fullPage?: boolean }
): Promise<string> {
  const screenshotsDir = path.resolve(process.cwd(), "artifacts/lab-03/screenshots");
  const fullPath = path.join(screenshotsDir, filename);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  await page.waitForLoadState("domcontentloaded");
  await page.locator("h1, h2, [role=heading], .app-shell, header").first().waitFor({ state: "visible", timeout: 10000 });

  const loader = page.locator("[data-testid='loading-spinner'], [aria-busy='true'], .spinner, .loading-state");
  if ((await loader.count()) > 0) {
    await loader.first().waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  }

  await page
    .addStyleTag({
      content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      body {
        caret-color: transparent !important;
      }
    `,
    })
    .catch(() => {});

  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  await page.screenshot({
    path: fullPath,
    fullPage: options?.fullPage ?? false,
  });
  return fullPath;
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const overflowing = Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > window.innerWidth + 1;
      })
      .map((el) => ({
        tag: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        id: el.id,
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
      }));

    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      overflowing,
    };
  });

  if (overflow.scrollWidth > overflow.innerWidth + 1) {
    console.log(
      `Horizontal overflow detected at innerWidth ${overflow.innerWidth}: scrollWidth=${overflow.scrollWidth}, elements:`,
      JSON.stringify(overflow.overflowing.slice(0, 5), null, 2)
    );
  }

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

export interface TouchTargetOptions {
  square?: boolean;
}

export async function assertTouchTargets(
  page: Page,
  selectors: string[],
  options: TouchTargetOptions = {}
): Promise<void> {
  const minDimension = 44;
  for (const selector of selectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    for (let i = 0; i < count; i++) {
      const el = elements.nth(i);
      if (!(await el.isVisible())) continue;
      if (await el.isDisabled().catch(() => false)) continue;

      const box = await el.boundingBox();
      if (!box || box.width === 0 || box.height === 0) continue;

      expect(
        box.height,
        `Expected height of '${selector}' to be >= ${minDimension}px, but got ${box.height}px`
      ).toBeGreaterThanOrEqual(minDimension);

      if (options.square) {
        expect(
          box.width,
          `Expected width of square/icon '${selector}' to be >= ${minDimension}px, but got ${box.width}px`
        ).toBeGreaterThanOrEqual(minDimension);
      }
    }
  }
}
