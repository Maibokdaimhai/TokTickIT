import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { fixture } from "./fixture.js";

describe("Staff and Administrator dashboard database oracle", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async () => { f = await fixture(); }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  it("zero-fills every bucket and returns empty previews without Tickets", async () => {
    const agent = await f.agent((await f.user("IT_STAFF")).id), res = await agent.get("/api/dashboards/staff");
    expect(res.body.metrics).toEqual({ unassignedTickets: 0, myTickets: 0, myActiveActions: 0 });
    expect(Object.keys(res.body.byStatus)).toHaveLength(8); expect(Object.values(res.body.byStatus)).toEqual(Array(8).fill(0));
    expect(Object.keys(res.body.byItPriority)).toHaveLength(4); expect(Object.values(res.body.byItPriority)).toEqual(Array(4).fill(0));
    expect(res.body.recentTickets).toEqual([]); expect(res.body.myActions).toEqual([]);
  });
  it("counts all visible Tickets but scopes mine to each actor and actions to assignee plus active parent", async () => {
    const requester = await f.user("REQUESTER"), staff = await f.user("IT_STAFF"), admin = await f.user("ADMINISTRATOR");
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
    for (let i = 0; i < statuses.length; i++) {
      const t = await f.ticket(requester.id, { status: statuses[i], ownerId: i % 3 === 0 ? null : i % 3 === 1 ? staff.id : admin.id, itPriority: ["LOW", "MEDIUM", "HIGH", "URGENT"][i % 4] as "LOW", updatedAt: new Date("2026-10-27T01:00:00Z") });
      for (const status of ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) await f.prisma.actionTaken.create({ data: { ticketId: t.id, status, assigneeId: i % 2 ? admin.id : staff.id, performedById: i % 2 ? staff.id : admin.id, actionAt: new Date(), description: "Assigned work", clientRequestId: randomUUID(), followUpRequired: false, canonicalRequest: "secret", updatedAt: new Date("2026-10-27T01:00:00Z") } });
    }
    for (const actor of [staff, admin]) {
      const agent = await f.agent(actor.id), res = await agent.get("/api/dashboards/staff"); expect(res.status).toBe(200);
      const [oracle] = await f.prisma.$queryRaw<{ unassigned: number; mine: number }[]>`SELECT count(*) FILTER (WHERE "ownerId" IS NULL)::int AS unassigned, count(*) FILTER (WHERE "ownerId"=${actor.id})::int AS mine FROM "Ticket" WHERE status NOT IN ('RESOLVED','CLOSED','CANCELLED')`;
      const actions = await f.prisma.$queryRaw<{ id: number }[]>`SELECT a.id FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE a."assigneeId"=${actor.id} AND a.status IN ('PLANNED','IN_PROGRESS') AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED') ORDER BY a."updatedAt" DESC,a.id ASC`;
      expect(res.body.metrics).toEqual({ unassignedTickets: oracle.unassigned, myTickets: oracle.mine, myActiveActions: actions.length });
      expect(res.body.myActions.map((a: { id: number }) => a.id)).toEqual(actions.slice(0,5).map(a => a.id));
      expect(res.body.recentTickets).toHaveLength(5);
      const statusRows = await f.prisma.$queryRaw<{ status: string; n: number }[]>`SELECT status,count(*)::int AS n FROM "Ticket" GROUP BY status`;
      expect(res.body.byStatus).toEqual(Object.fromEntries(statusRows.map(r => [r.status, r.n])));
      const priorityRows = await f.prisma.$queryRaw<{ priority: string; n: number }[]>`SELECT "itPriority" AS priority,count(*)::int AS n FROM "Ticket" WHERE status NOT IN ('RESOLVED','CLOSED','CANCELLED') GROUP BY "itPriority"`;
      expect(res.body.byItPriority).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0, ...Object.fromEntries(priorityRows.map(r => [r.priority,r.n])) });
      expect(JSON.stringify(res.body)).not.toMatch(/canonicalRequest|clientRequestId|email|internalNotes|password/);
    }
  });
});
