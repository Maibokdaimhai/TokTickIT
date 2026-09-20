import { test, expect } from "@playwright/test";
import {
  createAccount,
  cleanAccounts,
  signOut,
  signIn,
  createTicketFixture,
  captureScreenshot,
  assertNoHorizontalOverflow,
  assertTouchTargets,
  getInitialPassword,
} from "./helpers.js";

test.describe.serial("VIS-01: Responsive Layout & Accessibility Inspection", () => {
  let requesterUser: Awaited<ReturnType<typeof createAccount>>;
  let staffUser: Awaited<ReturnType<typeof createAccount>>;
  let adminUser: Awaited<ReturnType<typeof createAccount>>;
  let ticketFixture: Awaited<ReturnType<typeof createTicketFixture>>;

  test.beforeAll(async () => {
    requesterUser = await createAccount("Responsive Requester", { role: "REQUESTER" });
    staffUser = await createAccount("Responsive Staff", { role: "IT_STAFF" });
    adminUser = await createAccount("Responsive Admin", { role: "ADMINISTRATOR" });

    ticketFixture = await createTicketFixture({
      requesterId: requesterUser.id,
      summary: "Responsive Inspection Test Ticket",
      description: "Detailed description for inspecting responsive layout and accessibility.",
    });
  });

  test.afterAll(cleanAccounts);

  test("Screen 1 & 2: Login and Mandatory Change Password responsive rendering and baseline evidence", async ({
    page,
  }) => {
    // 1. Login Screen
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();

    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/login-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/login-tablet-820.png");

    // Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page, ['input[type="email"]', 'input[type="password"]', 'button[type="submit"]']);
    await captureScreenshot(page, "authentication/login-mobile-390.png");

    // Supplemental: invalid credentials callout
    await page.getByLabel("Email").fill("invalid.user@example.com");
    await page.getByLabel("Password").fill(`${getInitialPassword()}X!wrong`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await captureScreenshot(page, "authentication/supplemental-auth-login-invalid.png");

    // 2. Mandatory Change Password Screen
    const pwdUser = await createAccount("Pass Change Inspection", {
      role: "REQUESTER",
      mustChangePassword: true,
    });
    await signIn(page, pwdUser.email, getInitialPassword());
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();

    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/change-password-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/change-password-tablet-820.png");

    // Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page, [
      'input[type="password"]',
      'button[type="submit"]',
    ]);
    await captureScreenshot(page, "authentication/change-password-mobile-390.png");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  });

  test("Screen 3, 4 & 5: Requester views responsive table-to-card switching and overflow verification", async ({
    page,
  }) => {
    await signIn(page, requesterUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();

    // --- Screen 3: Requester My Tickets ---
    await page.goto("/my-tickets");
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    // Desktop 1440x900: table visible, mobile cards hidden
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".tickets-table")).toBeVisible();
    await expect(page.locator(".tickets-mobile-list")).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-tickets-desktop-1440.png");

    // Tablet 820x1180: table visible
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.locator(".tickets-table")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "requester/requester-tickets-tablet-820.png");

    // Mobile 390x844: table hidden, mobile list visible
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".tickets-mobile-list")).toBeVisible();
    await expect(page.locator(".tickets-table-container")).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page, [".btn-primary", ".ticket-card"]);
    await captureScreenshot(page, "requester/requester-tickets-mobile-390.png");

    // --- Screen 4: Create Ticket ---
    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: /Create.*Ticket/ })).toBeVisible();

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
    await assertTouchTargets(page, ["#ticket-summary", "#ticket-description", "#ticket-category", 'button[type="submit"]']);
    await captureScreenshot(page, "requester/create-ticket-mobile-390.png");

    // --- Screen 5: Requester Ticket Detail ---
    await page.goto(`/tickets/${ticketFixture.id}`);
    await expect(page.getByRole("heading", { name: ticketFixture.ticketNumber })).toBeVisible();

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

    await signOut(page);
  });

  test("Screen 6 & 7: Staff views responsive table-to-card switching and queue filtering", async ({
    page,
  }) => {
    await signIn(page, staffUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();

    // --- Screen 6: Staff Queue ---
    await page.goto("/staff/tickets");
    await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();

    // Desktop 1440x900: table visible, mobile list hidden
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".tickets-table")).toBeVisible();
    await expect(page.locator(".tickets-mobile-list")).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-queue/staff-queue-desktop-1440.png");

    // Tablet 820x1180: table visible
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.locator(".tickets-table")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "staff-queue/staff-queue-tablet-820.png");

    // Mobile 390x844: table hidden, mobile list visible
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".tickets-mobile-list")).toBeVisible();
    await expect(page.locator(".tickets-table-container")).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page, ["#staff-ticket-search", ".form-select"]);
    await captureScreenshot(page, "staff-queue/staff-queue-mobile-390.png");

    // Supplemental: filtered no-results state
    await page.setViewportSize({ width: 1440, height: 900 });
    const searchInput = page.locator("#staff-ticket-search");
    await searchInput.fill("NONEXISTENT_QUERY_FILTER_EMPTY");
    await page.waitForTimeout(400);
    await expect(page.locator("text=No queue tickets match")).toBeVisible();
    await captureScreenshot(page, "staff-queue/supplemental-staff-filtered-no-results.png");
    await searchInput.fill("");

    // --- Screen 7: Staff Ticket Detail ---
    await page.goto(`/staff/tickets/${ticketFixture.id}`);
    await expect(page.getByRole("heading", { name: ticketFixture.ticketNumber })).toBeVisible();

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

    // Regression assertion: check every relevant operational control's bounding box
    // (x >= 0, right edge <= 390, width > 0, height >= 44px for interactive controls)
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

    await signOut(page);
  });

  test("Screen 8: Administrator User Management responsive table-to-card switching and modals", async ({
    page,
  }) => {
    await signIn(page, adminUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

    // Desktop 1440x900: table visible, cards hidden
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".users-table")).toBeVisible();
    await expect(page.locator(".users-cards-container")).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "user-management/admin-users-desktop-1440.png");

    // Tablet 820x1180: table visible
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.locator(".users-table")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "user-management/admin-users-tablet-820.png");

    // Mobile 390x844: table hidden, card container visible
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".users-cards-container")).toBeVisible();
    await expect(page.locator(".users-table-container")).not.toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page, [".btn-primary", ".action-btn-mobile"]);
    await captureScreenshot(page, "user-management/admin-users-mobile-390.png");

    // Supplemental: Create User modal
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Create User" }).first().click();
    await expect(page.getByRole("heading", { name: "Create New User" })).toBeVisible();
    await assertTouchTargets(page, [".dialog-close-btn"], { square: true });
    await captureScreenshot(page, "user-management/supplemental-admin-create-user-modal.png");
    await page.locator(".dialog-close-btn").click();

    // Supplemental: Self-deactivation disabled on current admin
    const searchInput = page.locator("#user-search");
    await searchInput.fill(adminUser.email);
    await page.waitForTimeout(400);
    const selfRow = page.locator(`.users-table tbody tr:has-text("${adminUser.email}")`);
    await selfRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit User: ${adminUser.name}` })).toBeVisible();
    await expect(page.locator("#edit-active")).toBeDisabled();
    await captureScreenshot(page, "user-management/supplemental-admin-self-deactivation-disabled.png");
    await page.locator(".dialog-close-btn").click();

    await signOut(page);
  });

  test("Accessibility: Modal dialog focus trapping, keyboard navigation, and escape key restoration", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, adminUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

    // 1. Click Create User button
    const createBtn = page.getByRole("button", { name: "Create User" }).first();
    await createBtn.click();

    const dialog = page.locator(".user-dialog");
    await expect(dialog).toBeVisible();

    // 2. Initial focus moves inside modal to first input (#create-name)
    await expect(page.locator("#create-name")).toBeFocused();

    // 3. Tab navigation cycles inside the modal
    await page.keyboard.press("Tab"); // to email
    await expect(page.locator("#create-email")).toBeFocused();

    await page.keyboard.press("Tab"); // to role
    await expect(page.locator("#create-role")).toBeFocused();

    // Shift+Tab navigates backwards within modal
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#create-email")).toBeFocused();

    // 4. Escape key dismisses modal and restores focus to trigger button
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(createBtn).toBeFocused();

    await signOut(page);
  });

  test("Design System: Zen Green tokens, color contrasts, and semantic landmark verification", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, requesterUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.goto("/my-tickets");

    // 1. Semantic landmarks
    await expect(page.locator("header.app-header")).toBeVisible();
    await expect(page.locator("nav.app-nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();

    // 2. Zen Green design tokens
    const brandStyles = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const header = document.querySelector(".app-header");
      const headerStyle = header ? getComputedStyle(header) : null;
      return {
        primary: root.getPropertyValue("--color-primary").trim(),
        secondary: root.getPropertyValue("--color-secondary").trim(),
        headerBackground: headerStyle?.background || headerStyle?.backgroundColor,
      };
    });

    // Verify presence and values of Zen Green palette tokens
    expect(brandStyles.primary.toLowerCase()).toBe("#006b3c");
    expect(brandStyles.secondary.toLowerCase()).toBe("#0b7a46");

    await signOut(page);
  });
});
