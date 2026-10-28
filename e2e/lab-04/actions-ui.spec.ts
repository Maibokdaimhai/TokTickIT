import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import type { ActionRevision, StaffTicketDetail, TicketAction, AuthUser } from "../../client/src/types.js";

// Browser UI integration against controlled responses, not DB-backed product E2E.
const staff: AuthUser = { id: 7, name: "Alex Thompson", email: "alex@example.com", role: "IT_STAFF", isActive: true };
const requester: AuthUser = { ...staff, id: 1, name: "Jennifer Anderson", role: "REQUESTER" };
const other = { ...staff, id: 8, name: "Jamie Chen" };
const initialAction: TicketAction = { id: 4, ticketId: 1, actionAt: "2026-01-02T02:00:00Z", description: "Investigate connectivity and review the router configuration", result: null,
  performedBy: staff, assignee: other, status: "IN_PROGRESS", version: 0, followUpRequired: false, followUpNote: null, attachmentNotes: "See the existing router photograph",
  followUpCompletedAt: null, followUpCompletedBy: null, followUpCompletionNote: null, createdAt: "2026-01-02T02:00:00Z", updatedAt: "2026-01-02T02:00:00Z" };
const screenshotDir = "artifacts/lab-04/screenshots/actions-taken";
async function controlledApp(page: Page, role: "REQUESTER" | "IT_STAFF" = "IT_STAFF", options: { pendingFollowUp?: boolean; longContent?: boolean } = {}) {
  let version = 1;
  const actions: TicketAction[] = [{ ...initialAction, ...(options.longContent ? { description: "LongUnbrokenDiagnosticDescription".repeat(12), attachmentNotes: "router-photo-with-a-long-file-name.png ".repeat(8) } : {}), ...(options.pendingFollowUp ? { status: "COMPLETED" as const, result: "Connectivity restored", followUpRequired: true, followUpNote: "Confirm with Requester" } : {}) }];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const revisions = new Map<number, ActionRevision[]>();
  function revision(action: TicketAction) {
    const { actionAt, description, result, status, followUpRequired, followUpNote, attachmentNotes, followUpCompletedAt, followUpCompletionNote } = action;
    const list = revisions.get(action.id) ?? [];
    list.push({ id: list.length + 1, actionId: action.id, version: action.version, createdAt: action.updatedAt, editor: staff,
      snapshot: { actionAt, description, result, performedById: action.performedBy.id, assigneeId: action.assignee.id, status, followUpRequired, followUpNote, attachmentNotes, followUpCompletedAt, followUpCompletedById: action.followUpCompletedBy?.id ?? null, followUpCompletionNote } });
    revisions.set(action.id, list);
  }
  revision(actions[0]);
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const ticket: StaffTicketDetail = { id: 1, ticketNumber: "TKT-2026-000001", requesterId: 1, requester, categoryId: 1, category: { id: 1, name: "Network" }, relatedSystemId: 1, relatedSystem: { id: 1, name: "Campus Wi-Fi" },
      summary: "Unable to connect to campus Wi-Fi", description: "Connection drops after signing in.", requestedPriority: "HIGH", itPriority: "HIGH", status: "OPEN", version, owner: { ...staff, role: "IT_STAFF" },
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", attachments: [], publicComments: [], internalNotes: [] };
    if (path === "/auth/me") return json({ user: role === "REQUESTER" ? requester : staff, mustChangePassword: false });
    if (path === "/staff/eligible-owners") return json({ owners: [staff, other] });
    if (path === "/tickets/1/status-history") return json({ events: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 }, historyStartsAt: "2026-10-27T00:00:00Z" });
    if (path === "/staff/tickets/1") return json(ticket);
    if (path === "/tickets/1") { const { internalNotes, ...publicTicket } = ticket; return json(publicTicket); }
    if (path === "/tickets/1/actions") return json({ actions, ticketVersion: version, pagination: { page: 1, limit: 10, totalItems: actions.length, totalPages: actions.length ? 1 : 0 } });
    const read = /^\/tickets\/1\/actions\/(\d+)(\/revisions)?$/.exec(path);
    if (read) {
      const action = actions.find(a => a.id === Number(read[1]));
      if (!action) return json({ error: { code: "NOT_FOUND", message: "Action not found" } }, 404);
      return read[2] ? json({ revisions: revisions.get(action.id), pagination: { page: 1, limit: 10, totalItems: revisions.get(action.id)!.length, totalPages: 1 } }) : json({ action, ticketVersion: version });
    }
    if (request.method() === "POST" && path === "/staff/tickets/1/actions") {
      const body = request.postDataJSON(); writes.push({ path, body });
      const action: TicketAction = { ...initialAction, ...body, id: 5, version: 0, performedBy: staff, assignee: body.assigneeId === 8 ? other : staff, createdAt: "2026-01-03T02:00:00Z", updatedAt: "2026-01-03T02:00:00Z" };
      actions.push(action); revision(action); version++; return json({ action, ticketVersion: version, replayed: false }, 201);
    }
    const write = /^\/staff\/tickets\/1\/actions\/(\d+)(\/follow-up-completion)?$/.exec(path);
    if (write && ["POST", "PATCH"].includes(request.method())) {
      const body = request.postDataJSON(); writes.push({ path, body });
      const action = actions.find(a => a.id === Number(write[1]))!;
      if (write[2]) Object.assign(action, { followUpRequired: false, followUpCompletionNote: body.completionNote, followUpCompletedAt: "2026-01-03T02:00:00Z", followUpCompletedBy: staff });
      else Object.assign(action, body, { assignee: body.assigneeId === 8 ? other : staff });
      action.version++; version++; revision(action); return json({ action, ticketVersion: version });
    }
    return json({ error: { code: "NOT_FOUND", message: "Unexpected fixture API request" } }, 404);
  });
  await page.goto(role === "REQUESTER" ? "/tickets/1" : "/staff/tickets/1");
  await expect(page.getByRole("article", { name: "Action #4", exact: true })).toBeVisible();
  return { writes };
}
async function assertBounds(page: Page) {
  const section = page.getByRole("region", { name: "Actions Taken", exact: true });
  const viewport = page.viewportSize()!;
  const bounds = await section.boundingBox(); expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  for (const element of await section.locator("h2, h3, dt, dd, input, select, textarea, button").all()) {
    if (!await element.isVisible()) continue;
    const box = (await element.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bounds!.x - 1); expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  }
  for (const button of await section.getByRole("button").all()) {
    const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  }
}
for (const width of [320, 390, 820, 1440]) test(`Actions cards/editor fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await controlledApp(page, "IT_STAFF", { longContent: true });
  await assertBounds(page);
  await page.getByRole("button", { name: "New Action", exact: true }).click();
  await page.getByLabel("Action Description", { exact: true }).fill("Inspect the router configuration");
  await page.getByLabel("Follow-Up Required?", { exact: true }).check();
  await page.getByLabel("Follow-up Note", { exact: true }).fill("Confirm the result with the Requester");
  await assertBounds(page);
  fs.mkdirSync(screenshotDir, { recursive: true });
  // Hide the sticky shell only in this section capture so it cannot obscure a
  // band of the tall offscreen element. Normal interaction tests keep it visible.
  const captureStyle = await page.addStyleTag({ content: ".app-header { display: none !important; }" });
  await expect(page.locator(".app-header")).toBeHidden();
  await page.getByRole("region", { name: "Actions Taken", exact: true }).screenshot({ path: `${screenshotDir}/staff-actions-${width}.png` });
  await captureStyle.evaluate(element => element.remove());
});
test("Staff creates, assigns, completes and inspects work history", async ({ page }) => {
  const { writes } = await controlledApp(page);
  await page.getByRole("button", { name: "New Action", exact: true }).click();
  await page.getByLabel("Action Description", { exact: true }).fill("Inspect replacement router");
  await page.getByLabel("Assigned to", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "Save Action", exact: true }).click();
  await expect(page.getByRole("region", { name: "Actions Taken", exact: true }).getByRole("status")).toContainText("Action saved");
  expect(writes[0].body.assigneeId).toBe(8); expect(writes[0].body).not.toHaveProperty("performedById");
  await page.getByRole("button", { name: "Edit Action #5", exact: true }).click();
  await page.getByLabel("Action Status", { exact: true }).selectOption("COMPLETED");
  await page.getByLabel("Result", { exact: true }).fill("Connectivity restored");
  await page.getByRole("button", { name: "Save Action", exact: true }).click();
  await expect(page.getByRole("group", { name: "Confirm Action Status" })).toContainText("Connectivity restored");
  await page.getByRole("button", { name: "Confirm Action Change" }).click();
  await expect(page.getByRole("button", { name: "Edit Action #5", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View History for Action #5", exact: true }).click();
  await expect(page.getByRole("region", { name: "History of Action #5" })).toContainText("Revision 1");
});
test("Completed follow-up is recorded without editing the original work", async ({ page }) => {
  const { writes } = await controlledApp(page, "IT_STAFF", { pendingFollowUp: true });
  await page.getByRole("button", { name: "Record Follow-up Completion for Action #4", exact: true }).click();
  await page.getByLabel("Completion Note", { exact: true }).fill("Requester confirmed connectivity");
  await page.getByRole("button", { name: "Record Completion", exact: true }).click();
  await expect(page.getByRole("region", { name: "Actions Taken", exact: true }).getByRole("status")).toContainText("Follow-up completion recorded");
  expect(writes[0].path).toMatch(/follow-up-completion$/); expect(writes[0].body).not.toHaveProperty("result");
  await expect(page.getByRole("article", { name: "Action #4", exact: true })).toContainText("Confirm with Requester");
});
test("Requester sees read-only work/history with keyboard focus and no write controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await controlledApp(page, "REQUESTER");
  await expect(page.getByRole("button", { name: "New Action", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Action #4", exact: true })).toHaveCount(0);
  const history = page.getByRole("button", { name: "View History for Action #4", exact: true }); await history.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "History of Action #4" })).toBeVisible(); await assertBounds(page);
  fs.mkdirSync(screenshotDir, { recursive: true });
  const captureStyle = await page.addStyleTag({ content: ".app-header { display: none !important; }" });
  await expect(page.locator(".app-header")).toBeHidden();
  await page.getByRole("region", { name: "Actions Taken", exact: true }).screenshot({ path: `${screenshotDir}/requester-history-mobile.png` });
  await captureStyle.evaluate(element => element.remove());
});
test("Action forms remain usable at 200% zoom and focus errors above the sticky shell", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await controlledApp(page);
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  await page.getByRole("button", { name: "New Action", exact: true }).click();
  await page.getByRole("button", { name: "Save Action", exact: true }).click();
  const description = page.getByLabel("Action Description", { exact: true }); await expect(description).toBeFocused();
  await assertBounds(page);
  const field = (await description.boundingBox())!, shell = (await page.locator(".app-header").boundingBox())!;
  expect(field.y).toBeGreaterThanOrEqual(shell.y + shell.height);
});
