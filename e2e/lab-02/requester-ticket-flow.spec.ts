import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

// Ensure screenshot artifact directories exist
const SCREENSHOT_BASE = path.resolve(process.cwd(), "artifacts/lab-02/screenshots");
const CREATE_TICKET_DIR = path.join(SCREENSHOT_BASE, "create-ticket");
const MY_TICKETS_DIR = path.join(SCREENSHOT_BASE, "my-tickets");
const TICKET_DETAIL_DIR = path.join(SCREENSHOT_BASE, "ticket-detail");

[CREATE_TICKET_DIR, MY_TICKETS_DIR, TICKET_DETAIL_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper to ensure sticky elements (like header) are captured at top of page
async function captureScreenshot(page: Page, options: Parameters<Page["screenshot"]>[0]) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  return page.screenshot(options);
}

test.describe.serial("Lab 2 Requester Ticket Journey & Evidence Collection", () => {
  let createdTicketNumber: string = "";

  test.beforeEach(async ({ page }) => {
    // Navigate to base URL and set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Handle initial identity selector modal if open
    const modal = page.locator('.modal-backdrop[role="dialog"]');
    if (await modal.isVisible()) {
      const select = page.locator("#requester-select");
      if (await select.isVisible()) {
        const options = await select.locator("option").all();
        for (const opt of options) {
          const text = await opt.innerText();
          if (text.includes("Jennifer Anderson")) {
            const val = await opt.getAttribute("value");
            if (val) await select.selectOption({ value: val });
            break;
          }
        }
      }
      const continueBtn = page.locator(".modal-backdrop button.btn-primary");
      await continueBtn.click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("E2E-01: End-to-end requester creation workflow with attachment upload and verification in My Tickets", async ({ page }) => {
    // 1. Navigate to Create Ticket tab
    const createNavBtn = page.locator('nav button:has-text("Create Ticket")');
    await createNavBtn.click();
    await expect(page.locator('h1:has-text("Create Support Ticket")')).toBeVisible();

    // Capture 01-initial-form.png
    await captureScreenshot(page,{
      path: path.join(CREATE_TICKET_DIR, "01-initial-form.png"),
      fullPage: true,
    });

    // 2. Trigger validation errors by submitting empty form
    const submitBtn = page.locator('button[type="submit"]:has-text("Submit Ticket")');
    await submitBtn.click();

    // Verify inline field errors appear
    const summaryError = page.locator("text=Summary is required.");
    const descError = page.locator("text=Description is required.");
    await expect(summaryError).toBeVisible();
    await expect(descError).toBeVisible();

    // Capture 02-validation-error.png
    await captureScreenshot(page,{
      path: path.join(CREATE_TICKET_DIR, "02-validation-error.png"),
      fullPage: true,
    });

    // 3. Trigger API failure callout (intercept /api/tickets to return HTTP 500)
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
    await page.fill("#ticket-description", "Testing that the application renders a friendly error callout on backend failure.");
    await submitBtn.click();

    const apiErrorBox = page.locator(".form-error-msg:has-text('Database connection failed')");
    await expect(apiErrorBox).toBeVisible();

    // Capture 05-api-failure.png
    await captureScreenshot(page,{
      path: path.join(CREATE_TICKET_DIR, "05-api-failure.png"),
      fullPage: true,
    });

    await page.unroute("**/api/tickets");

    // 4. Test Submitting Busy state (intercept /api/tickets with artificial delay)
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      } else {
        await route.continue();
      }
    });

    // Fill valid form fields
    await page.fill("#ticket-summary", "Cannot connect to Campus Wi-Fi in Engineering Building");
    await page.fill(
      "#ticket-description",
      "Experiencing intermittent Wi-Fi disconnection every 10 minutes when connected to Eng-WiFi-5G network. Verified across multiple devices."
    );

    // Attach supporting evidence file
    await page.setInputFiles("#initial-attachments", [
      {
        name: "wifi-diagnostics.png",
        mimeType: "image/png",
        buffer: Buffer.from("fake-diagnostic-screenshot-bytes"),
      },
    ]);
    await expect(page.locator("text=wifi-diagnostics.png")).toBeVisible();

    // Click submit and capture busy submitting state
    await submitBtn.click();
    const busyBtn = page.locator('button[type="submit"]:has-text("Submitting Ticket...")');
    await expect(busyBtn).toBeVisible();

    // Capture 03-submitting-busy.png
    await captureScreenshot(page,{
      path: path.join(CREATE_TICKET_DIR, "03-submitting-busy.png"),
      fullPage: true,
    });

    // 5. Success state
    const successBanner = page.locator(".form-success-banner");
    await expect(successBanner).toBeVisible({ timeout: 15000 });
    await expect(successBanner).toContainText("Ticket Created Successfully!");

    await page.unroute("**/api/tickets");

    // Capture 04-success-modal.png
    await captureScreenshot(page,{
      path: path.join(CREATE_TICKET_DIR, "04-success-modal.png"),
      fullPage: true,
    });

    // Extract ticket number
    const bannerText = await successBanner.innerText();
    const match = bannerText.match(/TKT-2026-\d+/);
    expect(match).not.toBeNull();
    createdTicketNumber = match![0];

    // 6. Navigate to My Tickets and verify ticket appears with status "NEW"
    const myTicketsNavBtn = page.locator('nav button:has-text("My Tickets")');
    await myTicketsNavBtn.click();
    await expect(page.locator(".tickets-table")).toBeVisible({ timeout: 10000 });

    const createdRow = page.locator(`tr:has-text("${createdTicketNumber}")`);
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText("New");
  });

  test("E2E-02: Search, category/system filter, and pagination navigation under seeded volume", async ({ page, request }) => {
    // 1. Ensure sufficient tickets exist for pagination and filtering
    const categoriesRes = await request.get("http://localhost:3000/api/categories");
    const categories = await categoriesRes.json();
    const systemsRes = await request.get("http://localhost:3000/api/related-systems");
    const systems = await systemsRes.json();

    const usersRes = await request.get("http://localhost:3000/api/requesters");
    const users = await usersRes.json();
    const jennifer = users.find((u: any) => u.name.includes("Jennifer"));
    expect(jennifer).toBeDefined();

    // Seed additional tickets for Jennifer if total < 12
    const currentTicketsRes = await request.get(`http://localhost:3000/api/tickets?requesterId=${jennifer.id}&page=1&limit=50`);
    const currentTicketsData = await currentTicketsRes.json();
    const needed = Math.max(0, 12 - currentTicketsData.tickets.length);

    for (let i = 1; i <= needed; i++) {
      const cat = categories[i % categories.length];
      const sys = systems[i % systems.length];
      await request.post("http://localhost:3000/api/tickets", {
        data: {
          requesterId: jennifer.id,
          categoryId: cat.id,
          relatedSystemId: sys.id,
          requestedPriority: i % 2 === 0 ? "HIGH" : "MEDIUM",
          summary: `[E2E Batch ${i}] Issue with ${sys.name} login and access credentials`,
          description: `Detailed support description for seeded automated testing ticket ${i}. Verifying list rendering and pagination.`,
        },
      });
    }

    // 2. Navigate to My Tickets on desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    const myTicketsNavBtn = page.locator('nav button:has-text("My Tickets")');
    await myTicketsNavBtn.click();
    await expect(page.locator(".tickets-table")).toBeVisible({ timeout: 10000 });

    // Capture 01-desktop-table.png
    await captureScreenshot(page,{
      path: path.join(MY_TICKETS_DIR, "01-desktop-table.png"),
      fullPage: true,
    });

    // 3. Responsive Mobile View (< 768px)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator(".tickets-mobile-list")).toBeVisible();
    await expect(page.locator(".ticket-card").first()).toBeVisible();

    // Capture 02-mobile-cards.png
    await captureScreenshot(page,{
      path: path.join(MY_TICKETS_DIR, "02-mobile-cards.png"),
      fullPage: true,
    });

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // 4. Test Filter & Search
    const searchInput = page.locator("#ticket-search");
    await searchInput.fill("Wi-Fi");
    // Wait for debounced search to update table
    await page.waitForTimeout(600);
    const matchingRows = page.locator(".tickets-table tbody tr");
    await expect(matchingRows.first()).toBeVisible();
    await expect(matchingRows.first()).toContainText("Wi-Fi");

    // Capture 03-filtered-results.png
    await captureScreenshot(page,{
      path: path.join(MY_TICKETS_DIR, "03-filtered-results.png"),
      fullPage: true,
    });

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(600);

    // 5. Test Empty State for requester with 0 tickets
    let emptyUser: any = null;
    for (const u of users) {
      const countRes = await request.get(`http://localhost:3000/api/tickets?requesterId=${u.id}&page=1&limit=1`);
      const countData = await countRes.json();
      if (countData.tickets && countData.tickets.length === 0) {
        emptyUser = u;
        break;
      }
    }
    expect(emptyUser).not.toBeNull();

    // Open Requester Switcher
    const badgeBtn = page.locator(".requester-badge-btn");
    await badgeBtn.click();
    const modal = page.locator('.modal-backdrop[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(page.locator("text=Loading active requesters...")).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(400);

    await page.locator("#requester-select").selectOption({ value: String(emptyUser.id) });
    await page.locator(".modal-backdrop button.btn-primary:has-text('Continue')").click();
    await expect(modal).not.toBeVisible();

    // Verify empty state is rendered
    const emptyState = page.locator('[data-testid="empty-ticket-state"]');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
    await expect(emptyState).toContainText("No Tickets Found");

    // Capture 04-empty-state.png
    await captureScreenshot(page,{
      path: path.join(MY_TICKETS_DIR, "04-empty-state.png"),
      fullPage: true,
    });

    // Switch back to Jennifer Anderson for subsequent tests
    await badgeBtn.click();
    await expect(modal).toBeVisible();
    await expect(page.locator("text=Loading active requesters...")).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(400);
    await page.locator("#requester-select").selectOption({ value: String(jennifer.id) });
    await page.locator(".modal-backdrop button.btn-primary:has-text('Continue')").click();
    await expect(modal).not.toBeVisible();
    await expect(page.locator(".tickets-table")).toBeVisible({ timeout: 10000 });
  });

  test("E2E-03: Ticket detail inspection, additional attachment upload, and soft-removal with reason audit verification", async ({ page }) => {
    // 0. Ensure Jennifer Anderson is selected
    const badge = page.locator(".requester-badge-btn");
    const badgeText = await badge.innerText();
    if (!badgeText.includes("Jennifer Anderson")) {
      await badge.click();
      const modal = page.locator('.modal-backdrop[role="dialog"]');
      await expect(modal).toBeVisible();
      await expect(page.locator("text=Loading active requesters...")).not.toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(400);
      const jenniferOpt = page.locator("#requester-select option:has-text('Jennifer Anderson')");
      const jVal = await jenniferOpt.getAttribute("value");
      if (jVal) await page.locator("#requester-select").selectOption({ value: jVal });
      await page.locator(".modal-backdrop button.btn-primary:has-text('Continue')").click();
      await expect(modal).not.toBeVisible();
    }

    // 1. In My Tickets table, click on the first ticket row to open detail view
    const firstRow = page.locator(".tickets-table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Verify Ticket Detail view is rendered
    await expect(page.locator('[data-testid="ticket-number-heading"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="btn-back-to-tickets"]')).toBeVisible();

    // Capture 01-detail-view.png
    await captureScreenshot(page,{
      path: path.join(TICKET_DETAIL_DIR, "01-detail-view.png"),
      fullPage: true,
    });

    // 2. Upload an additional attachment
    const additionalFileInput = page.locator('[data-testid="input-additional-attachment"]');
    await additionalFileInput.setInputFiles({
      name: "system-audit-log.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mock audit diagnostic logs for e2e"),
    });

    // Wait for the active attachment card to render
    const activeCard = page.locator('[data-testid^="attachment-active-"]').filter({ hasText: "system-audit-log.pdf" });
    await expect(activeCard).toBeVisible({ timeout: 10000 });

    // Capture 02-attachment-active.png
    await captureScreenshot(page,{
      path: path.join(TICKET_DETAIL_DIR, "02-attachment-active.png"),
      fullPage: true,
    });

    // 3. Click "Remove" button to open Soft-Removal Modal
    const removeBtn = activeCard.locator('button:has-text("Remove")');
    await removeBtn.click();

    const removalModal = page.locator('[data-testid="soft-remove-modal"]');
    await expect(removalModal).toBeVisible();
    await expect(removalModal).toContainText("Remove Attachment");

    // Capture 03-soft-remove-modal.png
    await captureScreenshot(page,{
      path: path.join(TICKET_DETAIL_DIR, "03-soft-remove-modal.png"),
    });

    // 4. Fill mandatory removal reason (>= 3 chars) and confirm
    const reasonTextarea = page.locator('[data-testid="removal-reason-textarea"]');
    await reasonTextarea.fill("Uploaded wrong diagnostic report containing obsolete network logs");

    const confirmRemovalBtn = page.locator('[data-testid="btn-confirm-removal"]');
    await expect(confirmRemovalBtn).toBeEnabled();
    await confirmRemovalBtn.click();

    // Wait for modal to close
    await expect(removalModal).not.toBeVisible({ timeout: 10000 });

    // 5. Verify the attachment is now rendered in the Removed Attachments list
    const removedCard = page.locator('[data-testid^="attachment-removed-"]').filter({ hasText: "system-audit-log.pdf" });
    await expect(removedCard).toBeVisible();
    await expect(removedCard).toContainText("Uploaded wrong diagnostic report containing obsolete network logs");
    await expect(removedCard).toContainText("Download unavailable");

    // Capture 04-attachment-removed.png
    await captureScreenshot(page,{
      path: path.join(TICKET_DETAIL_DIR, "04-attachment-removed.png"),
      fullPage: true,
    });
  });
});
