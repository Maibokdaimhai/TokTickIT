import { afterEach, describe, expect, it, vi } from "vitest";
import { createAction, fetchActions, completeActionFollowUp } from "../../src/actions-api.js";

afterEach(() => vi.unstubAllGlobals());
describe("Actions Taken HTTP adapter", () => {
  it("uses credentialed, abortable reads and bounded pagination", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ actions: [], pagination: { page: 2, limit: 10, totalItems: 0, totalPages: 0 }, ticketVersion: 3 })));
    vi.stubGlobal("fetch", request); const controller = new AbortController();
    await fetchActions(7, 2, controller.signal);
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/api/tickets/7/actions?page=2&limit=10'), expect.objectContaining({ credentials: 'include', signal: controller.signal }));
  });
  it("preserves version/retry payloads without adding caller identity or server timestamps", async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ action: { id: 1 }, ticketVersion: 1 }))));
    vi.stubGlobal('fetch', request);
    const body = { actionAt: '2026-01-02T02:00:00Z', description: 'Inspect', assigneeId: 8, status: 'PLANNED' as const, result: null, followUpRequired: false, followUpNote: null, attachmentNotes: null, expectedTicketVersion: 0, clientRequestId: 'fbfe8033-9b10-4b0c-a7a9-45ac46dba970' };
    await createAction(7, body); await completeActionFollowUp(7, 1, { completionNote: 'Confirmed', expectedActionVersion: 1, expectedTicketVersion: 2 });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(body);
    expect(request.mock.calls[1][0]).toContain('/staff/tickets/7/actions/1/follow-up-completion');
    expect(request.mock.calls[1][1].credentials).toBe('include');
  });
  it("signals session expiry and retains safe error status/code for reconciliation", async () => {
    const listener = vi.fn(); window.addEventListener('auth:expired', listener);
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Please sign in' } }), { status: 401 }));
    vi.stubGlobal('fetch', request);
    try { await expect(fetchActions(7)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' }); expect(listener).toHaveBeenCalledTimes(1); }
    finally { window.removeEventListener('auth:expired', listener); }
  });
});
