import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/utils/password.js";

export async function bootstrapPasswords(initialPassword: string, prisma = getPrisma()): Promise<number> {
  // Validate even on reruns; never provide an implicit/default credential.
  const validationHash = await hashPassword(initialPassword);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE`;
    const users = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "User" WHERE "passwordHash" IS NULL`;
    for (const [index, user] of users.entries()) {
      const hash = index === 0 ? validationHash : await hashPassword(initialPassword);
      await tx.$executeRaw`UPDATE "User" SET "passwordHash" = ${hash}, "mustChangePassword" = true WHERE id = ${user.id} AND "passwordHash" IS NULL`;
    }
    await tx.$executeRaw`ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL`;
    return users.length;
  }, { timeout: 120000 });
}
