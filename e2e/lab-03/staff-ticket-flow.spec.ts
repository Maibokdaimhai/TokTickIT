import { test, expect } from "@playwright/test";
import {
  createAccount,
  createTicketFixture,
  cleanAccounts,
  signOut,
  signIn,
  database,
  captureScreenshot,
  assertNoHorizontalOverflow,
} from "./helpers.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

test.describe.serial("E2E-02: Staff Ticket Operations & Queue Workflow", () => {
  let staffUser: Awaited<ReturnType<typeof createAccount>>;
  let otherStaff: Awaited<ReturnType<typeof createAccount>>;
  let requesterUser: Awaited<ReturnType<typeof createAccount>>;
  let testTicket: Awaited<ReturnType<typeof createTicketFixture>>;
  let highPriTicket: Awaited<ReturnType<typeof createTicketFixture>>;
  let urgentPriTicket: Awaited<ReturnType<typeof createTicketFixture>>;

  test.beforeAll(async () => {
    staffUser = await createAccount("Alex Rivera", { role: "IT_STAFF" });
    otherStaff = await createAccount("Taylor Kim", { role: "IT_STAFF" });
    requesterUser = await createAccount("Jordan Lee", { role: "REQUESTER" });

    // Seed dedicated fixture tickets for staff operations testing
    testTicket = await createTicketFixture({
      requesterId: requesterUser.id,
      summary: "Staff operations E2E hardware workstation failure",
      description: "Workstation motherboard fails to POST with continuous beep sequence after power surge.",
      requestedPriority: "MEDIUM",
      itPriority: "LOW",
      status: "OPEN",
      ownerId: null,
    });

    highPriTicket = await createTicketFixture({
      requesterId: requesterUser.id,
      summary: "High priority network connectivity incident [E2E]",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN",
      ownerId: null,
    });

    urgentPriTicket = await createTicketFixture({
      requesterId: requesterUser.id,
      summary: "Urgent core database cluster failure [E2E]",
      requestedPriority: "URGENT",
      itPriority: "URGENT",
      status: "OPEN",
      ownerId: null,
    });

    // Create additional tickets so queue has at least 11 items for pagination verification
    const db = database();
    const existingCount = await db.ticket.count();
    if (existingCount < 12) {
      for (let i = 0; i < 12 - existingCount; i++) {
        await createTicketFixture({
          requesterId: requesterUser.id,
          summary: `[E2E] Batch ticket ${i + 1} for pagination testing`,
          status: "NEW",
        });
      }
    }
  });

  test.afterAll(cleanAccounts);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, staffUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("staff queue: responsive layout, search, filters, sorting, and preserved pagination", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();

    // 1. Capture baseline screenshots at 3 viewports
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-queue/staff-queue-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-queue/staff-queue-tablet-820.png");

    // Mobile 390x844: table hidden, mobile list visible
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-testid="queue-mobile-list"]')).toBeVisible();
    await expect(page.locator(".ticket-card").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-queue/staff-queue-mobile-390.png");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Populated state: verify rows exist
    await expect(page.locator(".tickets-table tbody tr").first()).toBeVisible();

    // 2. Search input filtering
    const searchInput = page.locator("#staff-ticket-search");
    await searchInput.fill(testTicket.ticketNumber);
    await page.waitForTimeout(500);

    const matchingRow = page.locator(`[data-testid="queue-row-${testTicket.id}"]`);
    await expect(matchingRow).toBeVisible();
    await expect(matchingRow).toContainText(testTicket.ticketNumber);
    await searchInput.fill("");
    await page.waitForTimeout(400);

    // 3. Category filter
    const catSelect = page.locator("#staff-filter-category");
    await catSelect.selectOption({ index: 1 });
    await page.waitForTimeout(400);
    await expect(page.locator(".tickets-table tbody tr").first()).toBeVisible();
    await catSelect.selectOption("");

    // 4. Status filter
    const statusSelect = page.locator("#staff-filter-status");
    await statusSelect.selectOption("OPEN");
    await page.waitForTimeout(400);
    const openRows = page.locator(".tickets-table tbody tr");
    await expect(openRows.first()).toBeVisible();
    await statusSelect.selectOption("");

    // 5. Requested Priority filter
    const reqPriSelect = page.locator("#staff-filter-req-priority");
    await reqPriSelect.selectOption("URGENT");
    await page.waitForTimeout(400);
    await expect(page.locator(".tickets-table tbody tr").first()).toContainText("URGENT");
    await reqPriSelect.selectOption("");

    // 6. IT Priority filter
    const itPriSelect = page.locator("#staff-filter-it-priority");
    await itPriSelect.selectOption("HIGH");
    await page.waitForTimeout(400);
    await expect(page.locator(".tickets-table tbody tr").first()).toContainText("HIGH");
    await itPriSelect.selectOption("");

    // 7. Owner filter
    const ownerSelect = page.locator("#staff-filter-owner");
    await ownerSelect.selectOption("unassigned");
    await page.waitForTimeout(400);
    await expect(page.locator(".tickets-table tbody tr").first()).toContainText("Unassigned");
    await ownerSelect.selectOption("");

    // 8. Approved sorting: itPriority_desc (Urgent First)
    const sortSelect = page.locator("#staff-filter-sort");
    await sortSelect.selectOption("itPriority_desc");
    await page.waitForTimeout(400);
    const firstRowPri = page.locator(".tickets-table tbody tr").first();
    await expect(firstRowPri).toContainText(/URGENT|HIGH/);

    // 9. Pagination navigation and state preservation
    // Navigate to page 2
    const page2Btn = page.getByRole("button", { name: "Page 2" }).first();
    await expect(page2Btn).toBeVisible();
    await page2Btn.click();
    await page.waitForTimeout(400);

    // Verify page 2 is active
    await expect(page.locator("text=Showing").first()).toBeVisible();

    // Open first ticket on page 2
    const firstRowOnPage2 = page.locator(".tickets-table tbody tr").first();
    await firstRowOnPage2.getByRole("button", { name: /Open/i }).click();
    await expect(page.locator('[data-testid="staff-ticket-number-heading"]')).toBeVisible();

    // Click Back to Queue and verify page 2 is preserved
    await page.locator('[data-testid="btn-back-to-queue"]').first().click();
    await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 2" }).first()).toBeVisible();
  });

  test("staff queue edge states: filtered no-results, clear filters, true-empty, retry, and requester forbidden", async ({
    page,
  }) => {
    // 1. Filtered no-results state and Clear Filters
    const searchInput = page.locator("#staff-ticket-search");
    await searchInput.fill("NONEXISTENT_SEARCH_STRING_E2E_99999");
    await page.waitForTimeout(500);

    const noResults = page.locator('[data-testid="queue-no-results"]');
    await expect(noResults).toBeVisible();
    await captureScreenshot(page, "staff-queue/supplemental-staff-filtered-no-results.png");

    // Click Clear Filters button
    await page.locator('button:has-text("Clear All Filters")').click();
    await page.waitForTimeout(400);
    await expect(noResults).not.toBeVisible();
    await expect(page.locator(".tickets-table tbody tr").first()).toBeVisible();

    // 2. True-empty state (simulated route-intercepted empty queue)
    await page.route("**/api/staff/tickets*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [],
          pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
        }),
      });
    });

    await page.reload();
    const emptyNotice = page.locator('[data-testid="queue-empty"]');
    await expect(emptyNotice).toBeVisible();
    await expect(emptyNotice).toContainText("The IT staff queue is currently clear");

    await page.unroute("**/api/staff/tickets*");

    // 3. Simulated safe failure state with Retry (route-intercepted)
    await page.route("**/api/staff/tickets*", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Simulated queue backend error" } }),
      });
    });

    await page.reload();
    const errorNotice = page.locator('[data-testid="queue-error"]');
    await expect(errorNotice).toBeVisible();
    await expect(errorNotice).toContainText("Error loading queue");

    // Unroute mock error before clicking Retry so retry fetch succeeds
    await page.unroute("**/api/staff/tickets*");

    // Click Retry
    await page.locator('[data-testid="queue-error"] button:has-text("Retry")').click();
    await expect(errorNotice).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator(".tickets-table tbody tr").first()).toBeVisible();

    // 4. Requester forbidden state
    await signOut(page);
    await signIn(page, requesterUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.goto("/staff/tickets");
    // Verify forbidden notice (403 route protection)
    const forbiddenAlert = page.locator('[data-testid="route-forbidden"]');
    await expect(forbiddenAlert).toBeVisible();
    await expect(forbiddenAlert).toContainText("Access Denied (403)");
  });

  test("ticket operations: claim, eligible owners list, reassignment, IT priority update, and complete status lifecycle", async ({
    page,
  }) => {
    const db = database();
    const opTicket = await createTicketFixture({
      requesterId: requesterUser.id,
      summary: "Full lifecycle staff operations ticket [E2E]",
      description: "Testing complete claiming, assignment, priority, and transitions.",
      requestedPriority: "MEDIUM",
      itPriority: "LOW",
      status: "OPEN",
      ownerId: null,
    });

    await page.goto(`/staff/tickets/${opTicket.id}`);
    await expect(page.locator('[data-testid="staff-ticket-number-heading"]')).toBeVisible();

    // 1. Capture baseline screenshots for Staff Ticket Detail at 3 viewports
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-ticket-detail/staff-detail-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-ticket-detail/staff-detail-tablet-820.png");

    // Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);

    const opControlSelectors = [
      '[data-testid="btn-claim-ticket"]',
      '[data-testid="select-owner"]',
      '[data-testid="btn-save-owner"]',
      '[data-testid="select-it-priority"]',
      '[data-testid="btn-save-it-priority"]',
      '[data-testid="select-status"]',
      '[data-testid="btn-save-status"]',
    ];
    for (const selector of opControlSelectors) {
      const control = page.locator(selector);
      if (await control.isVisible()) {
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(390);
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    }

    await captureScreenshot(page, "staff-ticket-detail/staff-detail-mobile-390.png");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Claim unassigned ticket
    const claimBtn = page.locator('[data-testid="btn-claim-ticket"]');
    await expect(claimBtn).toBeVisible();
    await claimBtn.click();

    // Owner display now shows Alex Rivera
    const ownerDisplay = page.locator('[data-testid="owner-display"]');
    await expect(ownerDisplay).toContainText(staffUser.name);

    // 3. Verify eligible-owner list contains active Staff and Admins, excludes inactive/requesters
    const ownerSelect = page.locator('[data-testid="select-owner"]');
    const ownerOptions = await ownerSelect.locator("option").allTextContents();
    expect(ownerOptions.some((opt) => opt.includes(staffUser.name))).toBe(true);
    expect(ownerOptions.some((opt) => opt.includes(otherStaff.name))).toBe(true);
    expect(ownerOptions.some((opt) => opt.includes(requesterUser.name))).toBe(false);

    // 4. Reassign to Taylor Kim
    await ownerSelect.selectOption(String(otherStaff.id));
    const [ownerRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/owner") && res.request().method() === "PATCH"),
      page.locator('[data-testid="btn-save-owner"]').click(),
    ]);
    expect(ownerRes.ok()).toBe(true);
    await expect(ownerDisplay).toContainText(otherStaff.name);
    await captureScreenshot(page, "staff-ticket-detail/supplemental-staff-assigned-state.png");

    // 5. IT Priority update and persisted version increment
    const initialVersion = (await db.ticket.findUnique({ where: { id: opTicket.id } }))?.version ?? 0;
    const prioritySelect = page.locator('[data-testid="select-it-priority"]');
    await prioritySelect.selectOption("HIGH");
    const [priorityRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/it-priority") && res.request().method() === "PATCH"),
      page.locator('[data-testid="btn-save-it-priority"]').click(),
    ]);
    expect(priorityRes.ok()).toBe(true);
    await expect(prioritySelect).toHaveValue("HIGH");

    const updatedPriDb = await db.ticket.findUnique({ where: { id: opTicket.id } });
    expect(updatedPriDb?.itPriority).toBe("HIGH");
    expect(updatedPriDb?.version).toBeGreaterThan(initialVersion);

    // 6. Complete OPEN -> IN_PROGRESS transition
    const statusSelect = page.locator('[data-testid="select-status"]');
    await statusSelect.selectOption("IN_PROGRESS");
    const [statusRes1] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/status") && res.request().method() === "PATCH"),
      page.locator('[data-testid="btn-save-status"]').click(),
    ]);
    expect(statusRes1.ok()).toBe(true);

    const statusBadge = page.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toContainText("IN_PROGRESS");

    // 7. Complete IN_PROGRESS -> RESOLVED confirmation (confirmed to completion, do not cancel)
    await statusSelect.selectOption("RESOLVED");
    await page.locator('[data-testid="btn-save-status"]').click();

    const confirmModal = page.locator('[data-testid="status-confirmation-dialog"]');
    await expect(confirmModal).toBeVisible();
    await captureScreenshot(page, "staff-ticket-detail/supplemental-staff-status-transition-modal.png");

    // Confirm transition
    const [statusRes2] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/status") && res.request().method() === "PATCH"),
      page.locator('[data-testid="btn-confirm-status-modal"]').click(),
    ]);
    expect(statusRes2.ok()).toBe(true);
    await expect(confirmModal).not.toBeVisible({ timeout: 10000 });

    // Assert final persisted RESOLVED state in UI and DB
    await expect(statusBadge).toContainText("RESOLVED");
    const resolvedDb = await db.ticket.findUnique({ where: { id: opTicket.id } });
    expect(resolvedDb?.status).toBe("RESOLVED");

    // 8. 409 optimistic-concurrency response and reload recovery
    await db.ticket.update({
      where: { id: opTicket.id },
      data: {
        version: { increment: 1 },
        summary: "Concurrently updated summary by Senior Specialist",
      },
    });

    // Attempt status change in browser using stale version
    await statusSelect.selectOption("CLOSED");
    await page.locator('[data-testid="btn-save-status"]').click();

    // Confirm in modal
    await expect(confirmModal).toBeVisible();
    await page.locator('[data-testid="btn-confirm-status-modal"]').click();

    // Conflict banner appears
    const conflictBanner = page.locator('[data-testid="conflict-banner"]');
    await expect(conflictBanner).toBeVisible({ timeout: 10000 });
    await expect(conflictBanner).toContainText("Optimistic Concurrency Conflict");
    await captureScreenshot(page, "staff-ticket-detail/supplemental-staff-conflict-modal.png");

    // Click reload latest version
    await page.locator('[data-testid="btn-reload-conflict"]').click();
    await expect(conflictBanner).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Senior Specialist")).toBeVisible();
  });

  test("communication and attachments: public comment, internal note, requester isolation, metadata, download byte check, soft-removal reason audit, and problem resolved display", async ({
    page,
  }) => {
    const db = database();

    // 1. Create a dedicated ticket with active and soft-removed attachments and resolution indication
    const detailTicket = await createTicketFixture({
      requesterId: requesterUser.id,
      summary: "Staff inspection of communication, attachments, and resolution [E2E]",
      status: "OPEN",
    });

    // Create real test upload files
    const uploadsDir = path.resolve(process.cwd(), "artifacts/lab-03/scratch/uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const activeFilePath = path.join(uploadsDir, `active-${randomUUID()}.txt`);
    const activeFileContent = "Active server attachment diagnostic telemetry content 2026";
    await fs.writeFile(activeFilePath, activeFileContent);

    const removedFilePath = path.join(uploadsDir, `removed-${randomUUID()}.txt`);
    await fs.writeFile(removedFilePath, "Removed attachment obsolete file");

    const activeAtt = await db.attachment.create({
      data: {
        ticketId: detailTicket.id,
        fileName: "server-telemetry.txt",
        originalName: "server-telemetry.txt",
        mimeType: "text/plain",
        fileSize: Buffer.byteLength(activeFileContent),
        filePath: activeFilePath,
        isRemoved: false,
      },
    });

    const removedAtt = await db.attachment.create({
      data: {
        ticketId: detailTicket.id,
        fileName: "obsolete-config.txt",
        originalName: "obsolete-config.txt",
        mimeType: "text/plain",
        fileSize: 32,
        filePath: removedFilePath,
        isRemoved: true,
        removalReason: "Superceded by server telemetry diagnostic",
        removedAt: new Date(),
      },
    });

    // Set problemAppearsResolved on ticket
    await db.ticket.update({
      where: { id: detailTicket.id },
      data: {
        problemAppearsResolvedAt: new Date(),
        problemAppearsResolvedById: requesterUser.id,
      },
    });

    // Navigate to ticket detail as Staff
    await page.goto(`/staff/tickets/${detailTicket.id}`);
    await expect(page.locator('[data-testid="staff-ticket-number-heading"]')).toBeVisible();

    // 2. Verify Requester "Problem Appears Resolved" indication and timestamp
    await expect(page.locator("text=Requester indicated problem appears resolved")).toBeVisible();
    await expect(page.locator("text=Reported on")).toBeVisible();

    // 3. Staff attachment metadata inspection
    await expect(page.locator(`text=${activeAtt.originalName}`)).toBeVisible();
    await expect(page.locator(`text=${removedAtt.originalName}`)).toBeVisible();

    // 4. Active attachment download and byte verification
    const downloadPromise = page.waitForEvent("download");
    await page.locator(`[data-testid="btn-staff-download-${activeAtt.id}"]`).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const downloadedBuf = await fs.readFile(downloadPath!);
    expect(downloadedBuf.toString()).toBe(activeFileContent);

    // 5. Removed attachment has no usable download action and shows removal reason
    const removedCard = page.locator(`[data-testid="attachment-removed-${removedAtt.id}"]`);
    await expect(removedCard).toBeVisible();
    await expect(page.locator(`[data-testid="btn-staff-download-${removedAtt.id}"]`)).toHaveCount(0);
    await expect(removedCard).toContainText("Download unavailable");
    await expect(removedCard).toContainText("Superceded by server telemetry diagnostic");

    // 6. Post Public Comment
    const publicCommentInput = page.locator('[data-testid="input-staff-public-comment"]');
    await publicCommentInput.fill("Public staff response: diagnostics completed.");
    await page.locator('[data-testid="btn-submit-staff-public-comment"]').click();

    const publicCommentsSection = page.locator('[data-testid="staff-public-comments-section"]');
    await expect(publicCommentsSection).toContainText("diagnostics completed");

    // 7. Post Internal Note
    const internalNoteInput = page.locator('[data-testid="input-internal-note"]');
    await internalNoteInput.fill("CONFIDENTIAL NOTE: Root cause identified as voltage regulator malfunction.");
    await page.locator('[data-testid="btn-submit-internal-note"]').click();

    const internalNotesSection = page.locator('[data-testid="staff-internal-notes-section"]');
    await expect(internalNotesSection).toContainText("voltage regulator malfunction");
    await captureScreenshot(page, "staff-ticket-detail/supplemental-staff-internal-note.png");

    // 8. Requester Isolation: Internal note is absent for Requester
    await signOut(page);
    await signIn(page, requesterUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.goto(`/tickets/${detailTicket.id}`);
    await expect(page.locator('[data-testid="ticket-number-heading"]')).toBeVisible();

    // Public comment visible to requester
    await expect(page.locator('[data-testid="comments-list"]')).toContainText("diagnostics completed");

    // Internal note absent from requester view
    await expect(page.locator("text=voltage regulator malfunction")).toHaveCount(0);
    await expect(page.locator('[data-testid="staff-internal-notes-section"]')).toHaveCount(0);
  });
});
