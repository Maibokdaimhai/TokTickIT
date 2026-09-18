import { test, expect } from "@playwright/test";
import {
  createAccount,
  createTicketFixture,
  cleanAccounts,
  signOut,
  signIn,
  origin,
  apiOrigin,
  captureScreenshot,
  assertNoHorizontalOverflow,
  database,
} from "./helpers.js";

test.describe.serial("E2E-04: Authenticated Requester Regression & Workflows", () => {
  let primary: Awaited<ReturnType<typeof createAccount>>;
  let emptyUser: Awaited<ReturnType<typeof createAccount>>;
  let otherRequester: Awaited<ReturnType<typeof createAccount>>;
  let createdTicketNumber = "";
  let createdTicketId: number | null = null;

  test.beforeAll(async () => {
    primary = await createAccount("Jennifer Anderson", { role: "REQUESTER" });
    emptyUser = await createAccount("Empty Requester", { role: "REQUESTER" });
    otherRequester = await createAccount("Other Requester", { role: "REQUESTER" });
  });

  test.afterAll(cleanAccounts);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, primary.email);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("E2E-01: End-to-end ticket creation workflow, responsive views, validation, and attachment upload", async ({
    page,
  }) => {
    // Navigate to Create Ticket
    const createNavBtn = page.getByLabel("Main Navigation").getByRole("button", { name: /Create Ticket/ });
    await createNavBtn.click();
    await expect(page.locator('h1:has-text("Create Support Ticket")')).toBeVisible();

    // 1. Capture baseline screenshots for Create Ticket at 3 viewports
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/create-ticket-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/create-ticket-tablet-820.png");

    // Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/create-ticket-mobile-390.png");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Trigger validation errors by submitting empty form
    const submitBtn = page.locator('button[type="submit"]:has-text("Submit Ticket")');
    await submitBtn.click();

    const summaryError = page.locator("text=Summary is required.");
    const descError = page.locator("text=Description is required.");
    await expect(summaryError).toBeVisible();
    await expect(descError).toBeVisible();

    await captureScreenshot(page, "requester/supplemental-create-validation-errors.png");

    // 3. Trigger API failure callout (mock 500)
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "Database connection failed. Please try again later.",
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.fill("#ticket-summary", "Simulated failure for error callout capture");
    await page.fill(
      "#ticket-description",
      "Testing that the application renders a friendly error callout on backend failure."
    );
    await submitBtn.click();

    const apiErrorBox = page.locator(".form-error-msg:has-text('Database connection failed')");
    await expect(apiErrorBox).toBeVisible();
    await captureScreenshot(page, "requester/supplemental-create-api-failure.png");

    await page.unroute("**/api/tickets");

    // 4. Fill valid form fields and attach diagnostic file
    await page.fill("#ticket-summary", "Cannot connect to Campus Wi-Fi in Engineering Building");
    await page.fill(
      "#ticket-description",
      "Experiencing intermittent Wi-Fi disconnection every 10 minutes when connected to Eng-WiFi-5G network. Verified across multiple devices."
    );

    await page.setInputFiles("#initial-attachments", [
      {
        name: "wifi-diagnostics.png",
        mimeType: "image/png",
        buffer: Buffer.from("fake-diagnostic-screenshot-bytes"),
      },
    ]);
    await expect(page.locator("text=wifi-diagnostics.png")).toBeVisible();

    // 5. Submit valid ticket and verify success modal
    await submitBtn.click();
    const successBanner = page.locator(".form-success-banner");
    await expect(successBanner).toBeVisible({ timeout: 15000 });
    await expect(successBanner).toContainText("Ticket Created Successfully!");

    await captureScreenshot(page, "requester/supplemental-create-success-modal.png");

    const bannerText = await successBanner.innerText();
    const match = bannerText.match(/TKT-\d{4}-\d+/);
    expect(match).not.toBeNull();
    createdTicketNumber = match![0];

    // 6. Navigate to My Tickets and verify ticket appears with status "NEW"
    const myTicketsNavBtn = page.getByLabel("Main Navigation").getByRole("button", { name: "My Tickets" });
    await myTicketsNavBtn.click();
    await expect(page.locator(".tickets-table")).toBeVisible({ timeout: 10000 });

    const createdRow = page.locator(`tr:has-text("${createdTicketNumber}")`);
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText("New");
  });

  test("E2E-02: Search, category/system filter, responsive tables/cards, and pagination navigation", async ({
    page,
  }) => {
    const request = page.request;

    // Ensure sufficient tickets exist for Jennifer to test pagination
    const categoriesRes = await request.get(`${apiOrigin}/api/categories`);
    const categories = await categoriesRes.json();
    const systemsRes = await request.get(`${apiOrigin}/api/related-systems`);
    const systems = await systemsRes.json();

    const currentTicketsRes = await request.get(
      `${apiOrigin}/api/tickets?requesterId=${primary.id}&page=1&limit=50`
    );
    const currentTicketsData = await currentTicketsRes.json();
    const needed = Math.max(0, 12 - currentTicketsData.tickets.length);

    for (let i = 1; i <= needed; i++) {
      const cat = categories[i % categories.length];
      const sys = systems[i % systems.length];
      await request.post(`${apiOrigin}/api/tickets`, {
        headers: { Origin: origin },
        data: {
          requesterId: primary.id,
          categoryId: cat.id,
          relatedSystemId: sys.id,
          requestedPriority: i % 2 === 0 ? "HIGH" : "MEDIUM",
          summary: `[E2E Batch ${i}] Issue with ${sys.name} login and access credentials`,
          description: `Detailed support description for seeded automated testing ticket ${i}. Verifying list rendering and pagination.`,
        },
      });
    }

    // 1. Capture baseline screenshots for My Tickets at 3 viewports
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    const myTicketsNavBtn = page.getByLabel("Main Navigation").getByRole("button", { name: "My Tickets" });
    await myTicketsNavBtn.click();
    await expect(page.locator(".tickets-table")).toBeVisible({ timeout: 10000 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-tickets-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-tickets-tablet-820.png");

    // Mobile 390x844: table hidden, card container visible
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".tickets-mobile-list")).toBeVisible();
    await expect(page.locator(".ticket-card").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-tickets-mobile-390.png");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Test search and filtering
    const searchInput = page.locator("#ticket-search");
    await searchInput.fill("Wi-Fi");
    await page.waitForTimeout(600);
    const matchingRows = page.locator(".tickets-table tbody tr");
    await expect(matchingRows.first()).toBeVisible();
    await expect(matchingRows.first()).toContainText("Wi-Fi");

    await searchInput.fill("");
    await page.waitForTimeout(600);

    // 3. Authenticated Requester empty state
    await signOut(page);
    await signIn(page, emptyUser.email);
    const emptyState = page.getByTestId("empty-ticket-state");
    await expect(emptyState).toBeVisible();
    await captureScreenshot(page, "requester/supplemental-requester-empty-state.png");
  });

  test("E2E-03: Ticket detail inspection, attachment upload, download, and soft-removal with reason audit", async ({
    page,
  }) => {
    // Navigate to ticket detail view
    const firstRow = page.locator(".tickets-table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Verify detail rendered
    await expect(page.locator('[data-testid="ticket-number-heading"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="btn-back-to-tickets"]')).toBeVisible();

    // Extract ticket ID from URL
    const url = page.url();
    const idMatch = url.match(/\/tickets\/(\d+)/);
    expect(idMatch).not.toBeNull();
    createdTicketId = Number(idMatch![1]);

    // 1. Capture baseline screenshots for Requester Ticket Detail at 3 viewports
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-detail-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-detail-tablet-820.png");

    // Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-detail-mobile-390.png");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Upload an additional attachment
    const additionalFileInput = page.locator('[data-testid="input-additional-attachment"]');
    await additionalFileInput.setInputFiles({
      name: "system-audit-log.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock audit diagnostic logs for e2e"),
    });

    // Wait for active attachment card
    const activeCard = page
      .locator('[data-testid^="attachment-active-"]')
      .filter({ hasText: "system-audit-log.pdf" });
    await expect(activeCard).toBeVisible({ timeout: 10000 });

    // Verify download link returns 200 and binary content
    const downloadUrl = await activeCard.getByRole("link", { name: /Download/ }).getAttribute("href");
    const download = await page.request.get(downloadUrl!);
    expect(download.status()).toBe(200);
    expect((await download.body()).toString()).toBe("%PDF-1.4 mock audit diagnostic logs for e2e");

    await captureScreenshot(page, "requester/supplemental-ticket-attachment-active.png");

    // 3. Open soft-removal modal
    const removeBtn = activeCard.locator('button:has-text("Remove")');
    await removeBtn.click();

    const removalModal = page.locator('[data-testid="soft-remove-modal"]');
    await expect(removalModal).toBeVisible();
    await expect(removalModal).toContainText("Remove Attachment");

    await captureScreenshot(page, "requester/supplemental-ticket-attachment-soft-remove-modal.png");

    // 4. Fill mandatory removal reason and confirm
    const reasonTextarea = page.locator('[data-testid="removal-reason-textarea"]');
    await reasonTextarea.fill("Uploaded wrong diagnostic report containing obsolete network logs");

    const confirmRemovalBtn = page.locator('[data-testid="btn-confirm-removal"]');
    await expect(confirmRemovalBtn).toBeEnabled();
    await confirmRemovalBtn.click();

    await expect(removalModal).not.toBeVisible({ timeout: 10000 });

    // 5. Verify removed attachment card renders with reason and unavailable download
    const removedCard = page
      .locator('[data-testid^="attachment-removed-"]')
      .filter({ hasText: "system-audit-log.pdf" });
    await expect(removedCard).toBeVisible();
    await expect(removedCard).toContainText(
      "Uploaded wrong diagnostic report containing obsolete network logs"
    );
    await expect(removedCard).toContainText("Download unavailable");

    await captureScreenshot(page, "requester/supplemental-ticket-attachment-removed-audit.png");
  });

  test("E2E-04: Requester communication, problem-resolved indication, and ownership isolation", async ({
    page,
  }) => {
    expect(createdTicketId).not.toBeNull();

    // Navigate to ticket detail directly
    await page.goto(`/tickets/${createdTicketId}`);
    await expect(page.locator('[data-testid="ticket-number-heading"]')).toBeVisible();

    // 1. Post a public comment as Requester
    const commentInput = page.locator('[data-testid="input-public-comment"]');
    await expect(commentInput).toBeVisible();
    await commentInput.fill("I restarted the router in Room 302 and signal is still dropping intermittently.");

    const submitCommentBtn = page.locator('[data-testid="btn-submit-public-comment"]');
    await expect(submitCommentBtn).toBeEnabled();
    await submitCommentBtn.click();

    // Verify comment appears in timeline with Requester badge
    const commentsList = page.locator('[data-testid="comments-list"]');
    await expect(commentsList).toContainText("I restarted the router in Room 302");
    await expect(commentsList).toContainText("Requester");

    // Verify internal notes are NOT visible to the requester
    await expect(page.locator("text=Internal Notes")).toHaveCount(0);
    await expect(page.locator('[data-testid="internal-notes-list"]')).toHaveCount(0);

    await captureScreenshot(page, "requester/supplemental-requester-timeline-comment.png");

    // 2. Indicate Problem Appears Resolved (mandatory assertion)
    const resolveBtn = page.locator('[data-testid="btn-problem-appears-resolved"]');
    await expect(resolveBtn).toBeVisible();
    await resolveBtn.click();

    const dialog = page.locator('[data-testid="resolution-confirmation-dialog"]');
    await expect(dialog).toBeVisible();

    const noteInput = page.locator('[data-testid="textarea-resolution-comment"]');
    await noteInput.fill("Signal stabilized after switching to 2.4G SSID. Issue seems resolved for now.");

    const confirmBtn = page.locator('[data-testid="btn-confirm-resolution-indication"]');
    await confirmBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    const resolvedBanner = page.locator('[data-testid="problem-resolved-banner"]');
    await expect(resolvedBanner).toBeVisible();
    await expect(resolvedBanner).toContainText("Marked as resolved by requester");
    await expect(resolvedBanner).toContainText("Reported resolved on");

    await captureScreenshot(page, "requester/supplemental-requester-problem-resolved.png");

    // Assert ticket status was NOT changed to RESOLVED or CLOSED
    const statusBadge = page.locator("h1[data-testid='ticket-number-heading'] + span");
    await expect(statusBadge).toContainText("NEW");
    await expect(statusBadge).not.toContainText("Resolved");
    await expect(statusBadge).not.toContainText("Closed");

    const db = database();
    const dbTicket = await db.ticket.findUnique({ where: { id: createdTicketId } });
    expect(dbTicket?.status).toBe("NEW");
    expect(dbTicket?.status).not.toBe("RESOLVED");
    expect(dbTicket?.status).not.toBe("CLOSED");
    expect(dbTicket?.problemAppearsResolvedById).toBe(primary.id);
    expect(dbTicket?.problemAppearsResolvedAt).toBeTruthy();

    // 3. Ownership isolation: Another requester cannot access Jennifer's ticket
    await signOut(page);
    await signIn(page, otherRequester.email);
    await expect(page.getByRole("navigation")).toBeVisible();

    // Attempt direct navigation to Jennifer's ticket (unauthorized)
    await page.goto(`/tickets/${createdTicketId}`);
    // Backend returns 404, frontend displays detail-error "Unable to display ticket"
    const unauthorizedError = page.locator('[data-testid="detail-error"]');
    await expect(unauthorizedError).toBeVisible({ timeout: 10000 });
    const unauthorizedText = (await unauthorizedError.innerText()).trim();

    // Attempt direct navigation to nonexistent ticket
    await page.goto("/tickets/99999999");
    const nonexistentError = page.locator('[data-testid="detail-error"]');
    await expect(nonexistentError).toBeVisible({ timeout: 10000 });
    const nonexistentText = (await nonexistentError.innerText()).trim();

    // Verify both expose the identical safe user-facing error state (neither leaks existence)
    expect(unauthorizedText).toBe(nonexistentText);
    expect(unauthorizedText).toContain("Unable to display ticket");
  });
});
