import type { UserRole } from "@prisma/client";

export type AuthenticatedActor = {
  id: number;
  role: UserRole;
};
