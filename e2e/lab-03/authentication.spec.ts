import { test, expect } from "@playwright/test";
import {
  createAccount,
  cleanAccounts,
  signOut,
  signIn,
  apiOrigin,
  getInitialPassword,
  getChangedPassword,
  captureScreenshot,
  assertNoHorizontalOverflow,
} from "./helpers.js";

test.afterAll(cleanAccounts);

test.describe("E2E-01: Authentication Workflows & Session Management", () => {
  test("login page responsive rendering and baseline screenshots", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();

    // 1. Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/login-desktop-1440.png");

    // 2. Tablet 820x1180
    await page.setViewportSize({ width: 820, height: 1180 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/login-tablet-820.png");

    // 3. Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await captureScreenshot(page, "authentication/login-mobile-390.png");
  });

  test("first-login mandatory password change enforces 403 API block, updates password, and restores full access", async ({
    page,
    context,
  }) => {
    const initialPass = getInitialPassword();
    const newPass = getChangedPassword();
    const user = await createAccount("Mandatory Password Requester", {
      role: "REQUESTER",
      mustChangePassword: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, user.email, initialPass);

    // Mandatory change password page displayed
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();

    // While mustChangePassword is true, calling protected APIs returns 403
    const protectedRes = await page.request.get(`${apiOrigin}/api/categories`);
    expect(protectedRes.status()).toBe(403);

    // Capture supplemental screenshot
    await captureScreenshot(page, "authentication/supplemental-auth-mandatory-password.png");

    // Submit password change form
    await page.getByLabel("Current password", { exact: true }).fill(initialPass);
    await page.getByLabel("New password", { exact: true }).fill(newPass);
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPass);
    await page.getByRole("button", { name: "Save new password" }).click();

    // Redirection to permitted home (Requester lands on /my-tickets)
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    // Now protected API call succeeds
    const allowedRes = await page.request.get(`${apiOrigin}/api/categories`);
    expect(allowedRes.status()).toBe(200);

    // Verify session cookie attributes (HttpOnly, SameSite=Lax, not visible to JS)
    const cookies = await context.cookies(apiOrigin);
    const sessionCookie = cookies.find((c) => c.name === "toktickit_session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("toktickit_session");

    // Verify session persistence across full page reload
    await page.reload();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    // Test Account Menu keyboard navigation and Escape dismissal
    const accountMenu = page.getByRole("button", { name: "Account menu" });
    await accountMenu.click();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountMenu).toBeFocused();

    // Sign out
    await signOut(page);
    await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();

    // After sign out, protected API returns 401
    const postLogoutRes = await page.request.get(`${apiOrigin}/api/categories`);
    expect(postLogoutRes.status()).toBe(401);
  });

  test("invalid and inactive credentials show safe feedback without exposing protected shell", async ({
    page,
  }) => {
    const inactiveUser = await createAccount("Inactive Requester", { isActive: false });

    // Invalid password
    await signIn(page, inactiveUser.email, `${getInitialPassword()}X!wrong`);
    await expect(page.getByRole("alert")).toContainText("Invalid email or password");
    await expect(page.getByRole("navigation")).toHaveCount(0);

    // Inactive account
    await signIn(page, inactiveUser.email, getInitialPassword());
    await expect(page.getByRole("alert")).toContainText("inactive");
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("role-based shells render role badges and restrict unauthorized actions and routes", async ({
    page,
  }) => {
    // 1. Requester
    const requester = await createAccount("Role Test Requester", { role: "REQUESTER" });
    await signIn(page, requester.email);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByLabel("Main Navigation").getByRole("button", { name: /Create Ticket/ })).toBeVisible();

    // Requester attempting to access /staff/tickets directly sees 403 ForbiddenView
    await page.goto("/staff/tickets");
    await expect(page.getByTestId("route-forbidden")).toBeVisible();
    await expect(page.getByTestId("route-forbidden")).toContainText("permission");

    // Requester attempting to access /admin/users directly sees 403 ForbiddenView
    await page.goto("/admin/users");
    await expect(page.getByTestId("route-forbidden")).toBeVisible();
    await signOut(page);

    // 2. IT Staff
    const staff = await createAccount("Role Test IT Staff", { role: "IT_STAFF" });
    await signIn(page, staff.email);
    await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
    // Prohibited from seeing Create Ticket button
    await expect(page.getByRole("button", { name: "Create Ticket" })).toHaveCount(0);
    // IT Staff cannot access /admin/users
    await page.goto("/admin/users");
    await expect(page.getByTestId("route-forbidden")).toBeVisible();
    await signOut(page);

    // 3. Administrator
    const admin = await createAccount("Role Test Administrator", { role: "ADMINISTRATOR" });
    await signIn(page, admin.email);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    // Prohibited from seeing Create Ticket button
    await expect(page.getByRole("button", { name: "Create Ticket" })).toHaveCount(0);
    // Admin CAN access staff queue
    await page.goto("/staff/tickets");
    await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
    await signOut(page);
  });
});
