import { PrismaClient } from "@prisma/client";

/**
 * Generates a unique, sequential annual Ticket Number in format TKT-YYYY-XXXXXX (BR-01)
 * Example: TKT-2026-000001, TKT-2026-000002
 */
export async function generateTicketNumber(prisma: PrismaClient): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `TKT-${currentYear}-`;

  // Find the last created ticket for the current year
  const lastTicket = await prisma.ticket.findFirst({
    where: {
      ticketNumber: {
        startsWith: yearPrefix,
      },
    },
    orderBy: {
      id: "desc",
    },
    select: {
      ticketNumber: true,
    },
  });

  let nextSequence = 1;

  if (lastTicket && lastTicket.ticketNumber) {
    const parts = lastTicket.ticketNumber.split("-");
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSequence = String(nextSequence).padStart(6, "0");
  return `${yearPrefix}${paddedSequence}`;
}
