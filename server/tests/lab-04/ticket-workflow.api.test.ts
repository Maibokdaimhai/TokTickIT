import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixture, createBody } from "./fixture.js";
import { randomUUID } from "node:crypto";
import type { ActionStatus, TicketStatus } from "@prisma/client";
import { actionSnapshot } from "../../src/services/action.service.js";

const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"], OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"], REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], CANCELLED: ["REOPENED"],
};

describe("Lab 4 Ticket workflow and resolution gate", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async () => { f = await fixture(); }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  async function scenario() {
    const requester = await f.user("REQUESTER"), staff = await f.user("IT_STAFF");
    return { requester, staff, ticket: await f.ticket(requester.id, { status: "OPEN", ownerId: staff.id }), agent: await f.agent(staff.id) };
  }
  async function work(ticketId: number, actorId: number, status: ActionStatus = "COMPLETED", followUpRequired = false, result: string | null = "Work complete") {
    const action = await f.prisma.actionTaken.create({ data: { ticketId, performedById: actorId, assigneeId: actorId, actionAt: new Date("2026-01-02T00:00:00Z"), description: "Workflow fixture", result, followUpRequired, followUpNote: followUpRequired ? "Confirm recovery" : null, status, clientRequestId: randomUUID(), canonicalRequest: "{}" } });
    await f.prisma.actionTakenRevision.create({ data: { actionId: action.id, version: 0, editorId: actorId, snapshot: actionSnapshot(action) } });
    return action;
  }
  it("blocks direct resolution without completed work even after an advisory Requester indication", async () => {
    const { requester, ticket, agent } = await scenario(), owner = await f.agent(requester.id);
    const indication = await owner.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).send({ expectedVersion: 0 });
    expect(indication.status).toBe(200); expect(indication.body.ticket.status).toBe("OPEN");
    const resolve = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: true });
    expect(resolve.status).toBe(409); expect(resolve.body.error.code).toBe("RESOLUTION_BLOCKED");
    expect(resolve.body.error.details).toEqual([{ field: "completedAction", message: expect.any(String) }]);
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(1);
    expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
  it("records pending follow-up completion and then resolves, closes and reopens with immutable history", async () => {
    const { ticket, agent, requester } = await scenario();
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(ticket.ownerId!), followUpRequired: true, followUpNote: "Confirm with Requester" });
    const actionId = made.body.action.id;
    await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({ expectedTicketVersion: 1, expectedActionVersion: 0, status: "COMPLETED", result: "Restored connectivity" });
    const statusRoute = `/api/staff/tickets/${ticket.id}/status`;
    const blocked = await agent.patch(statusRoute).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 2, confirmed: true });
    expect(blocked.body.error.code).toBe("RESOLUTION_BLOCKED");
    const completion = await agent.post(`/api/staff/tickets/${ticket.id}/actions/${actionId}/follow-up-completion`).send({ expectedTicketVersion: 2, expectedActionVersion: 1, completionNote: "Requester verified recovery" });
    expect(completion.status).toBe(200);
    const resolved = await agent.patch(statusRoute).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 3, confirmed: true });
    expect(resolved.status).toBe(200); expect(resolved.body.ticket.resolvedAt).toEqual(expect.any(String)); expect(resolved.body.ticket.resolvedAtEstimated).toBe(false);
    const time = resolved.body.ticket.resolvedAt;
    const closed = await agent.patch(statusRoute).send({ status: "CLOSED", expectedStatus: "RESOLVED", expectedVersion: 4, confirmed: true });
    expect(closed.body.ticket.resolvedAt).toBe(time);
    const reopened = await agent.patch(statusRoute).send({ status: "REOPENED", expectedStatus: "CLOSED", expectedVersion: 5, confirmed: true });
    expect(reopened.body.ticket.resolvedAt).toBeNull(); expect(reopened.body.ticket.problemAppearsResolvedAt).toBeNull();
    const history = await (await f.agent(requester.id)).get(`/api/tickets/${ticket.id}/status-history`);
    expect(history.status).toBe(200); expect(history.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual(["RESOLVED", "CLOSED", "REOPENED"]);
    expect(history.body.historyStartsAt).toEqual(expect.any(String));
  });
  it.each(Object.keys(transitions) as TicketStatus[])("enforces all eight destination statuses from %s", async current => {
    const { requester, staff, agent } = await scenario();
    for (const next of Object.keys(transitions) as TicketStatus[]) {
      const ticket = await f.ticket(requester.id, { status: current, ownerId: staff.id });
      if (next === "RESOLVED") await work(ticket.id, staff.id);
      const response = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: next, expectedStatus: current, expectedVersion: 0, confirmed: true });
      const allowed = transitions[current].includes(next);
      expect(response.status, `${current} -> ${next}`).toBe(allowed ? 200 : 400);
      const events = await f.prisma.ticketStatusEvent.findMany({ where: { ticketId: ticket.id } });
      expect(events).toHaveLength(allowed ? 1 : 0);
      if (allowed) expect(events[0]).toMatchObject({ fromStatus: current, toStatus: next, actorId: staff.id, ticketVersion: 1 });
      expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(allowed ? 1 : 0);
    }
  });
  it("returns all resolution blockers and ignores cancelled follow-up", async () => {
    const { ticket, staff, agent } = await scenario();
    await work(ticket.id, staff.id, "IN_PROGRESS", true, null);
    const response = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true });
    expect(response.status).toBe(409);
    expect(response.body.error.details.map((d: {field:string}) => d.field)).toEqual(["completedAction", "activeActions", "followUp"]);
    const other = await f.ticket(ticket.requesterId, { status: "OPEN", ownerId: staff.id });
    await work(other.id, staff.id); await work(other.id, staff.id, "CANCELLED", true, "Not needed");
    expect((await agent.patch(`/api/staff/tickets/${other.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true })).status).toBe(200);
  });
  it.each([null, "", " \n\t"])("rejects completed fixture work without a meaningful result (%s)", async result => {
    const { ticket, staff, agent } = await scenario(); await work(ticket.id, staff.id, "COMPLETED", false, result);
    expect((await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true })).body.error.code).toBe("RESOLUTION_BLOCKED");
  });
  it("preserves legacy resolution time through closure and requires work after reopening", async () => {
    const { ticket, staff, agent } = await scenario(), legacyTime = new Date("2026-01-02T00:00:00Z");
    await f.prisma.ticket.update({ where: { id: ticket.id }, data: { status: "RESOLVED", resolvedAt: legacyTime, resolvedAtEstimated: true, problemAppearsResolvedAt: legacyTime, problemAppearsResolvedById: ticket.requesterId } });
    const route = `/api/staff/tickets/${ticket.id}/status`;
    const closed = await agent.patch(route).send({ status: "CLOSED", expectedStatus: "RESOLVED", expectedVersion: 0, confirmed: true });
    expect(closed.status).toBe(200); expect(closed.body.ticket).toMatchObject({ resolvedAt: legacyTime.toISOString(), resolvedAtEstimated: true });
    const reopened = await agent.patch(route).send({ status: "REOPENED", expectedStatus: "CLOSED", expectedVersion: 1, confirmed: true });
    expect(reopened.body.ticket).toMatchObject({ resolvedAt: null, resolvedAtEstimated: false, problemAppearsResolvedAt: null, problemAppearsResolvedById: null });
    expect((await agent.patch(route).send({ status: "RESOLVED", expectedStatus: "REOPENED", expectedVersion: 2, confirmed: true })).body.error.code).toBe("RESOLUTION_BLOCKED");
    await work(ticket.id, staff.id); const started = Date.now();
    const resolved = await agent.patch(route).send({ status: "RESOLVED", expectedStatus: "REOPENED", expectedVersion: 2, confirmed: true });
    expect(resolved.status).toBe(200); expect(resolved.body.ticket.resolvedAtEstimated).toBe(false);
    expect(Date.parse(resolved.body.ticket.resolvedAt)).toBeGreaterThanOrEqual(started);
  });
  it("creates a claim event only for NEW -> OPEN and keeps history append-only", async () => {
    const { requester, staff, agent } = await scenario();
    const ticket = await f.ticket(requester.id);
    const claimed = await agent.post(`/api/staff/tickets/${ticket.id}/claim`).send({ expectedVersion: 0 });
    expect(claimed.status).toBe(200);
    const event = await f.prisma.ticketStatusEvent.findFirstOrThrow({ where: { ticketId: ticket.id } });
    expect(event).toMatchObject({ actorId: staff.id, fromStatus: "NEW", toStatus: "OPEN", ticketVersion: 1 });
    await expect(f.prisma.ticketStatusEvent.update({ where: { id: event.id }, data: { toStatus: "CANCELLED" } })).rejects.toThrow();
    await expect(f.prisma.ticketStatusEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    const open = await f.ticket(requester.id, { status: "OPEN" });
    expect((await agent.post(`/api/staff/tickets/${open.id}/claim`).send({ expectedVersion: 0 })).status).toBe(200);
    expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: open.id } })).toBe(0);
  });
  it("protects history ownership, safe projections, ordering and pagination", async () => {
    const { ticket, requester, staff, agent } = await scenario(), other = await f.user("REQUESTER"), outsider = await f.agent(other.id);
    for (let i = 1; i <= 11; i++) await f.prisma.ticketStatusEvent.create({ data: { ticketId: ticket.id, actorId: staff.id, fromStatus: "OPEN", toStatus: "IN_PROGRESS", ticketVersion: i, createdAt: new Date("2026-01-02T00:00:00Z") } });
    const owner = await f.agent(requester.id), response = await owner.get(`/api/tickets/${ticket.id}/status-history`);
    expect(response.status).toBe(200); expect(response.body.events).toHaveLength(10); expect(response.body.events.map((e: {ticketVersion:number}) => e.ticketVersion)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(response.headers['cache-control']).toBe('no-store'); expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|email|tokenDigest|internalNotes|seedKey/);
    expect((await owner.get(`/api/tickets/${ticket.id}/status-history?page=2`)).body.events[0].ticketVersion).toBe(11);
    const far = await agent.get(`/api/tickets/${ticket.id}/status-history?page=2147483647&limit=50`);
    expect(far.status).toBe(200); expect(far.body.events).toEqual([]);
    expect((await outsider.get(`/api/tickets/${ticket.id}/status-history`)).body).toEqual((await outsider.get('/api/tickets/2147483647/status-history')).body);
    expect((await owner.get(`/api/tickets/${ticket.id}/status-history?limit=11`)).status).toBe(400);
    expect((await owner.patch(`/api/staff/tickets/${ticket.id}/status`).send({})).status).toBe(403);
  });
  it("returns empty legacy history without inventing past transitions", async () => {
    const { ticket, agent } = await scenario();
    const response = await agent.get(`/api/tickets/${ticket.id}/status-history`);
    expect(response.body).toMatchObject({ events: [], pagination: { totalItems: 0, totalPages: 0 }, historyStartsAt: expect.any(String) });
  });
  it("rejects unknown workflow queries without mutating Ticket state", async () => {
    const { requester, ticket, agent } = await scenario();
    const response = await agent.patch(`/api/staff/tickets/${ticket.id}/status?unexpected=1`).send({ status: "IN_PROGRESS", expectedStatus: "OPEN", expectedVersion: 0 });
    expect(response.status).toBe(400); expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(0);
    const newTicket = await f.ticket(requester.id);
    expect((await agent.post(`/api/staff/tickets/${newTicket.id}/claim?expectedVersion[]=0`).send({ expectedVersion: 0 })).status).toBe(400);
    expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: { in: [ticket.id, newTicket.id] } } })).toBe(0);
  });
  it("rolls claim/status metadata and versions back if transition history cannot be saved", async () => {
    const { ticket, requester, staff, agent } = await scenario(); await work(ticket.id, staff.id);
    const claim = await f.ticket(requester.id);
    await f.prisma.$executeRawUnsafe(`ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT fail_workflow_event CHECK ("ticketId" NOT IN (${ticket.id}, ${claim.id}))`);
    try {
      const response = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true });
      expect(response.status).toBe(500);
      expect(await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ status: "OPEN", version: 0, resolvedAt: null });
      expect((await agent.post(`/api/staff/tickets/${claim.id}/claim`).send({ expectedVersion: 0 })).status).toBe(500);
      expect(await f.prisma.ticket.findUniqueOrThrow({ where: { id: claim.id } })).toMatchObject({ status: "NEW", ownerId: null, version: 0 });
      expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: { in: [ticket.id, claim.id] } } })).toBe(0);
    } finally { await f.prisma.$executeRawUnsafe('ALTER TABLE "TicketStatusEvent" DROP CONSTRAINT fail_workflow_event'); }
  });
});
