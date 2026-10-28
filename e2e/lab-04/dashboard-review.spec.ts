import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// Controlled HTTP fixtures for review-specific browser behavior; no DB writes.
async function fixture(page: Page, staff: boolean) {
  const actor = { id: staff ? 7 : 1, name: staff ? 'Review Staff' : 'Review Requester', role: staff ? 'IT_STAFF' : 'REQUESTER', isActive: true, email: 'review@example.test' };
  const requester = { ...actor, id: 1, role: 'REQUESTER' };
  const ticket = { id: 77, ticketNumber: 'TKT-77', summary: 'Review Ticket context', description: 'Verify list context after a real Detail reload', requesterId: 1, requester, owner: staff ? actor : null, category: { id: 1, name: 'Network' }, relatedSystem: { id: 1, name: 'VPN' }, requestedPriority: 'HIGH', itPriority: 'URGENT', status: 'WAITING_FOR_REQUESTER', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-28T01:00:00Z', version: 0, attachments: [], publicComments: [], internalNotes: [], attachmentCount: 0, publicCommentCount: 0 };
  const dashboard = { asOf: '2026-10-28T01:00:00.000Z', windowStart: '2026-10-21T17:00:00.000Z', timeZone: 'Asia/Bangkok', metrics: staff ? { unassignedTickets: 3, myTickets: 7, myActiveActions: 0 } : { activeTickets: 22, waitingForRequester: 3, recentlyResolved: 0 }, recentTickets: [ticket], recentlyResolvedIncludesEstimates: false, byStatus: { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 7, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 }, byItPriority: { URGENT: 7, HIGH: 0, MEDIUM: 0, LOW: 0 }, myActions: [] };
  let failure = 0;
  const actions: Record<string, unknown>[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/me') return json({ user: actor, mustChangePassword: false });
    if (path.startsWith('/dashboards/')) return failure ? json({ error: { code: failure === 403 ? 'FORBIDDEN' : failure === 401 ? 'UNAUTHORIZED' : 'UNAVAILABLE', message: 'Refresh unavailable' } }, failure) : json(dashboard);
    if (path === '/categories') return json([ticket.category]);
    if (path === '/staff/eligible-owners') return json({ owners: staff ? [actor] : [] });
    if (path === '/tickets' || path === '/staff/tickets') return json({ tickets: [ticket], pagination: { page: Number(url.searchParams.get('page') ?? 1), limit: 10, totalItems: 12, totalPages: 2 } });
    if (path === '/tickets/77' || path === '/staff/tickets/77') return json(ticket);
    if (path === '/staff/tickets/77/actions' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const action = { ...body, id: 501, ticketId: 77, performedBy: actor, assignee: actor, version: 0, result: null, followUpRequired: false, followUpNote: null, attachmentNotes: null, followUpCompletedAt: null, followUpCompletedBy: null, followUpCompletionNote: null, createdAt: '2026-10-28T01:00:00Z', updatedAt: '2026-10-28T01:00:00Z' };
      actions.push(action); ticket.version++;
      return json({ action, ticketVersion: ticket.version, replayed: false }, 201);
    }
    if (path === '/tickets/77/actions') return json({ actions, ticketVersion: ticket.version, pagination: { page: 1, limit: 10, totalItems: actions.length, totalPages: actions.length ? 1 : 0 } });
    if (path === '/tickets/77/actions/501') return json({ action: actions[0], ticketVersion: ticket.version });
    if (path === '/tickets/77/status-history') return json({ events: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 }, historyStartsAt: '2026-10-27T00:00:00Z' });
    return json({ error: { code: 'NOT_FOUND', message: 'Unexpected fixture request' } }, 404);
  });
  return { fail: (status: number) => { failure = status; } };
}
for (const staff of [false, true]) {
  const role = staff ? 'staff' : 'requester';
  test(`${role} failed refresh retains stale metrics/as-of and retry recovers`, async ({ page }) => {
    const f = await fixture(page, staff); await page.goto(staff ? '/staff/dashboard' : '/dashboard');
    const card = page.getByRole('link', { name: staff ? 'My Active Tickets 7' : 'Active Tickets 22', exact: true });
    await expect(card).toBeVisible(); const asOf = await page.getByText(/^As of /).textContent();
    f.fail(503); await page.getByRole('button', { name: 'Refresh Dashboard' }).click();
    await expect(page.getByRole('alert')).toContainText('Refresh unavailable'); await expect(card).toBeVisible();
    await expect(page.getByText(/^As of /)).toHaveText(asOf!); await expect(page.getByText(/Stale data/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 1000 });
    fs.mkdirSync('artifacts/lab-04/screenshots/dashboard-review', { recursive: true });
    await page.screenshot({ path: `artifacts/lab-04/screenshots/dashboard-review/${role}-stale-390.png`, fullPage: true });
    f.fail(0); await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText(/Stale data/)).toHaveCount(0); await expect(card).toBeVisible();
    f.fail(staff ? 403 : 401); await page.getByRole('button', { name: 'Refresh Dashboard' }).click();
    await expect(card).toHaveCount(0); await expect(page.getByText(/^As of /)).toHaveCount(0);
    if (staff) await expect(page.getByRole('alert')).toContainText('Access denied');
    else await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT' })).toBeVisible();
  });
  test(`${role} Detail reload preserves list filters/page for its Back button`, async ({ page }) => {
    await fixture(page, staff);
    const query = staff ? '?owner=me&statusGroup=active&itPriority=URGENT&page=2&sort=updatedAt_desc' : '?status=WAITING_FOR_REQUESTER&priority=HIGH&page=2&sort=updatedAt_desc';
    const path = staff ? '/staff/tickets' : '/my-tickets'; await page.goto(path + query);
    if (staff) await page.getByRole('button', { name: 'Open ticket TKT-77', exact: true }).first().click();
    else await page.getByTestId('ticket-row-77').click();
    const heading = page.getByTestId(staff ? 'staff-ticket-number-heading' : 'ticket-number-heading'); await expect(heading).toHaveText('TKT-77');
    await page.reload(); await expect(heading).toHaveText('TKT-77');
    const response = page.waitForResponse(r => new URL(r.url()).pathname === (staff ? '/api/staff/tickets' : '/api/tickets'));
    await page.getByRole('button', { name: staff ? '← Back to Ticket Queue' : /Back to My Tickets/ }).click();
    const requested = new URL((await response).url()).searchParams;
    for (const [key, value] of new URLSearchParams(query)) { expect(requested.get(key)).toBe(value); expect(new URL(page.url()).searchParams.get(key)).toBe(value); }
    await expect(page.getByLabel(staff ? 'Sort queue' : 'Sort tickets')).toHaveValue('updatedAt_desc');
  });
}

test('Staff Action save keeps page-2 list context through Detail reload and Back', async ({ page }) => {
  await fixture(page, true);
  const query = '?owner=me&statusGroup=active&itPriority=URGENT&page=2&sort=updatedAt_desc';
  await page.goto('/staff/tickets' + query);
  await page.getByRole('button', { name: 'Open ticket TKT-77', exact: true }).first().click();
  await expect(page.getByTestId('staff-ticket-number-heading')).toHaveText('TKT-77');
  await page.getByRole('button', { name: 'New Action', exact: true }).click();
  await page.getByLabel('Action Description', { exact: true }).fill('Preserve list context after saving work');
  const write = page.waitForResponse(r => new URL(r.url()).pathname === '/api/staff/tickets/77/actions' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save Action', exact: true }).click(); expect((await write).status()).toBe(201);
  await expect(page.getByText('Action saved.', { exact: true })).toBeVisible(); await expect(page).toHaveURL(/actionId=501/);
  await page.reload(); await expect(page.getByRole('article', { name: 'Action #501', exact: true })).toBeVisible();
  const read = page.waitForResponse(r => new URL(r.url()).pathname === '/api/staff/tickets');
  await page.getByRole('button', { name: '← Back to Ticket Queue', exact: true }).click();
  const requested = new URL((await read).url()).searchParams;
  for (const [key, value] of new URLSearchParams(query)) { expect(requested.get(key)).toBe(value); expect(new URL(page.url()).searchParams.get(key)).toBe(value); }
  await expect(page.getByLabel('Filter by owner')).toHaveValue('me');
  await expect(page.getByLabel('Filter by IT priority')).toHaveValue('URGENT');
});
