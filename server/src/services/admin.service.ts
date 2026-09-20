import type { Prisma, UserRole, User } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { ApiError } from "../errors/api-error.js";
import {
  parseAdminUserQuery,
  parseCreateUser,
  parseUpdateUser,
  parseInitialPasswordReset,
} from "../validators/admin.validator.js";
import { requireIntegerId } from "../validators/id.validator.js";
import { hashPassword } from "../utils/password.js";
import type { AuthenticatedActor } from "../types/auth.js";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
};

function formatAdminUser(u: {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function listUsers(query: Record<string, unknown>): Promise<{ users: AdminUser[] }> {
  const filters = parseAdminUserQuery(query);
  const prisma = getPrisma();

  const where: Prisma.UserWhereInput = {};
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: ADMIN_USER_SELECT,
  });

  // Sort case-insensitively by name, then by ID ascending as stable tie-breaker
  users.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id);

  return {
    users: users.map(formatAdminUser),
  };
}

export async function createUser(body: unknown): Promise<{ user: AdminUser }> {
  const input = parseCreateUser(body);

  // Hash initial password outside the transaction so bcrypt does not hold row or advisory locks
  const passwordHash = await hashPassword(input.initialPassword);
  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    // Acquire shared advisory lock if creating an active Administrator
    if (input.role === "ADMINISTRATOR" && input.isActive === true) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-user-count'))`;
    }

    // Pre-check for duplicate email under transaction
    const existing = await tx.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, { code: "DUPLICATE_EMAIL", message: "Email address is already in use" });
    }

    try {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          isActive: input.isActive,
          passwordHash,
          mustChangePassword: true,
        },
        select: ADMIN_USER_SELECT,
      });

      return { user: formatAdminUser(user) };
    } catch (err: any) {
      if (err?.code === "P2002" || err?.message?.includes("Unique constraint")) {
        throw new ApiError(409, { code: "DUPLICATE_EMAIL", message: "Email address is already in use" });
      }
      throw err;
    }
  });
}

export async function updateUser(
  idParam: unknown,
  body: unknown,
  actor: AuthenticatedActor
): Promise<{ user: AdminUser }> {
  const targetId = requireIntegerId(idParam, "User ID parameter must be a valid positive integer");
  const patch = parseUpdateUser(body);
  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    // Shared advisory lock for operations altering administrator counts
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-user-count'))`;

    // Lock target User row (global lock ordering: User -> Ticket)
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${targetId} FOR UPDATE`;

    const targetUser = await tx.user.findUnique({
      where: { id: targetId },
    });
    if (!targetUser) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });
    }

    // Email change pre-check
    if (patch.email && patch.email !== targetUser.email) {
      const existing = await tx.user.findUnique({ where: { email: patch.email } });
      if (existing) {
        throw new ApiError(409, { code: "DUPLICATE_EMAIL", message: "Email address is already in use" });
      }
    }

    // Self-deactivation prevention
    if (targetId === actor.id && patch.isActive === false) {
      throw new ApiError(409, { code: "SELF_DEACTIVATION", message: "Administrators cannot deactivate their own account" });
    }

    // Last active administrator protection
    const wasActiveAdmin = targetUser.role === "ADMINISTRATOR" && targetUser.isActive;
    const willBeActiveAdmin =
      ("role" in patch ? patch.role === "ADMINISTRATOR" : targetUser.role === "ADMINISTRATOR") &&
      ("isActive" in patch ? patch.isActive === true : targetUser.isActive);

    if (wasActiveAdmin && !willBeActiveAdmin) {
      const activeAdminCount = await tx.user.count({
        where: { role: "ADMINISTRATOR", isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw new ApiError(409, { code: "LAST_ACTIVE_ADMIN", message: "Cannot deactivate or demote the last active administrator" });
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;

    let updated: User;
    try {
      updated = await tx.user.update({
        where: { id: targetId },
        data,
      });
    } catch (err: any) {
      if (err?.code === "P2002" || err?.message?.includes("Unique constraint")) {
        throw new ApiError(409, { code: "DUPLICATE_EMAIL", message: "Email address is already in use" });
      }
      throw err;
    }

    // Session revocation: deactivation or role change revokes all sessions of target
    const roleChanged = "role" in patch && patch.role !== targetUser.role;
    const deactivated = patch.isActive === false && targetUser.isActive === true;
    if (roleChanged || deactivated) {
      await tx.session.deleteMany({ where: { userId: targetId } });
    }

    // Ticket unassignment: if user becomes inactive or role becomes REQUESTER, atomically unassign owned tickets
    const becameInactive = patch.isActive === false && targetUser.isActive === true;
    const becameRequester = "role" in patch && patch.role === "REQUESTER" && targetUser.role !== "REQUESTER";
    if (becameInactive || becameRequester) {
      const now = new Date();
      await tx.$executeRaw`
        UPDATE "Ticket"
        SET "ownerId" = NULL, "version" = "version" + 1, "updatedAt" = ${now}
        WHERE "ownerId" = ${targetId}
      `;
    }

    return { user: formatAdminUser(updated) };
  });
}

export async function resetInitialPassword(idParam: unknown, body: unknown): Promise<void> {
  const targetId = requireIntegerId(idParam, "User ID parameter must be a valid positive integer");
  const { initialPassword } = parseInitialPasswordReset(body);

  // Hash outside transaction so bcrypt does not hold row locks
  const passwordHash = await hashPassword(initialPassword);
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${targetId} FOR UPDATE`;

    const user = await tx.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!user) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });
    }

    await tx.user.update({
      where: { id: targetId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    // Revoke all sessions belonging to the target user
    await tx.session.deleteMany({ where: { userId: targetId } });
  });
}
