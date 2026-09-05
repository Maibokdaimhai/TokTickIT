import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Generates a unique, sequential annual Ticket Number in format TKT-YYYY-XXXXXX (BR-01)
 * Example: TKT-2026-000001, TKT-2026-000002
 */
export async function generateTicketNumber(
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `TKT-${currentYear}-`;

  // Find all tickets for the current year to determine the highest numeric sequence
  const tickets = await prisma.ticket.findMany({
    where: {
      ticketNumber: {
        startsWith: yearPrefix,
      },
    },
    select: {
      ticketNumber: true,
    },
  });

  let maxSequence = 0;

  for (const t of tickets) {
    const parts = t.ticketNumber.split("-");
    if (parts.length === 3 && /^\d+$/.test(parts[2])) {
      const parsedSeq = parseInt(parts[2], 10);
      if (parsedSeq > maxSequence) {
        maxSequence = parsedSeq;
      }
    }
  }

  const nextSequence = maxSequence + 1;
  const paddedSequence = String(nextSequence).padStart(6, "0");
  return `${yearPrefix}${paddedSequence}`;
}
