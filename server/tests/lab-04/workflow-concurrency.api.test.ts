import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { fixture, createBody } from "./fixture.js";
import { actionSnapshot } from "../../src/services/action.service.js";

describe("Lab 4 cross-record workflow serialization", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async () => { f = await fixture(); }, 30000);
  afterAll(async () => { if (f) await f.close(); });
  async function scenario(followUpRequired = false) {
    const requester = await f.user("REQUESTER"), owner = await f.user("IT_STAFF"), contributor = await f.user("IT_STAFF");
    const ticket = await f.ticket(requester.id, { status: "OPEN", ownerId: owner.id });
    const action = await f.prisma.actionTaken.create({ data: { ticketId: ticket.id, performedById: contributor.id, assigneeId: contributor.id, actionAt: new Date("2026-01-02T00:00:00Z"), description: "Completed work", status: "COMPLETED", result: "Restored", followUpRequired, followUpNote: followUpRequired ? "Verify recovery" : null, clientRequestId: randomUUID(), canonicalRequest: "{}" } });
    await f.prisma.actionTakenRevision.create({ data: { actionId: action.id, version: 0, editorId: contributor.id, snapshot: actionSnapshot(action) } });
    return { owner, contributor, ticket, action, ownerAgent: await f.agent(owner.id), contributorAgent: await f.agent(contributor.id) };
  }
  it("serializes new Action creation versus resolution on the parent Ticket", async () => {
    const { ticket, contributor, ownerAgent, contributorAgent } = await scenario();
    const [resolution, work] = await Promise.all([
      ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
      contributorAgent.post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody(contributor.id)),
    ]);
    expect([resolution.status, work.status].sort()).toEqual(resolution.status === 200 ? [200, 409] : [201, 409]);
    const saved = await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const active = await f.prisma.actionTaken.count({ where: { ticketId: ticket.id, status: { in: ["PLANNED", "IN_PROGRESS"] } } });
    expect(saved.version).toBe(1); expect(active).toBe(saved.status === "RESOLVED" ? 0 : 1);
    expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(saved.status === "RESOLVED" ? 1 : 0);
  });
  it("allows follow-up completion to release the gate without silently retrying stale resolution", async () => {
    const { ticket, action, ownerAgent, contributorAgent } = await scenario(true);
    const [resolution, completion] = await Promise.all([
      ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
      contributorAgent.post(`/api/staff/tickets/${ticket.id}/actions/${action.id}/follow-up-completion`).send({ expectedTicketVersion: 0, expectedActionVersion: 0, completionNote: "Requester verified recovery" }),
    ]);
    expect(completion.status).toBe(200); expect(resolution.status).toBe(409); expect(["VERSION_CONFLICT", "RESOLUTION_BLOCKED"]).toContain(resolution.body.error.code);
    const retry = await ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: true });
    expect(retry.status).toBe(200);
    expect(await f.prisma.actionTakenRevision.count({ where: { actionId: action.id } })).toBe(2);
    expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(1);
  });
  it("commits only one of competing status updates from the same version", async () => {
    const { ticket, ownerAgent, contributorAgent } = await scenario();
    const responses = await Promise.all([
      ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
      contributorAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "CANCELLED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await f.prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } })).toBe(1);
  });
  it("coordinates owner changes and resolution without acquiring User locks after Ticket", async () => {
    const { ticket, ownerAgent, contributorAgent, contributor } = await scenario();
    const responses = await Promise.all([
      ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
      contributorAgent.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ownerId: contributor.id, expectedVersion: 0 }),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(1);
  });
  it("serializes an ordinary Action completion versus resolution", async () => {
    const { ticket, ownerAgent, contributorAgent, contributor } = await scenario();
    const active = await f.prisma.actionTaken.create({ data: { ticketId: ticket.id, performedById: contributor.id, assigneeId: contributor.id, actionAt: new Date("2026-01-02T00:00:00Z"), description: "Remaining work", status: "IN_PROGRESS", followUpRequired: false, clientRequestId: randomUUID(), canonicalRequest: "{}" } });
    const [resolution, completion] = await Promise.all([
      ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
      contributorAgent.patch(`/api/staff/tickets/${ticket.id}/actions/${active.id}`).send({ status: "COMPLETED", result: "Done", expectedTicketVersion: 0, expectedActionVersion: 0 }),
    ]);
    expect(completion.status).toBe(200); expect(resolution.status).toBe(409);
    expect(["VERSION_CONFLICT", "RESOLUTION_BLOCKED"]).toContain(resolution.body.error.code);
    expect((await ownerAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: true })).status).toBe(200);
  });
  it("coordinates owner deactivation with resolution under User-before-Ticket locking", async () => {
    const { ticket, contributorAgent, owner } = await scenario(), admin = await f.user("ADMINISTRATOR"), adminAgent = await f.agent(admin.id);
    const [resolution, deactivation] = await Promise.all([
      contributorAgent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 0, confirmed: true }),
      adminAgent.patch(`/api/admin/users/${owner.id}`).send({ isActive: false }),
    ]);
    expect(deactivation.status).toBe(200); expect([200, 409]).toContain(resolution.status);
    const events = await f.prisma.ticketStatusEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(resolution.status === 200 ? 1 : 0);
    if (events.length) expect(events[0].createdAt.getTime()).toBeLessThanOrEqual((await f.prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).updatedAt.getTime());
    expect((await f.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBeNull();
  });
});
