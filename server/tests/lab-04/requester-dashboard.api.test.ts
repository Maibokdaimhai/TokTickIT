import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fixture } from "./fixture.js";

describe("Requester dashboard database oracle", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async () => { f = await fixture(); }, 30000);
  afterAll(async () => { vi.useRealTimers(); if (f) await f.close(); });
  it("scopes metrics and stable five-item previews to the session, including exact Bangkok bounds and estimates", async () => {
    const owner = await f.user("REQUESTER"), other = await f.user("REQUESTER"), agent = await f.agent(owner.id);
    const now = new Date(), local = new Date(now.getTime() + 7 * 3600000);
    const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - 6) - 7 * 3600000);
    // Freeze only Date; avoid replacing I/O timers used by PostgreSQL and HTTP.
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "CANCELLED"] as const) await f.ticket(owner.id, { status });
    for (const [status, at, estimate] of [
      ["RESOLVED", start, true], ["CLOSED", now, false], ["RESOLVED", new Date(+start - 1), false],
      ["CLOSED", new Date(+now + 1), true], ["OPEN", now, true],
    ] as const) await f.ticket(owner.id, { status, resolvedAt: at, resolvedAtEstimated: estimate, updatedAt: now });
    await f.ticket(other.id, { status: "WAITING_FOR_REQUESTER", resolvedAt: now });
    const response = await agent.get("/api/dashboards/requester"); expect(response.status).toBe(200);
    const [oracle] = await f.prisma.$queryRaw<{ active: number; waiting: number; resolved: number }[]>`
      SELECT count(*) FILTER (WHERE status IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED'))::int AS active,
      count(*) FILTER (WHERE status='WAITING_FOR_REQUESTER')::int AS waiting,
      count(*) FILTER (WHERE status IN ('RESOLVED','CLOSED') AND "resolvedAt" BETWEEN ${start} AND ${now})::int AS resolved FROM "Ticket" WHERE "requesterId"=${owner.id}`;
    expect(response.body.metrics).toEqual({ activeTickets: oracle.active, waitingForRequester: oracle.waiting, recentlyResolved: oracle.resolved });
    expect(oracle.resolved).toBe(2); expect(response.body.recentlyResolvedIncludesEstimates).toBe(true);
    expect(response.body.asOf).toBe(now.toISOString()); expect(response.body.windowStart).toBe(start.toISOString());
    const ids = await f.prisma.$queryRaw<{ id: number }[]>`SELECT id FROM "Ticket" WHERE "requesterId"=${owner.id} ORDER BY "updatedAt" DESC, id ASC LIMIT 5`;
    expect(response.body.recentTickets.map((t: { id: number }) => t.id)).toEqual(ids.map(t => t.id));
    expect(JSON.stringify(response.body)).not.toMatch(/email|internalNotes|password|canonicalRequest|tokenDigest/);
    vi.useRealTimers();
  });
  it("returns honest zero metrics and empty preview for an empty Requester", async () => {
    const agent = await f.agent((await f.user("REQUESTER")).id), res = await agent.get("/api/dashboards/requester");
    expect(res.body.metrics).toEqual({ activeTickets: 0, waitingForRequester: 0, recentlyResolved: 0 });
    expect(res.body.recentTickets).toEqual([]); expect(res.body.recentlyResolvedIncludesEstimates).toBe(false);
  });
});
