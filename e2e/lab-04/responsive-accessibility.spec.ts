import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { createAccount, createTicketFixture, cleanAccounts, signIn, signOut, database } from '../lab-03/helpers.js';
import { inspectRenderedPage } from './render-audit.js';
import { randomUUID } from 'node:crypto';

test.afterAll(cleanAccounts);
const viewports = [{ width: 320, height: 900 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }];
async function capture(page: Page, name: string) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const pane of await page.locator('.tickets-table-container,.users-table-container').all()) {
      if (!await pane.isVisible() || !await pane.evaluate(el => el.scrollWidth > el.clientWidth)) continue;
      await pane.focus(); await expect(pane).toBeFocused(); await page.keyboard.press('ArrowRight');
      await expect.poll(() => pane.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      await pane.evaluate(el => { el.scrollLeft = 0; });
    }
    await inspectRenderedPage(page, `${name}-${viewport.width}`);
    const folder = 'artifacts/lab-04/screenshots/regression/accessibility'; await fs.mkdir(folder, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${folder}/${name}-${viewport.width}.png`, fullPage: name !== 'user-management' });
    if (viewport.width === 390) {
      if (name === 'action-editor') await page.getByRole('form', { name: 'New Action', exact: true }).screenshot({ path: `${folder}/action-editor-focused-390.png` });
      if (name === 'staff-detail') for (const section of ['staff-public-comments-section','staff-internal-notes-section']) await page.getByTestId(section).screenshot({ path: `${folder}/${section}-390.png` });
      if (name === 'create-user-dialog') await page.locator('.user-dialog').screenshot({ path: `${folder}/create-user-dialog-focused-390.png` });
    }
  }
}
async function zoom(page: Page, name: string) {
  // Headless zoom-equivalent reflow: half the CSS viewport at 2x device scale,
  // preserving the current modal/editor DOM and the same 1440x900 physical area.
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false });
  try {
    expect(await page.evaluate(() => innerWidth)).toBe(720);
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
    await inspectRenderedPage(page, name+'-zoom-equivalent-200');
  } finally { await session.send('Emulation.clearDeviceMetricsOverride'); await session.detach(); await page.setViewportSize({ width: 1440, height: 900 }); }
}

test('Requester login, create/list/detail, dashboard and public history render across four widths with labels/contrast/targets and 200% zoom', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const requester = await createAccount('Accessible Requester '+ 'Requester'.repeat(7));
  const ticket = await createTicketFixture({ requesterId: requester.id, summary: 'E2E long Requester content '+ 'network'.repeat(12), description: 'Connection diagnostics and recovery history. '.repeat(40) });
  const staff = await createAccount('Accessible Contributor '+ 'Contributor'.repeat(5), { role: 'IT_STAFF' });
  const action = await database().actionTaken.create({ data: { ticketId: ticket.id, performedById: staff.id, assigneeId: staff.id, actionAt: new Date(), description: 'Diagnostic description '.repeat(45), status: 'COMPLETED', result: 'Verified recovery '.repeat(40), followUpRequired: false, attachmentNotes: 'Public attachment references '.repeat(20), clientRequestId: randomUUID(), canonicalRequest: '{}' } });
  await database().actionTakenRevision.create({ data: { actionId: action.id, editorId: staff.id, version: 0, snapshot: { actionAt: action.actionAt.toISOString(), description: action.description, result: action.result, performedById: staff.id, assigneeId: staff.id, status: 'COMPLETED', followUpRequired: false, followUpNote: null, attachmentNotes: action.attachmentNotes, followUpCompletedAt: null, followUpCompletedById: null, followUpCompletionNote: null } } });
  await page.goto('/login'); await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT' })).toBeVisible(); await capture(page, 'login'); await zoom(page, 'login');
  await signIn(page, requester.email); await expect(page.getByRole('link', { name: 'Active Tickets 1', exact: true })).toBeVisible(); await capture(page, 'requester-dashboard'); await zoom(page, 'requester-dashboard');
  await page.goto('/my-tickets'); await expect(page.getByTestId(`ticket-row-${ticket.id}`)).toBeVisible(); await capture(page, 'my-tickets'); await zoom(page, 'my-tickets');
  await page.goto('/tickets/new'); await expect(page.locator('#ticket-summary')).toBeVisible(); await capture(page, 'create-ticket'); await zoom(page, 'create-ticket');
  await page.goto(`/tickets/${ticket.id}`); await expect(page.getByRole('article', { name: `Action #${action.id}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `View History for Action #${action.id}`, exact: true }).click(); await expect(page.getByText('Revision 0', { exact: true })).toBeVisible();
  await capture(page, 'requester-detail-history'); await zoom(page, 'requester-detail-history');
  expect(errors).toEqual([]);
});
test('Staff queue, dashboard, active Actions, editor and communication retain bounds/focus/contrast at all widths and 200% zoom', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const staff = await createAccount('Accessible Staff '+ 'Specialist'.repeat(6), { role: 'IT_STAFF' }), requester = await createAccount('Staff Layout Requester');
  const ticket = await createTicketFixture({ requesterId: requester.id, ownerId: staff.id, status: 'OPEN' });
  await database().actionTaken.create({ data: { ticketId: ticket.id, performedById: staff.id, assigneeId: staff.id, actionAt: new Date(), description: 'Accessible assigned work '.repeat(20), status: 'PLANNED', followUpRequired: true, followUpNote: 'Check recovery with Requester', clientRequestId: randomUUID(), canonicalRequest: '{}' } });
  await signIn(page, staff.email); await expect(page.getByRole('heading', { name: 'Staff Dashboard' })).toBeVisible(); await expect(page.getByRole('link', { name: 'My Active Actions 1', exact: true })).toBeVisible(); await capture(page, 'staff-dashboard'); await zoom(page, 'staff-dashboard');
  await page.goto('/staff/actions?assignee=me&statusGroup=active'); await expect(page.getByText('1 active Actions assigned to you on active Tickets.')).toBeVisible(); await capture(page, 'my-active-actions'); await zoom(page, 'my-active-actions');
  await page.goto('/staff/tickets'); await expect(page.getByRole('button', { name: `Open ticket ${ticket.ticketNumber}`, exact: true }).first()).toBeVisible(); await capture(page, 'staff-queue'); await zoom(page, 'staff-queue');
  await page.goto(`/staff/tickets/${ticket.id}`); await expect(page.getByTestId('staff-ticket-number-heading')).toBeVisible(); await capture(page, 'staff-detail'); await zoom(page, 'staff-detail');
  await page.getByRole('button', { name: 'New Action', exact: true }).click(); await expect(page.getByLabel('Assigned to', { exact: true })).toBeEnabled();
  await page.getByLabel('Action Description', { exact: true }).fill('Long draft '.repeat(30)); await page.getByLabel('Follow-Up Required?', { exact: true }).check(); await page.getByLabel('Follow-up Note', { exact: true }).fill('Follow-up details '.repeat(30));
  await capture(page, 'action-editor'); await zoom(page, 'action-editor');
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Discard Draft', exact: true }).click();
  await page.getByLabel('Next Status', { exact: true }).selectOption('RESOLVED'); await page.getByTestId('btn-save-status').click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Confirm Status Change' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByTestId('btn-save-status')).toBeFocused();
  expect(errors).toEqual([]);
});
test('Administrator management and modal keyboard access at four widths plus mandatory password screen', async ({ page }) => {
  const admin = await createAccount('Accessible Admin', { role: 'ADMINISTRATOR' });
  await signIn(page, admin.email); await expect(page.getByRole('navigation')).toBeVisible(); await page.goto('/admin/users'); await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible(); await capture(page, 'user-management'); await zoom(page, 'user-management');
  const trigger = page.getByRole('button', { name: 'Create User', exact: true }).first(); await trigger.click(); await expect(page.locator('#create-name')).toBeFocused(); await capture(page, 'create-user-dialog'); await zoom(page, 'create-user-dialog');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused();
  await signOut(page); const restricted = await createAccount('Accessible First Login', { mustChangePassword: true }); await signIn(page, restricted.email);
  await expect(page.getByRole('heading', { name: 'Change password', exact: true })).toBeVisible(); await capture(page, 'change-password'); await zoom(page, 'change-password');
});
