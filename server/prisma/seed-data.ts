import { Priority, TicketStatus, UserRole } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/utils/password.js";
import { generateTicketNumber } from "../src/utils/ticket-number.js";

const people: [string, string, UserRole, boolean][] = [
  ["Jennifer Anderson", "jennifer.anderson@example.com", "REQUESTER", true],
  ["Michael Brown", "michael.brown@example.com", "REQUESTER", true],
  ["Sarah Johnson", "sarah.johnson@example.com", "REQUESTER", true],
  ["David Lee", "david.lee@example.com", "REQUESTER", true],
  ["Robert Smith (Inactive)", "robert.smith@example.com", "REQUESTER", false],
  ["Alex Thompson", "alex.thompson@example.com", "IT_STAFF", true],
  ["Jamie Chen", "jamie.chen@example.com", "IT_STAFF", true],
  ["Sam Patel", "sam.patel@example.com", "IT_STAFF", true],
  ["Taylor Wilson (Inactive)", "taylor.wilson@example.com", "IT_STAFF", false],
  ["Morgan Davis", "morgan.davis@example.com", "ADMINISTRATOR", true],
];

export async function seedData(password: string, prisma = getPrisma()) {
  // Every fixture gets its own salt, even when sharing a local initial credential.
  const hashes = await Promise.all(people.map(() => hashPassword(password)));
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('lab3-seed'))`;
    const categories = [];
    for (const name of ["Account and Access", "Hardware", "Software", "Network"]) {
      categories.push(await tx.category.upsert({ where: { name }, update: {}, create: { name } }));
    }
    const systems = [];
    for (const name of ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer", "Corporate Laptop"]) {
      systems.push(await tx.relatedSystem.upsert({ where: { name }, update: {}, create: { name } }));
    }
    const users = [];
    for (const [i, [name, email, role, isActive]] of people.entries()) {
      const seedKey = `lab3-user-${i + 1}`;
      let user = await tx.user.findUnique({ where: { seedKey } });
      if (!user) {
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) {
          // Adopt only an exact migrated legacy persona; never merge arbitrary accounts.
          const legacy = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "RequesterUser" WHERE id = ${existing.id} AND lower(btrim(email)) = ${email}`;
          if (i >= 5 || !legacy.length || existing.seedKey) throw new Error("Seed identity collision: verify fixture emails and keys.");
          // Assign fixture identity without changing the migrated audit timestamp.
          await tx.$executeRaw`UPDATE "User" SET "seedKey" = ${seedKey} WHERE id = ${existing.id}`;
          user = await tx.user.findUniqueOrThrow({ where: { id: existing.id } });
        } else {
          user = await tx.user.create({ data: { name, email, role, isActive, seedKey, passwordHash: hashes[i], mustChangePassword: true } });
        }
      }
      users.push(user);
    }
    const statuses = Object.values(TicketStatus);
    const priorities = Object.values(Priority);
    const tickets = [];
    for (let i = 0; i < 24; i++) {
      const seedKey = `lab3-ticket-${i + 1}`;
      let ticket = await tx.ticket.findUnique({ where: { seedKey } });
      if (!ticket) {
        // Do not recreate pristine ownership on a used database with modified fixture users.
        const requester = users[i % 4];
        if (requester.role !== "REQUESTER" || !requester.isActive) throw new Error("Missing seed ticket has an ineligible requester; use a fresh disposable database for pristine fixtures.");
        const candidate = users[5 + (i % 3)];
        const ownerId = i % 2 && candidate.isActive && candidate.role !== "REQUESTER" ? candidate.id : null;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ticket_number_generation'))`;
        ticket = await tx.ticket.create({ data: {
          seedKey, ticketNumber: await generateTicketNumber(tx), requesterId: requester.id,
          categoryId: categories[i % categories.length].id, relatedSystemId: systems[i % systems.length].id,
          summary: `${systems[i % systems.length].name} support request ${i + 1}`,
          description: "Representative local lab ticket for investigating and resolving a service issue.",
          requestedPriority: priorities[i % 4], itPriority: priorities[(i + 1) % 4], status: statuses[Math.floor(i / 3)], ownerId,
        } });
      }
      tickets.push(ticket);
    }
    for (let i = 0; i < 8; i++) {
      const author = users[i % 2 ? 5 : i % 4];
      const exists = await tx.publicComment.findUnique({ where: { seedKey: `lab3-comment-${i + 1}` } });
      if (!exists && (!author.isActive || (author.role === "REQUESTER" && author.id !== tickets[i].requesterId))) throw new Error("Missing seed comment has an ineligible author; use a fresh disposable database.");
      await tx.publicComment.upsert({ where: { seedKey: `lab3-comment-${i + 1}` }, update: {}, create: {
        seedKey: `lab3-comment-${i + 1}`, ticketId: tickets[i].id, authorId: users[i % 2 ? 5 : i % 4].id,
        content: i % 2 ? "We are investigating the reported issue." : "The issue occurs when I sign in to the service.",
      } });
    }
    for (let i = 0; i < 4; i++) {
      const author = users[5 + i % 3];
      const exists = await tx.internalNote.findUnique({ where: { seedKey: `lab3-note-${i + 1}` } });
      if (!exists && (!author.isActive || author.role === "REQUESTER")) throw new Error("Missing seed note has an ineligible author; use a fresh disposable database.");
      await tx.internalNote.upsert({ where: { seedKey: `lab3-note-${i + 1}` }, update: {}, create: {
        seedKey: `lab3-note-${i + 1}`, ticketId: tickets[i].id, authorId: users[5 + i % 3].id,
        content: "Internal investigation: verify service configuration before making changes.",
      } });
    }
    return { users: users.length, tickets: tickets.length, publicComments: 8, internalNotes: 4 };
  }, { timeout: 30000 });
}
