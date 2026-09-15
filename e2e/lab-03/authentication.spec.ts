import { test, expect } from "@playwright/test";
import { createAccount, cleanAccounts, signOut, initialPassword, changedPassword, signIn, apiOrigin } from "./helpers.js";

test.afterAll(cleanAccounts);
test("login, first-password restriction, reload and logout use real cookies", async ({ page, context }, testInfo) => {
  const user = await createAccount("First login requester", { mustChangePassword: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true });
  }
  await signIn(page, user.email);
  await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
  expect((await page.request.get(`${apiOrigin}/api/categories`)).status()).toBe(403);
  await page.screenshot({ path: testInfo.outputPath("mandatory-password-375.png"), fullPage: true });
  await page.getByLabel("Current password", { exact: true }).fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill(changedPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(changedPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  const cookies = await context.cookies(apiOrigin);
  expect(cookies.find(c => c.name === "toktickit_session")).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("toktickit_session");
  await page.reload(); await expect(page.getByRole("navigation")).toBeVisible();
  const accountMenu = page.getByRole("button", { name: "Account menu" });
  await accountMenu.click(); await page.getByRole("button", { name: "Change password", exact: true }).focus();
  await page.keyboard.press("Escape"); await expect(accountMenu).toBeFocused();
  await signOut(page);
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  expect((await page.request.get(`${apiOrigin}/api/categories`)).status()).toBe(401);
});
test("invalid and inactive credentials show safe feedback without a protected shell", async ({ page }) => {
  const user = await createAccount("Inactive requester", { isActive: false });
  await signIn(page, user.email, "wrong-password");
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
  await signIn(page, user.email);
  await expect(page.getByRole("alert")).toContainText("inactive");
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("staff and administrator shells show current role without requester actions", async ({ page }) => {
  for (const role of ["IT_STAFF", "ADMINISTRATOR"] as const) {
    const user = await createAccount(`E2E ${role}`, { role }); await signIn(page, user.email);
    await expect(page.getByRole("navigation")).toContainText(role);
    await expect(page.getByRole("button", { name: /Create Ticket/ })).toHaveCount(0);
    await signOut(page);
    await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  }
});
