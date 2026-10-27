import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { fixture, createBody } from "./fixture.js";

describe("Lab 4 Actions Taken API and public history", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  let requester: Awaited<ReturnType<typeof f.user>>, staff: typeof requester, admin: typeof requester;
  beforeAll(async () => { f = await fixture(); requester = await f.user("REQUESTER"); staff = await f.user("IT_STAFF"); admin = await f.user("ADMINISTRATOR"); }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  it("rejects unexpected write queries and returns a safe JSON 404 for unsupported deletion", async () => {
    const ticket = await f.ticket(requester.id), agent = await f.agent(staff.id);
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions?unexpected=1`).send(createBody(staff.id));
    expect(response.status).toBe(400);
    expect(await f.prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    const missing = await agent.delete(`/api/staff/tickets/${ticket.id}/actions/1`);
    expect(missing.status).toBe(404); expect(missing.body.error.code).toBe('NOT_FOUND');
  });
  it("creates assigned work with automatic performer and one safe creation revision", async () => {
    const ticket = await f.ticket(requester.id);
    const agent = await f.agent(staff.id);
    const response = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(admin.id));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ replayed: false, ticketVersion: 1, action: { performedBy: { id: staff.id }, assignee: { id: admin.id }, version: 0, ticketId: ticket.id } });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|clientRequestId|canonicalRequest|seedKey|filePath|tokenDigest/);
    const read = await (await f.agent(requester.id)).get(`/api/tickets/${ticket.id}/actions/${response.body.action.id}/revisions`);
    expect(read.status).toBe(200); expect(read.headers['cache-control']).toBe('no-store');
    expect(read.body.revisions).toHaveLength(1);
    expect(read.body.revisions[0]).toMatchObject({ version: 0, editor: { id: staff.id }, snapshot: { performedById: staff.id, assigneeId: admin.id } });
  });
  it("edits and completes work while protecting history and terminal content", async () => {
    const ticket = await f.ticket(requester.id), agent = await f.agent(staff.id);
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
    const id = made.body.action.id, route = `/api/staff/tickets/${ticket.id}/actions/${id}`;
    expect((await agent.patch(route).send({ expectedTicketVersion: 1, expectedActionVersion: 0, status: "COMPLETED" })).status).toBe(400);
    const edited = await agent.patch(route).send({ expectedTicketVersion: 1, expectedActionVersion: 0, assigneeId: admin.id, result: "Restored connectivity", status: "COMPLETED" });
    expect(edited.status).toBe(200); expect(edited.body.action.performedBy.id).toBe(staff.id);
    expect((await agent.patch(route).send({ expectedTicketVersion: 2, expectedActionVersion: 1, description: "Rewrite past work" })).status).toBe(409);
    const history = await agent.get(`/api/tickets/${ticket.id}/actions/${id}/revisions`);
    expect(history.body.revisions.map((r: {version:number}) => r.version)).toEqual([0, 1]);
    expect(history.body.revisions[0].snapshot.result).toBeNull();
    await expect(f.prisma.actionTakenRevision.update({ where: { id: history.body.revisions[0].id }, data: { version: 9 } })).rejects.toThrow();
  });
  it("records follow-up completion without rewriting the original completed work or note", async () => {
    const ticket = await f.ticket(requester.id), agent = await f.agent(staff.id);
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(staff.id), followUpRequired: true, followUpNote: "Confirm with Requester" });
    const id = made.body.action.id, route = `/api/staff/tickets/${ticket.id}/actions/${id}`;
    const completed = await agent.patch(route).send({ expectedTicketVersion: 1, expectedActionVersion: 0, status: "COMPLETED", result: "Fixed" });
    expect(completed.status).toBe(200);
    await f.prisma.user.update({ where: { id: staff.id }, data: { isActive: false } });
    const adminAgent = await f.agent(admin.id);
    const result = await adminAgent.post(`${route}/follow-up-completion`).send({ expectedTicketVersion: 2, expectedActionVersion: 1, completionNote: "Requester confirmed recovery" });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ticketVersion: 3, action: { status: "COMPLETED", result: "Fixed", followUpRequired: false, followUpNote: "Confirm with Requester", followUpCompletedBy: { id: admin.id }, followUpCompletionNote: "Requester confirmed recovery" } });
    expect(Date.parse(result.body.action.followUpCompletedAt)).not.toBeNaN();
    const ownerAgent = await f.agent(requester.id);
    const read = await ownerAgent.get(`/api/tickets/${ticket.id}/actions/${id}`);
    expect(read.body.action.followUpCompletionNote).toBe("Requester confirmed recovery");
    const revisions = await ownerAgent.get(`/api/tickets/${ticket.id}/actions/${id}/revisions`);
    expect(revisions.body.revisions.map((r: {snapshot:{followUpRequired:boolean}}) => r.snapshot.followUpRequired)).toEqual([true, true, false]);
    expect((await adminAgent.post(`${route}/follow-up-completion`).send({ expectedTicketVersion: 3, expectedActionVersion: 2, completionNote: "Again" })).body.error.code).toBe("FOLLOW_UP_NOT_PENDING");
    await f.prisma.user.update({ where: { id: staff.id }, data: { isActive: true } });
  });
  it("rejects invalid assignees, spoofed fields and no-op edits without changes", async () => {
    const ticket = await f.ticket(requester.id), agent = await f.agent(staff.id);
    const inactive = await f.user("IT_STAFF", { isActive: false });
    for (const assigneeId of [requester.id, inactive.id, 2147483647]) expect((await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(assigneeId))).body.error.code).toBe("INVALID_ASSIGNEE");
    expect((await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(staff.id), performedById: admin.id })).status).toBe(400);
    expect(await f.prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
    const noOp = await agent.patch(`/api/staff/tickets/${ticket.id}/actions/${made.body.action.id}`).send({ expectedTicketVersion: 1, expectedActionVersion: 0, description: "Inspect network equipment" });
    expect(noOp.body.error.code).toBe("INVALID_ACTION_TRANSITION");
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(1);
  });
  it("returns stable pages and bounds queries, including empty and mismatched action reads", async () => {
    const ticket = await f.ticket(requester.id), other = await f.ticket(requester.id), agent = await f.agent(staff.id);
    const first = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
    const second = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(admin.id, 1), actionAt: "2026-01-01T00:00:00Z" });
    expect(second.status).toBe(201);
    const page = await agent.get(`/api/tickets/${ticket.id}/actions`);
    expect(page.body.actions.map((a: {id:number}) => a.id)).toEqual([first.body.action.id, second.body.action.id]);
    expect((await agent.get(`/api/tickets/${ticket.id}/actions?page=2`)).body.actions).toEqual([]);
    const farPage = await agent.get(`/api/tickets/${ticket.id}/actions?page=2147483647&limit=50`);
    expect(farPage.status).toBe(200); expect(farPage.body.actions).toEqual([]);
    const farHistory = await agent.get(`/api/tickets/${ticket.id}/actions/${first.body.action.id}/revisions?page=2147483647&limit=50`);
    expect(farHistory.status).toBe(200); expect(farHistory.body.revisions).toEqual([]);
    expect((await agent.get(`/api/tickets/${other.id}/actions`)).body.pagination.totalPages).toBe(0);
    for (const query of ["page=0", "limit=11", "page[]=1", "unexpected=1"]) expect((await agent.get(`/api/tickets/${ticket.id}/actions?${query}`)).status).toBe(400);
    expect((await agent.get(`/api/tickets/${other.id}/actions/${first.body.action.id}`)).status).toBe(404);
  });
  it("freezes new writes on resolved/closed/cancelled parents", async () => {
    const agent = await f.agent(staff.id);
    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      const ticket = await f.ticket(requester.id, { status });
      const result = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
      expect(result.body.error.code).toBe("TICKET_READ_ONLY");
    }
  });
  it("rejects follow-up completion for noncompleted/no-pending work and frozen parents", async () => {
    const agent = await f.agent(staff.id), ticket = await f.ticket(requester.id);
    const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
    const route = `/api/staff/tickets/${ticket.id}/actions/${made.body.action.id}`;
    const input = { expectedTicketVersion: 1, expectedActionVersion: 0, completionNote: "Not yet eligible" };
    expect((await agent.post(`${route}/follow-up-completion`).send(input)).body.error.code).toBe('FOLLOW_UP_NOT_PENDING');
    await agent.patch(route).send({ expectedTicketVersion: 1, expectedActionVersion: 0, status: 'COMPLETED', result: 'Done' });
    expect((await agent.post(`${route}/follow-up-completion`).send({ ...input, expectedTicketVersion: 2, expectedActionVersion: 1 })).body.error.code).toBe('FOLLOW_UP_NOT_PENDING');
    await f.prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', version: { increment: 1 } } });
    expect((await agent.post(`${route}/follow-up-completion`).send({ ...input, expectedTicketVersion: 3, expectedActionVersion: 1 })).body.error.code).toBe('TICKET_READ_ONLY');
    expect(await f.prisma.actionTakenRevision.count({ where: { actionId: made.body.action.id } })).toBe(2);
  });
  it.each(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)("enforces all next states from %s", async current => {
    const agent = await f.agent(staff.id);
    const allowed = { PLANNED: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] };
    for (const next of ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) {
      const ticket = await f.ticket(requester.id);
      const made = await agent.post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(staff.id), status: current === "PLANNED" ? "PLANNED" : "IN_PROGRESS" });
      const route = `/api/staff/tickets/${ticket.id}/actions/${made.body.action.id}`;
      let parentVersion = 1, actionVersion = 0;
      if (current === "COMPLETED" || current === "CANCELLED") {
        await agent.patch(route).send({ status: current, result: "Original result", expectedTicketVersion: 1, expectedActionVersion: 0 });
        parentVersion++; actionVersion++;
      }
      const response = await agent.patch(route).send({ status: next, result: "New result", expectedTicketVersion: parentVersion, expectedActionVersion: actionVersion });
      const terminal = current === 'COMPLETED' || current === 'CANCELLED';
      expect(response.status).toBe(terminal ? 409 : allowed[current].includes(next) ? 200 : 400);
    }
  });
});
