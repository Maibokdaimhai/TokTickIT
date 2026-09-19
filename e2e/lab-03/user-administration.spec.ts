import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createAccount,
  createTicketFixture,
  cleanAccounts,
  signOut,
  signIn,
  origin,
  apiOrigin,
  database,
  getInitialPassword,
  getChangedPassword,
  captureScreenshot,
  assertNoHorizontalOverflow,
} from "./helpers.js";

test.describe.serial("E2E-03: Administrator User Management Workflow", () => {
  let adminUser: Awaited<ReturnType<typeof createAccount>>;
  let managedUser: Awaited<ReturnType<typeof createAccount>>;

  test.beforeAll(async () => {
    adminUser = await createAccount("Primary Admin", { role: "ADMINISTRATOR" });
    managedUser = await createAccount("Target Managed Requester", { role: "REQUESTER" });
  });

  test.afterAll(cleanAccounts);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, adminUser.email);
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  });

  test("user list inspection, responsive tables/cards, search, and filtering", async ({
    page,
  }) => {
    // 1. Capture baseline screenshots for User Administration at 3 viewports
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".users-table")).toBeVisible({ timeout: 10000 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "user-management/admin-users-desktop-1440.png");

    // Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "user-management/admin-users-tablet-820.png");

    // Mobile 390x844: table hidden, card container visible
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".users-cards-container")).toBeVisible();
    await expect(page.locator(".user-card").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "user-management/admin-users-mobile-390.png");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Search filtering
    const searchInput = page.locator("#user-search");
    await searchInput.fill(managedUser.email);
    await page.waitForTimeout(400);

    const matchingRow = page.locator(`.users-table tbody tr:has-text("${managedUser.email}")`);
    await expect(matchingRow).toBeVisible();
    await expect(matchingRow).toContainText(managedUser.name);

    // 3. Role and Status filtering
    await searchInput.fill("");
    const roleSelect = page.locator("#role-filter");
    await roleSelect.selectOption("ADMINISTRATOR");
    await page.waitForTimeout(400);

    const adminRows = page.locator(".users-table tbody tr");
    await expect(adminRows.first()).toContainText("Administrator");

    // Reset filters
    await roleSelect.selectOption("");
  });

  test("create user workflow with password-policy boundaries and duplicate email handling", async ({
    page,
  }) => {
    const addUserBtn = page.getByRole("button", { name: "Create User" }).first();
    await addUserBtn.click();
    await expect(page.getByRole("heading", { name: "Create New User" })).toBeVisible();

    // --- Password-policy validation boundaries ---
    // 1. Fewer than 10 Unicode code points:
    await page.fill("#create-name", "Short Pass User");
    await page.fill("#create-email", `boundary-${randomUUID()}@e2e.example`);
    await page.fill("#create-password", "Short1!");
    // Length rule should be unmet
    await expect(page.locator(".password-checklist li.rule-unmet").filter({ hasText: "10" })).toBeVisible();
    await page.locator('.user-dialog button[type="submit"]:has-text("Create User")').click();
    await expect(page.locator(".form-error-msg")).toContainText("complexity");

    // 2. Whitespace is not a symbol:
    await page.fill("#create-password", "ValidPass1  ");
    await expect(page.locator(".password-checklist li.rule-unmet").filter({ hasText: "symbol" })).toBeVisible();
    await page.locator('.user-dialog button[type="submit"]:has-text("Create User")').click();
    await expect(page.locator(".form-error-msg")).toContainText("complexity");

    // 3. More than 72 UTF-8 bytes:
    // Thai characters are 3 bytes each; 25 chars = 75 bytes
    const seventyThreeBytes = "ก".repeat(25) + "A1!";
    await page.fill("#create-password", seventyThreeBytes);
    await expect(page.locator(".password-checklist li.rule-unmet").filter({ hasText: "72" })).toBeVisible();
    await page.locator('.user-dialog button[type="submit"]:has-text("Create User")').click();
    await expect(page.locator(".form-error-msg")).toContainText("complexity");

    // 4. Successful creation with valid runtime password
    const uniqueEmail = `test-user-${randomUUID()}@e2e.example`;
    const runtimePass = getInitialPassword();

    await page.fill("#create-name", "Newly Created E2E User");
    await page.fill("#create-email", uniqueEmail);
    await page.selectOption("#create-role", "IT_STAFF");
    await page.fill("#create-password", runtimePass);

    await page.locator('.user-dialog button[type="submit"]:has-text("Create User")').click();

    // Modal closes on success
    await expect(page.getByRole("heading", { name: "Create New User" })).not.toBeVisible({
      timeout: 10000,
    });

    // Verify user appears in table
    const searchInput = page.locator("#user-search");
    await searchInput.fill(uniqueEmail);
    await page.waitForTimeout(400);
    const newRow = page.locator(`.users-table tbody tr:has-text("${uniqueEmail}")`);
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText("IT Staff");

    // 5. Duplicate email handling (409 conflict, password wiped, other fields preserved)
    await page.getByRole("button", { name: "Create User" }).first().click();
    await expect(page.getByRole("heading", { name: "Create New User" })).toBeVisible();

    await page.fill("#create-name", "Duplicate User Attempt");
    await page.fill("#create-email", uniqueEmail);
    await page.selectOption("#create-role", "IT_STAFF");
    await page.fill("#create-password", runtimePass);

    const createPromise = page.waitForResponse(
      (res) => res.url().includes("/api/admin/users") && res.request().method() === "POST"
    );
    await page.locator('.user-dialog button[type="submit"]:has-text("Create User")').click();
    const createRes = await createPromise;
    expect(createRes.status()).toBe(409);

    // Error banner appears with conflict message
    const errorBanner = page.locator(".dialog-error-banner");
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/already in use/i);

    // Password field cleared while other fields are preserved
    expect(await page.locator("#create-password").inputValue()).toBe("");
    expect(await page.locator("#create-name").inputValue()).toBe("Duplicate User Attempt");
    expect(await page.locator("#create-email").inputValue()).toBe(uniqueEmail);

    // Password absent from DOM and error text
    const dialogContent = await page.locator(".user-dialog").textContent();
    expect(dialogContent).not.toContain(runtimePass);

    // Close modal
    await page.locator(".dialog-close-btn").click();
  });

  test("edit user attributes, reset initial password with failure handling, and self-deactivation guard", async ({
    page,
  }) => {
    // 1. Edit managedUser
    const searchInput = page.locator("#user-search");
    await searchInput.fill(managedUser.email);
    await page.waitForTimeout(400);

    const userRow = page.locator(`.users-table tbody tr:has-text("${managedUser.email}")`);
    await userRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: `Edit User: ${managedUser.name}` })).toBeVisible();
    const newName = "Updated Name For Requester";
    await page.fill("#edit-name", newName);
    await page.selectOption("#edit-role", "IT_STAFF");
    await page.locator('.user-dialog button[type="submit"]:has-text("Save Changes")').click();

    await expect(page.getByRole("heading", { name: /Edit User/ })).not.toBeVisible({ timeout: 10000 });
    await expect(userRow).toContainText(newName);
    await expect(userRow).toContainText("IT Staff");

    // 2. Reset Initial Password API Failure handling
    await userRow.getByRole("button", { name: "Reset Password" }).click();
    const resetModalHeading = page.getByRole("heading", { name: "Reset Initial Password" });
    await expect(resetModalHeading).toBeVisible();

    const resetPass = getChangedPassword();

    // Intercept route to simulate API failure
    await page.route("**/api/admin/users/*/initial-password", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Simulated password reset backend failure" } }),
      })
    );

    await page.fill("#reset-password", resetPass);
    await page.fill("#reset-confirm", resetPass);
    await page.locator('.user-dialog button[type="submit"]:has-text("Reset Password")').click();

    // Verify error feedback
    const resetErrorBanner = page.locator(".dialog-error-banner");
    await expect(resetErrorBanner).toBeVisible();
    await expect(resetErrorBanner).toContainText("Simulated password reset backend failure");

    // Both password fields cleared
    expect(await page.locator("#reset-password").inputValue()).toBe("");
    expect(await page.locator("#reset-confirm").inputValue()).toBe("");

    // Password absent from DOM and error text
    const resetDialogText = await page.locator(".user-dialog").textContent();
    expect(resetDialogText).not.toContain(resetPass);

    // Unroute and perform successful reset
    await page.unroute("**/api/admin/users/*/initial-password");

    await page.fill("#reset-password", resetPass);
    await page.fill("#reset-confirm", resetPass);
    await captureScreenshot(page, "user-management/supplemental-admin-reset-password-modal.png");

    await page.locator('.user-dialog button[type="submit"]:has-text("Reset Password")').click();
    await expect(resetModalHeading).not.toBeVisible({ timeout: 10000 });
    await expect(userRow).toContainText("Must change password");

    // 3. Self-deactivation disabled on current admin user
    await searchInput.fill(adminUser.email);
    await page.waitForTimeout(400);
    const selfRow = page.locator(`.users-table tbody tr:has-text("${adminUser.email}")`);
    await selfRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: `Edit User: ${adminUser.name}` })).toBeVisible();
    const activeCheckbox = page.locator("#edit-active");
    await expect(activeCheckbox).toBeDisabled();
    await expect(page.locator("text=You cannot deactivate your own account")).toBeVisible();

    await page.locator(".dialog-close-btn").click();
  });

  test("deterministic last-active-admin protection with try/finally restoration", async ({
    page,
  }) => {
    // 1. Create a dedicated temporary administrator and sign in
    const tempAdmin = await createAccount("Temporary Lone Admin", { role: "ADMINISTRATOR" });
    await signOut(page);
    await signIn(page, tempAdmin.email);
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

    const db = database();
    const seededAdminEmail = "morgan.davis@example.com";

    try {
      // 2. Temporarily deactivate all other administrators in the DB
      await db.user.updateMany({
        where: { email: { in: [seededAdminEmail, adminUser.email] } },
        data: { isActive: false },
      });

      // Reload admin users list so UI sees other administrators are now inactive
      await page.reload();
      await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

      // 3. Temporary admin attempts to demote oneself to IT_STAFF (sole remaining active admin)
      const searchInput = page.locator("#user-search");
      await searchInput.fill(tempAdmin.email);
      await page.waitForTimeout(400);

      const tempRow = page.locator(`.users-table tbody tr:has-text("${tempAdmin.email}")`);
      await tempRow.getByRole("button", { name: "Edit" }).click();
      await expect(page.getByRole("heading", { name: `Edit User: ${tempAdmin.name}` })).toBeVisible();

      await page.selectOption("#edit-role", "IT_STAFF");

      // Capture actual PATCH response
      const patchPromise = page.waitForResponse(
        (res) => res.url().includes("/api/admin/users/") && res.request().method() === "PATCH"
      );
      await page.locator('.user-dialog button[type="submit"]:has-text("Save Changes")').click();
      const patchRes = await patchPromise;

      // Assert HTTP 409 and exact LAST_ACTIVE_ADMIN error code
      expect(patchRes.status()).toBe(409);
      const resJson = await patchRes.json();
      expect(resJson.error.code).toBe("LAST_ACTIVE_ADMIN");

      // Assert error banner is displayed
      const errorBanner = page.locator(".dialog-error-banner");
      await expect(errorBanner).toBeVisible({ timeout: 10000 });
      await expect(errorBanner).toContainText(/administrator/i);

      // Close modal
      await page.locator(".dialog-close-btn").click();
    } finally {
      // 4. Guaranteed restoration of all administrators even if test assertions fail
      await db.user.updateMany({
        where: { email: { in: [seededAdminEmail, adminUser.email] } },
        data: { isActive: true },
      });
      const restored = await db.user.findUnique({ where: { email: seededAdminEmail } });
      expect(restored?.isActive).toBe(true);
    }
  });

  test("ticket unassignment upon staff deactivation or demotion", async ({ page }) => {
    const db = database();
    // 1. Create a temporary staff user and assign a ticket to them
    const staffOwner = await createAccount("Assigned Staff User", { role: "IT_STAFF" });
    const assignedTicket = await createTicketFixture({
      requesterId: managedUser.id,
      ownerId: staffOwner.id,
      summary: "[E2E] Ticket for staff unassignment verification",
      status: "IN_PROGRESS",
    });

    expect(assignedTicket.ownerId).toBe(staffOwner.id);
    const initialVersion = assignedTicket.version;

    // 2. Administrator deactivates the staff member in the UI
    const searchInput = page.locator("#user-search");
    await searchInput.fill(staffOwner.email);
    await page.waitForTimeout(400);

    const staffRow = page.locator(`.users-table tbody tr:has-text("${staffOwner.email}")`);
    await staffRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit User: ${staffOwner.name}` })).toBeVisible();

    await page.uncheck("#edit-active");
    await page.locator('.user-dialog button[type="submit"]:has-text("Save Changes")').click();
    await expect(page.getByRole("heading", { name: /Edit User/ })).not.toBeVisible({ timeout: 10000 });

    // 3. Verify in database: ticket ownerId is now null, version is incremented
    const updatedTicket = await db.ticket.findUnique({ where: { id: assignedTicket.id } });
    expect(updatedTicket?.ownerId).toBeNull();
    expect(updatedTicket?.version).toBe(initialVersion + 1);
  });

  test("session revocation when an administrator deactivates a user account", async ({
    page,
    browser,
  }) => {
    // 1. Create a target user and establish an active session in a secondary context
    const revokeTarget = await createAccount("Revocation Test Requester", { role: "REQUESTER" });
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    await signIn(userPage, revokeTarget.email);
    await expect(userPage.getByRole("navigation")).toBeVisible();

    // 2. Primary admin deactivates the user via Edit modal
    const searchInput = page.locator("#user-search");
    await searchInput.fill(revokeTarget.email);
    await page.waitForTimeout(400);

    const targetRow = page.locator(`.users-table tbody tr:has-text("${revokeTarget.email}")`);
    await targetRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit User: ${revokeTarget.name}` })).toBeVisible();

    await page.uncheck("#edit-active");
    await page.locator('.user-dialog button[type="submit"]:has-text("Save Changes")').click();
    await expect(page.getByRole("heading", { name: /Edit User/ })).not.toBeVisible({ timeout: 10000 });

    // 3. Secondary context makes an API request -> session is revoked, returns 401
    const testReq = await userPage.request.get(`${apiOrigin}/api/categories`);
    expect(testReq.status()).toBe(401);

    // Reloading secondary page redirects to login
    await userPage.reload();
    await expect(userPage.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();

    await userContext.close();
  });

  test("no user deletion: verify no Delete controls and safe 404 on DELETE endpoint", async ({
    page,
  }) => {
    // 1. Assert no Delete buttons exist in the UI
    await expect(page.locator("button:has-text('Delete')")).toHaveCount(0);
    await expect(page.locator("[data-testid*='delete']")).toHaveCount(0);

    // 2. Assert direct DELETE /api/admin/users/:id endpoint returns safe 404
    const deleteRes = await page.request.delete(`${apiOrigin}/api/admin/users/${managedUser.id}`, {
      headers: { Origin: origin },
    });
    expect(deleteRes.status()).toBe(404);
  });
});
