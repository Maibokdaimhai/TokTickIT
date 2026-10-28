import { test, expect, type Page } from '@playwright/test';
import { createAccount, createTicketFixture, cleanAccounts, signIn, signOut, database, origin, apiOrigin } from '../lab-03/helpers.js';

test.afterAll(cleanAccounts);
async function createWork(page: Page, assignee: number, description: string, followUp = false) {
  await page.getByRole('button', { name: 'New Action', exact: true }).click();
  await page.getByLabel('Assigned to', { exact: true }).selectOption(String(assignee));
  await page.getByLabel('Action Description', { exact: true }).fill(description);
  if (followUp) { await page.getByLabel('Follow-Up Required?', { exact: true }).check(); await page.getByLabel('Follow-up Note', { exact: true }).fill('Verify recovery with the Requester'); }
}
async function saveNew(page: Page) {
  const response = page.waitForResponse(r => r.request().method() === 'POST' && /\/staff\/tickets\/\d+\/actions$/.test(new URL(r.url()).pathname));
  await page.getByRole('button', { name: 'Save Action', exact: true }).click(); const result = await response; expect(result.status()).toBe(201);
  await expect(page.getByText('Action saved.', { exact: true })).toBeVisible(); return (await result.json()).action.id as number;
}
async function terminalAction(page: Page, id: number, status: string, result: string) {
  await page.getByRole('button', { name: `Edit Action #${id}`, exact: true }).click();
  await page.getByLabel('Result', { exact: true }).fill(result); await page.getByLabel('Action Status', { exact: true }).selectOption(status);
  await page.getByRole('button', { name: 'Save Action', exact: true }).click();
  const response = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname.endsWith(`/actions/${id}`));
  await page.getByRole('button', { name: 'Confirm Action Change', exact: true }).click(); expect((await response).status()).toBe(200);
  await expect(page.getByText('Action saved.', { exact: true })).toBeVisible();
}
test('multiple contributors, assignee/performer identity, failure recovery, cancellation and public follow-up revisions survive resolution', async ({ page, browser }) => {
  const requester = await createAccount('Multi Requester'), outsider = await createAccount('Unrelated Requester');
  const staff = await createAccount('Multi Coordinator', { role: 'IT_STAFF' }), contributor = await createAccount('Multi Contributor', { role: 'IT_STAFF' });
  const ticket = await createTicketFixture({ requesterId: requester.id, status: 'OPEN', ownerId: staff.id, summary: 'E2E multi-action accountable recovery' });
  await signIn(page, staff.email); await expect(page.getByRole('navigation')).toBeVisible(); await page.goto(`/staff/tickets/${ticket.id}`);
  await createWork(page, contributor.id, 'Investigate connection and perform recovery', true);
  // A safe server failure keeps the actual form draft and retry identity.
  let retryId: string | undefined;
  await page.route(`**/api/staff/tickets/${ticket.id}/actions`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    retryId = route.request().postDataJSON().clientRequestId;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Controlled temporary failure' } }) });
  });
  await page.getByRole('button', { name: 'Save Action', exact: true }).click(); await expect(page.getByText('Controlled temporary failure', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Action Description', { exact: true })).toHaveValue('Investigate connection and perform recovery');
  await page.unroute(`**/api/staff/tickets/${ticket.id}/actions`);
  const created = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname.endsWith(`/tickets/${ticket.id}/actions`));
  const workId = await saveNew(page); expect((await created).postDataJSON().clientRequestId).toBe(retryId);
  await createWork(page, staff.id, 'Alternative diagnostic approach'); const cancelledId = await saveNew(page);
  await terminalAction(page, cancelledId, 'CANCELLED', 'Alternative approach was unnecessary');
  const otherContext = await browser.newContext({ baseURL: origin }), otherPage = await otherContext.newPage();
  try {
    await signIn(otherPage, contributor.email); await expect(otherPage.getByRole('navigation')).toBeVisible(); await otherPage.goto(`/staff/tickets/${ticket.id}?actionId=${workId}`);
    await terminalAction(otherPage, workId, 'COMPLETED', 'Connectivity restored and tested');
    const persisted = await database().actionTaken.findUniqueOrThrow({ where: { id: workId } });
    expect(persisted.performedById).toBe(staff.id); expect(persisted.assigneeId).toBe(contributor.id); expect(persisted.followUpRequired).toBe(true);
    await page.reload(); await expect(page.getByLabel('Next Status', { exact: true })).toBeEnabled();
    await page.getByLabel('Next Status', { exact: true }).selectOption('RESOLVED'); await page.getByTestId('btn-save-status').click();
    const blocked = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname.endsWith('/status'));
    await page.getByRole('button', { name: 'Confirm Status Change', exact: true }).click(); expect((await blocked).status()).toBe(409);
    await page.getByRole('button', { name: 'Review Actions Taken', exact: true }).click();
    await page.getByRole('button', { name: `Record Follow-up Completion for Action #${workId}` }).click();
    await page.getByLabel('Completion Note', { exact: true }).fill('Requester confirmed stable connectivity');
    await page.getByRole('button', { name: 'Record Completion', exact: true }).click();
    await expect(page.getByText('Follow-up completion recorded. The original work and history are preserved.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Next Status', { exact: true })).toBeEnabled(); await page.getByLabel('Next Status', { exact: true }).selectOption('RESOLVED'); await page.getByTestId('btn-save-status').click();
    await page.getByRole('button', { name: 'Confirm Status Change', exact: true }).click(); await expect(page.getByTestId('status-badge')).toContainText('RESOLVED');
  } finally { await otherContext.close(); }
  await signOut(page); await signIn(page, requester.email); await expect(page.getByRole('navigation')).toBeVisible(); await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByRole('button', { name: 'New Action', exact: true })).toHaveCount(0);
  const card = page.getByRole('article', { name: `Action #${workId}`, exact: true });
  await expect(card).toContainText('Multi Coordinator'); await expect(card).toContainText('Multi Contributor'); await expect(card).toContainText('Requester confirmed stable connectivity');
  await page.getByRole('button', { name: `View History for Action #${workId}`, exact: true }).click();
  await expect(page.getByText('Verify recovery with the Requester', { exact: true })).toHaveCount(4); // current + create/complete/completion snapshots
  await expect(page.getByRole('article', { name: `Action #${cancelledId}`, exact: true })).toContainText('Cancelled');
  expect((await page.request.post(`${apiOrigin}/api/staff/tickets/${ticket.id}/actions`, { headers: { Origin: origin }, data: {} })).status()).toBe(403);
  await signOut(page); await signIn(page, outsider.email); await expect(page.getByRole('navigation')).toBeVisible();
  const foreign = await page.request.get(`${apiOrigin}/api/tickets/${ticket.id}/actions`), absent = await page.request.get(`${apiOrigin}/api/tickets/2147483647/actions`);
  expect(foreign.status()).toBe(404); expect(await foreign.json()).toEqual(await absent.json());
});
