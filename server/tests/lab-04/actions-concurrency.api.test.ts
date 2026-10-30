import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { fixture, createBody } from "./fixture.js";

describe("Lab 4 real PostgreSQL concurrent action writes", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async () => { f = await fixture(); }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  async function scenario() {
    const requester = await f.user("REQUESTER"), staff = await f.user("IT_STAFF"), assignee = await f.user("IT_STAFF"), admin = await f.user("ADMINISTRATOR");
    return { requester, staff, assignee, admin, ticket: await f.ticket(requester.id), agent: await f.agent(staff.id) };
  }
  it("serializes concurrent exact retries into one creation and one replay", async () => {
    const { agent, assignee, ticket } = await scenario(), body = createBody(assignee.id);
    const responses = await Promise.all([agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(body), agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(body)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
    expect(new Set(responses.map(r => r.body.action.id)).size).toBe(1);
    expect(await f.prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect(await f.prisma.actionTakenRevision.count({ where: { action: { ticketId: ticket.id } } })).toBe(1);
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(1);
  });
  it("rejects changed key reuse across payloads/Tickets but permits exact replay on a frozen parent", async () => {
    const { agent, assignee, requester, ticket } = await scenario(), body = createBody(assignee.id);
    expect((await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(body)).status).toBe(201);
    expect((await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...body, description: "Different" })).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const other = await f.ticket(requester.id);
    expect((await agent.post(`/api/staff/tickets/${other.id}/actions`).send(body)).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    await f.prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', version: { increment: 1 } } });
    const replay = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(body);
    expect(replay.status).toBe(200); expect(replay.body.ticketVersion).toBe(2);
  });
  it("allows only one competing edit and one next revision", async () => {
    const { agent, assignee, ticket } = await scenario();
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assignee.id));
    const route = `/api/staff/tickets/${ticket.id}/actions/${made.body.action.id}`;
    const results = await Promise.all(['First edit', 'Second edit'].map(description => agent.patch(route).send({ description, expectedTicketVersion: 1, expectedActionVersion: 0 })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await f.prisma.actionTakenRevision.count({ where: { actionId: made.body.action.id } })).toBe(2);
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(2);
  });
  it("invalidates an action draft after an unrelated Ticket mutation", async () => {
    const { agent, assignee, ticket } = await scenario();
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assignee.id));
    expect((await agent.post(`/api/tickets/${ticket.id}/public-comments`).send({ content: 'Independent update' })).status).toBe(201);
    const stale = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${made.body.action.id}`).send({ result: 'Stale', expectedTicketVersion: 1, expectedActionVersion: 0 });
    expect(stale.status).toBe(409);
    expect((await f.prisma.actionTaken.findUniqueOrThrow({ where: { id: made.body.action.id } })).result).toBeNull();
  });
  it.each(['deactivation', 'demotion'])("serializes assignment against admin %s without a deadlock or rewriting historical assignment", async change => {
    const { agent, assignee, admin, ticket } = await scenario(), adminAgent = await f.agent(admin.id);
    const [creation, deactivation] = await Promise.all([
      agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assignee.id)),
      adminAgent.patch(`/api/admin/users/${assignee.id}`).send(change === 'deactivation' ? { isActive: false } : { role: 'REQUESTER' }),
    ]);
    expect(deactivation.status).toBe(200); expect([201, 400]).toContain(creation.status);
    if (creation.status === 400) expect(await f.prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    else {
      const action = await f.prisma.actionTaken.findUniqueOrThrow({ where: { id: creation.body.action.id } });
      expect(action.assigneeId).toBe(assignee.id);
      expect((await f.prisma.user.findUniqueOrThrow({ where: { id: assignee.id } })).updatedAt.getTime()).toBeGreaterThanOrEqual(action.createdAt.getTime());
    }
    const later = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assignee.id, creation.status === 201 ? 1 : 0));
    expect(later.body.error.code).toBe('INVALID_ASSIGNEE');
  });
  it("orders multiple User locks consistently when contributors assign work to each other", async () => {
    const { agent, staff, assignee, requester, ticket } = await scenario();
    const otherAgent = await f.agent(assignee.id), otherTicket = await f.ticket(requester.id);
    const results = await Promise.all([
      agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assignee.id)),
      otherAgent.post(`/api/staff/tickets/${otherTicket.id}/actions`).send(createBody(staff.id)),
    ]);
    expect(results.map(r => r.status)).toEqual([201, 201]);
    expect(results[0].body.action.assignee.id).toBe(assignee.id);
    expect(results[1].body.action.assignee.id).toBe(staff.id);
  });
  it("rolls projection, history and Ticket version back if saving a revision fails", async () => {
    const { agent, assignee, ticket } = await scenario();
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assignee.id));
    const id = made.body.action.id;
    await f.prisma.$executeRawUnsafe(`ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT fail_revision_test CHECK ("actionId" <> ${id} OR version = 0)`);
    try {
      const failed = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${id}`).send({ description: 'Will roll back', expectedTicketVersion: 1, expectedActionVersion: 0 });
      expect(failed.status).toBe(500); expect(failed.body.error.message).toBe('Action update failed');
      expect((await f.prisma.actionTaken.findUniqueOrThrow({ where: { id } })).description).toBe('Inspect network equipment');
      expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(1);
      expect(await f.prisma.actionTakenRevision.count({ where: { actionId: id } })).toBe(1);
    } finally { await f.prisma.$executeRawUnsafe('ALTER TABLE "ActionTakenRevision" DROP CONSTRAINT fail_revision_test'); }
  });
  it("allows only one parallel follow-up completion, preserving earlier snapshots", async () => {
    const { agent, assignee, ticket } = await scenario();
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(assignee.id), followUpRequired: true, followUpNote: 'Confirm recovery' });
    const id = made.body.action.id, route = `/api/staff/tickets/${ticket.id}/actions/${id}`;
    await agent.patch(route).send({ status: 'COMPLETED', result: 'Fixed', expectedTicketVersion: 1, expectedActionVersion: 0 });
    const results = await Promise.all(['Confirmed once', 'Confirmed twice'].map(completionNote => agent.post(`${route}/follow-up-completion`).send({ completionNote, expectedTicketVersion: 2, expectedActionVersion: 1 })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await f.prisma.actionTakenRevision.count({ where: { actionId: id } })).toBe(3);
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(3);
  });
  it("rolls follow-up completion evidence back if its revision cannot be saved", async () => {
    const { agent, assignee, ticket } = await scenario();
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(assignee.id), followUpRequired: true, followUpNote: 'Confirm recovery' });
    const id = made.body.action.id, route = `/api/staff/tickets/${ticket.id}/actions/${id}`;
    await agent.patch(route).send({ status: 'COMPLETED', result: 'Fixed', expectedTicketVersion: 1, expectedActionVersion: 0 });
    await f.prisma.$executeRawUnsafe(`ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT fail_completion_test CHECK ("actionId" <> ${id} OR version < 2)`);
    try {
      const response = await agent.post(`${route}/follow-up-completion`).send({ completionNote: 'Will roll back', expectedTicketVersion: 2, expectedActionVersion: 1 });
      expect(response.status).toBe(500);
      expect(await f.prisma.actionTaken.findUniqueOrThrow({ where: { id } })).toMatchObject({ followUpRequired: true, followUpCompletedAt: null, followUpCompletedById: null, followUpCompletionNote: null, version: 1 });
      expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(2);
      expect(await f.prisma.actionTakenRevision.count({ where: { actionId: id } })).toBe(2);
    } finally { await f.prisma.$executeRawUnsafe('ALTER TABLE "ActionTakenRevision" DROP CONSTRAINT fail_completion_test'); }
  });
});
