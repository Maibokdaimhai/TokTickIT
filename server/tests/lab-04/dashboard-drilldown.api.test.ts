import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixture } from "./fixture.js";
import { randomUUID } from "node:crypto";

describe("Exact dashboard drill-down filters", () => {
  let f: Awaited<ReturnType<typeof fixture>>, requester: number, staff: number;
  beforeAll(async () => {
    f = await fixture(); requester = (await f.user("REQUESTER")).id; staff = (await f.user("IT_STAFF")).id;
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const) {
      const t = await f.ticket(requester, { status, ownerId: status === "NEW" ? null : staff, resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null });
      for (let i=0; i<3; i++) await f.prisma.actionTaken.create({ data: { ticketId: t.id, assigneeId: staff, performedById: staff, status: "PLANNED", actionAt: new Date(), description: "Work item", followUpRequired: false, canonicalRequest: "{}", clientRequestId: randomUUID() } });
    }
  }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  it("matches all Requester metric totals, accepts every status and uses stable updated ordering", async () => {
    const agent = await f.agent(requester), dashboard = (await agent.get("/api/dashboards/requester")).body;
    for (const [query, total] of [
      [{ statusGroup: "active" }, dashboard.metrics.activeTickets], [{ status: "WAITING_FOR_REQUESTER" }, dashboard.metrics.waitingForRequester],
      [{ resolvedFrom: dashboard.windowStart, resolvedTo: dashboard.asOf }, dashboard.metrics.recentlyResolved],
    ] as const) { const r = await agent.get("/api/tickets").query(query); expect(r.status).toBe(200); expect(r.body.pagination.totalItems).toBe(total); }
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]) {
      const r=await agent.get("/api/tickets").query({ status }); expect(r.status).toBe(200); expect(r.body.tickets.map((t: {status:string})=>t.status)).toEqual([status]);
    }
    const r=await agent.get("/api/tickets?sort=updatedAt_desc");
    const rows=await f.prisma.$queryRaw<{id:number}[]>`SELECT id FROM "Ticket" WHERE "requesterId"=${requester} ORDER BY "updatedAt" DESC,id ASC`;
    expect(r.body.tickets.map((t:{id:number})=>t.id)).toEqual(rows.map(t=>t.id));
  });
  it("matches Staff cards and all bucket totals, with existing filters combined using AND", async () => {
    const agent=await f.agent(staff), d=(await agent.get("/api/dashboards/staff")).body;
    for (const [query,total] of [
      [{ statusGroup:"active", owner:"unassigned" }, d.metrics.unassignedTickets], [{ statusGroup:"active", owner:"me" },d.metrics.myTickets],
      ...Object.entries(d.byStatus).map(([status,n])=>[{status},n]), ...Object.entries(d.byItPriority).map(([itPriority,n])=>[{statusGroup:"active",itPriority},n]),
    ] as [Record<string,string>,number][]) {const r=await agent.get("/api/staff/tickets").query(query);expect(r.status).toBe(200);expect(r.body.pagination.totalItems).toBe(total);}
    const r=await agent.get("/api/staff/tickets?statusGroup=active&owner=me&itPriority=URGENT"); expect(r.body.pagination.totalItems).toBe(0);
  });
  it("paginates assigned Actions stably, ignores performer identity and bounds far pages", async () => {
    const agent=await f.agent(staff), path="/api/staff/actions?assignee=me&statusGroup=active";
    const d=(await agent.get("/api/dashboards/staff")).body, first=await agent.get(path), second=await agent.get(path+"&page=2");
    expect(first.status).toBe(200);expect(first.body.pagination.totalItems).toBe(d.metrics.myActiveActions);expect(first.body.actions).toHaveLength(10);expect(second.body.actions).toHaveLength(5);
    const ids=[...first.body.actions,...second.body.actions].map(a=>a.id);expect(new Set(ids).size).toBe(15);
    expect((await agent.get(path+"&page=2147483647")).body.actions).toEqual([]);
  });
  it.each(["statusGroup=", "statusGroup=closed", "statusGroup=active&status=OPEN", "resolvedFrom=2026-01-01T00:00:00Z", "resolvedFrom=no&resolvedTo=no", "resolvedFrom=2026-02-30T00:00:00Z&resolvedTo=2026-03-01T00:00:00Z", "resolvedFrom=2026-03-01T00:00:00&resolvedTo=2026-03-02T00:00:00", "resolvedFrom=2026-03-02T00:00:00Z&resolvedTo=2026-03-01T00:00:00Z", "statusGroup=active&statusGroup=active", "unknown=1"])("rejects invalid new filters on both lists: %s", async query => {
    expect((await (await f.agent(requester)).get("/api/tickets?"+query)).status).toBe(400);
    expect((await (await f.agent(staff)).get("/api/staff/tickets?"+query)).status).toBe(400);
  });
  it.each(["", "assignee=1&statusGroup=active", "assignee=me", "assignee=me&statusGroup=active&limit=15", "assignee=me&statusGroup=active&status=PLANNED", "assignee=me&assignee=me&statusGroup=active"])("rejects noncontract action filters: %s", async query=>{expect((await (await f.agent(staff)).get("/api/staff/actions?"+query)).status).toBe(400);});
});
