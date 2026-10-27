import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "../../server/node_modules/@prisma/client/index.js";
import bcrypt from "../../server/node_modules/bcrypt/bcrypt.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { assertSafeDatabaseUrl } from "../lab-03/db-guard.js";

assertSafeDatabaseUrl(process.env.DATABASE_URL, process.env.E2E_ALLOW_DB_WRITE);
const prisma = new PrismaClient();
const password = process.env.E2E_INITIAL_PASSWORD;
if (!password) throw new Error("Supply a local E2E_INITIAL_PASSWORD for disposable workflow accounts");
test.afterAll(async () => { await prisma.$disconnect(); });
// Audit fixtures intentionally remain until the dedicated disposable DB is
// dropped. Do not disable immutable history triggers for browser-test teardown.
async function scenario() {
  const hash = await bcrypt.hash(password!, 12), marker = randomUUID();
  const user = (name: string, role: "REQUESTER" | "IT_STAFF") => prisma.user.create({ data: { name, email: `${name.toLowerCase().replaceAll(" ", "-")}-${marker}@workflow-e2e.test`, passwordHash: hash, role, mustChangePassword: false } });
  const requester = await user("Workflow Requester", "REQUESTER"), staff = await user("Workflow Owner", "IT_STAFF"), contributor = await user("Workflow Contributor", "IT_STAFF");
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } }), system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `WORKFLOW-${marker}`, requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id, summary: `Workflow E2E ${marker}`, description: "Real database lifecycle check", requestedPriority: "HIGH", itPriority: "HIGH", createdAt: new Date("2026-01-01T00:00:00Z") } });
  return { requester, staff, contributor, ticket };
}
async function signIn(page: Page, email: string) {
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
}
async function transition(page: Page, status: string, expected = 200) {
  await page.getByLabel("Next Status", { exact: true }).selectOption(status);
  await page.getByTestId("btn-save-status").click();
  const confirmed = ["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"].includes(status);
  if (confirmed) {
    await expect(page.getByRole("dialog")).toBeVisible();
    const response = page.waitForResponse(r => r.url().endsWith('/status') && r.request().method() === 'PATCH');
    await page.getByRole("button", { name: "Confirm Status Change", exact: true }).click(); expect((await response).status()).toBe(expected);
  }
  if (expected === 200 && confirmed) await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function createWork(page: Page, assigneeId: number, followUp = false) {
  await page.getByRole("button", { name: "New Action", exact: true }).click();
  await page.getByLabel("Assigned to", { exact: true }).selectOption(String(assigneeId));
  await page.getByLabel("Action Description", { exact: true }).fill("Inspect and restore connectivity");
  if (followUp) { await page.getByLabel("Follow-Up Required?", { exact: true }).check(); await page.getByLabel("Follow-up Note", { exact: true }).fill("Confirm connectivity with Requester"); }
  const result = page.waitForResponse(r => /\/actions$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  await page.getByRole("button", { name: "Save Action", exact: true }).click(); const response = await result;
  expect(response.status()).toBe(201); const body = await response.json();
  await expect(page.getByText("Action saved.", { exact: true })).toBeVisible(); return body.action.id as number;
}
async function completeWork(page: Page, actionId: number) {
  await page.getByRole("button", { name: `Edit Action #${actionId}`, exact: true }).click();
  await page.getByLabel("Result", { exact: true }).fill("Connection restored"); await page.getByLabel("Action Status", { exact: true }).selectOption("COMPLETED");
  await page.getByRole("button", { name: "Save Action", exact: true }).click();
  const result = page.waitForResponse(r => r.url().endsWith(`/actions/${actionId}`) && r.request().method() === 'PATCH');
  await page.getByRole("button", { name: "Confirm Action Change", exact: true }).click(); expect((await result).status()).toBe(200);
  await expect(page.getByRole("button", { name: `Edit Action #${actionId}`, exact: true })).toHaveCount(0);
}
const screenshots = "artifacts/lab-04/screenshots/ticket-workflow";
test("real Staff/Requester lifecycle releases the follow-up gate and retains history", async ({ page, browser }) => {
  const f = await scenario(); await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, f.staff.email); await page.goto(`/staff/tickets/${f.ticket.id}`);
  await page.getByTestId("btn-claim-ticket").click(); await expect(page.getByTestId("select-status")).toHaveValue("IN_PROGRESS");
  await transition(page, "RESOLVED", 409);
  await expect(page.getByRole("dialog")).toContainText("Record at least one completed Action");
  fs.mkdirSync(screenshots, { recursive: true }); await page.getByRole("dialog").screenshot({ path: `${screenshots}/resolution-blocked-mobile.png` });
  await page.getByRole("button", { name: "Review Actions Taken", exact: true }).click();
  const id = await createWork(page, f.contributor.id, true);
  await transition(page, "RESOLVED", 409);
  const blockers = page.getByRole("dialog"); await expect(blockers.locator('.resolution-blockers li')).toHaveCount(3);
  const bounds = (await blockers.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  for (const button of await blockers.getByRole('button').all()) {
    const box = (await button.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(bounds.x); expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width); expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await blockers.screenshot({ path: `${screenshots}/all-resolution-blockers-mobile.png` });
  await page.getByRole("button", { name: "Review Actions Taken", exact: true }).click();
  await completeWork(page, id);
  await transition(page, "RESOLVED", 409); await expect(page.getByRole("dialog")).toContainText("Record Follow-up Completion");
  await page.getByRole("button", { name: "Review Actions Taken", exact: true }).click();
  await page.getByRole("button", { name: `Record Follow-up Completion for Action #${id}`, exact: true }).click();
  await page.getByLabel("Completion Note", { exact: true }).fill("Requester confirmed recovery");
  const completion = page.waitForResponse(r => r.url().endsWith('/follow-up-completion'));
  await page.getByRole("button", { name: "Record Completion", exact: true }).click(); expect((await completion).status()).toBe(200);
  const context = await browser.newContext(), requesterPage = await context.newPage();
  try {
    await signIn(requesterPage, f.requester.email); await requesterPage.goto(`/tickets/${f.ticket.id}`);
    await requesterPage.getByTestId("btn-problem-appears-resolved").click();
    await requesterPage.getByTestId("btn-confirm-resolution-indication").click();
    await expect.poll(async () => (await prisma.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } })).problemAppearsResolvedAt).not.toBeNull();
    await page.reload(); await transition(page, "RESOLVED");
    await expect(page.locator('.resolution-summary')).toContainText('Resolved');
    await requesterPage.reload(); await requesterPage.getByRole('button', { name: `View History for Action #${id}`, exact: true }).click();
    await expect(requesterPage.getByRole('region', { name: `History of Action #${id}` })).toContainText('Requester confirmed recovery');
    await expect(requesterPage.getByRole('button', { name: 'New Action', exact: true })).toHaveCount(0);
    await transition(page, "CLOSED"); await transition(page, "REOPENED");
    const reopened = await prisma.ticket.findUniqueOrThrow({ where: { id: f.ticket.id } });
    expect(reopened.resolvedAt).toBeNull(); expect(reopened.problemAppearsResolvedAt).toBeNull();
    await transition(page, "RESOLVED");
    const events = await prisma.ticketStatusEvent.findMany({ where: { ticketId: f.ticket.id }, orderBy: { id: 'asc' } });
    expect(events.map(e => e.toStatus)).toEqual(['OPEN', 'RESOLVED', 'CLOSED', 'REOPENED', 'RESOLVED']);
    const history = page.getByRole('region', { name: 'Ticket History', exact: true }); await expect(history).toContainText('Reopened → Resolved');
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const bounds = (await history.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      for (const element of await history.locator('h2, li, p, button').all()) {
        const box = (await element.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1); expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      }
      const style = await page.addStyleTag({ content: '.app-header { display:none!important }' });
      await expect(page.locator('.app-header')).toBeHidden();
      await history.screenshot({ path: `${screenshots}/public-history-${width}.png` });
      await style.evaluate(e => e.remove());
    }
  } finally { await context.close(); }
});
test("cancellation freezes unfinished work and reopening permits completing it", async ({ page }) => {
  const f = await scenario(); await signIn(page, f.staff.email); await page.goto(`/staff/tickets/${f.ticket.id}`); await page.getByTestId('btn-claim-ticket').click();
  await expect(page.getByTestId('select-status')).toHaveValue('IN_PROGRESS');
  const id = await createWork(page, f.staff.id); await transition(page, 'CANCELLED');
  await expect(page.getByRole('button', { name: `Edit Action #${id}`, exact: true })).toHaveCount(0);
  await transition(page, 'REOPENED'); await completeWork(page, id); await transition(page, 'RESOLVED');
  expect(await prisma.actionTaken.count({ where: { ticketId: f.ticket.id } })).toBe(1);
});
test("legacy resolved Tickets can close but must record work before re-resolution", async ({ page }) => {
  const f = await scenario(); await prisma.ticket.update({ where: { id: f.ticket.id }, data: { status: 'RESOLVED', ownerId: f.staff.id, resolvedAt: new Date('2026-01-02T00:00:00Z'), resolvedAtEstimated: true } });
  await signIn(page, f.staff.email); await page.goto(`/staff/tickets/${f.ticket.id}`); await expect(page.locator('.resolution-summary')).toContainText('Estimated');
  await transition(page, 'CLOSED'); await transition(page, 'REOPENED'); await transition(page, 'RESOLVED', 409);
  await page.getByRole('button', { name: 'Review Actions Taken', exact: true }).click();
  const id = await createWork(page, f.staff.id); await completeWork(page, id); await transition(page, 'RESOLVED');
  await expect(page.locator('.resolution-summary')).not.toContainText('Estimated');
});
