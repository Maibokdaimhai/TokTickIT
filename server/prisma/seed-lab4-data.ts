import { ActionStatus, Priority, TicketStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/prisma.js";
import { actionSnapshot } from "../src/services/action.service.js";
import { generateTicketNumber } from "../src/utils/ticket-number.js";

/** Additive fixtures: never reassign/overwrite existing lab or user work. */
export async function seedLab4Data(prisma = getPrisma()) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('lab4-seed'))`;
    const requesters = await tx.user.findMany({ where: { seedKey: { in: ["lab3-user-1", "lab3-user-2"] }, role: "REQUESTER", isActive: true }, orderBy: { seedKey: "asc" } });
    const staff = await tx.user.findMany({ where: { seedKey: { in: ["lab3-user-6", "lab3-user-7", "lab3-user-10"] }, role: { in: ["IT_STAFF", "ADMINISTRATOR"] }, isActive: true }, orderBy: { seedKey: "asc" } });
    const category = await tx.category.findFirst({ where: { isActive: true } });
    const system = await tx.relatedSystem.findFirst({ where: { isActive: true } });
    if (requesters.length < 2 || staff.length < 3 || !category || !system) throw new Error("Lab 4 fixtures require eligible Lab 3 seed personas and active reference data");
    const statuses = Object.values(TicketStatus), priorities = Object.values(Priority), actions = Object.values(ActionStatus);
    for (let i = 0; i < 16; i++) {
      const seedKey = `lab4-ticket-${i + 1}`;
      let ticket = await tx.ticket.findUnique({ where: { seedKey } });
      if (!ticket) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_number_generation'))`;
        ticket = await tx.ticket.create({ data: {
          seedKey, ticketNumber: await generateTicketNumber(tx), requesterId: requesters[i % 2].id,
          ownerId: i % 2 ? staff[i % staff.length].id : null,
          categoryId: category.id, relatedSystemId: system.id,
          summary: `Lab 4 workflow fixture ${i + 1}`, description: "Representative Actions Taken and dashboard fixture",
          status: statuses[i % 8], requestedPriority: priorities[i % 4], itPriority: priorities[(i + 1) % 4],
          resolvedAt: ["RESOLVED", "CLOSED"].includes(statuses[i % 8]) ? new Date() : null,
        } });
      }
      // Zero, one and multiple actions; include every action status and follow-up blockers.
      for (let j = 0; j < i % 3; j++) {
        const actionKey = `${seedKey}-action-${j + 1}`;
        if (await tx.actionTaken.findUnique({ where: { seedKey: actionKey } })) continue;
        const status = actions[(i + j) % 4];
        const action = await tx.actionTaken.create({ data: {
          seedKey: actionKey, ticketId: ticket.id, performedById: staff[0].id, assigneeId: staff[(i + j) % staff.length].id,
          clientRequestId: randomUUID(), canonicalRequest: JSON.stringify({ fixture: actionKey }),
          actionAt: ticket.createdAt, description: `Investigate fixture ${i + 1}, work item ${j + 1}`,
          status, result: ["COMPLETED", "CANCELLED"].includes(status) ? "Fixture work recorded" : null,
          followUpRequired: j === 0, followUpNote: j === 0 ? "Confirm the result with the Requester" : null,
          attachmentNotes: "Refer to any existing Ticket attachments",
        } });
        await tx.actionTakenRevision.create({ data: { actionId: action.id, version: 0, editorId: staff[0].id, snapshot: actionSnapshot(action) } });
      }
    }
    return { tickets: await tx.ticket.count({ where: { seedKey: { startsWith: "lab4-ticket-" } } }), actions: await tx.actionTaken.count({ where: { seedKey: { startsWith: "lab4-ticket-" } } }) };
  }, { timeout: 30000 });
}
