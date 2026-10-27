import { beforeAll, afterAll, describe, it, expect } from "vitest";
import supertest from "supertest";
import app from "../../src/app.js";
import { fixture, createBody } from "./fixture.js";

describe("Lab 4 backend action authorization", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async () => { f = await fixture(); }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  it("keeps foreign and absent Requester Ticket responses identical on every read", async () => {
    const owner = await f.user("REQUESTER"), outsider = await f.user("REQUESTER"), staff = await f.user("IT_STAFF");
    const ticket = await f.ticket(owner.id), agent = await f.agent(outsider.id);
    const made = await (await f.agent(staff.id)).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
    for (const suffix of ["", `/${made.body.action.id}`, `/${made.body.action.id}/revisions`]) {
      const foreign = await agent.get(`/api/tickets/${ticket.id}/actions${suffix}`);
      const missing = await agent.get(`/api/tickets/2147483647/actions${suffix}`);
      expect(foreign.status).toBe(404); expect(missing.status).toBe(404); expect(foreign.body).toEqual(missing.body);
    }
  });
  it("denies Requester writes before lookup, including completion and malformed IDs", async () => {
    const requester = await f.user("REQUESTER"), agent = await f.agent(requester.id);
    expect((await agent.post('/api/staff/tickets/bad/actions').send({})).status).toBe(403);
    expect((await agent.patch('/api/staff/tickets/bad/actions/bad').send({})).status).toBe(403);
    expect((await agent.post('/api/staff/tickets/bad/actions/bad/follow-up-completion').send({})).status).toBe(403);
  });
  it("requires a real active unrestricted session and exact Origin", async () => {
    expect((await supertest(app).get('/api/tickets/1/actions')).status).toBe(401);
    const staff = await f.user("IT_STAFF"), agent = await f.agent(staff.id);
    expect((await agent.post('/api/staff/tickets/1/actions').set('Origin', 'https://wrong.example').send(createBody(staff.id))).status).toBe(403);
    await f.prisma.user.update({ where: { id: staff.id }, data: { mustChangePassword: true } });
    expect((await agent.get('/api/tickets/1/actions')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await f.prisma.user.update({ where: { id: staff.id }, data: { isActive: false } });
    expect((await agent.get('/api/tickets/1/actions')).status).toBe(401);
  });
  it("does not allow draft compensation to erase any action work", async () => {
    const requester = await f.user("REQUESTER"), staff = await f.user("IT_STAFF"), ticket = await f.ticket(requester.id);
    const owner = await f.agent(requester.id);
    await (await f.agent(staff.id)).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(staff.id));
    const response = await owner.delete(`/api/tickets/${ticket.id}`);
    expect(response.status).toBe(409); expect(response.body.error.code).toBe('ROLLBACK_NOT_ALLOWED');
    expect(await f.prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
    const untouched = await f.ticket(requester.id);
    expect((await owner.delete(`/api/tickets/${untouched.id}`)).status).toBe(200);
  });
});
