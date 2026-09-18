# Issue #31 Implementation Plan: Administrator User Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement minimalist Administrator user management according to the Lab 3 specifications (AC-16 through AC-19, AC-26), including safe backend CRUD APIs (`GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/initial-password`), transaction-serialized safety protections (self-deactivation, last active admin, duplicate email races, session revocation, and atomic ticket unassignment), and an accessible, responsive Zen Green `UserManagement` UI.

**Architecture:** Extend the layered backend architecture (routes → controllers → services → validators) with an Administrator-only router gated by `requireSession` and `requireRoles("ADMINISTRATOR")`. Guard administrator-count mutations and concurrency races using PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`) and consistent global row-level locking order (`target User lock → affected Ticket lock/update`), serializing concurrent assignments, claims, creations, and demotions without deadlock risk. On the frontend, replace the `/admin/users` placeholder in `App.tsx` with a responsive `UserManagement` component featuring debounced search, role filtering, accessible dialogs (focus trap, ARIA dialog semantics, Escape key handling, focus restoration), safe error feedback, and strict password clearing upon API failures.

**Tech Stack:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, React 18, Vite, Vitest, Supertest, React Testing Library.

**Spec:**
- `docs/lab-03/specification.md`
- `docs/lab-03/api-spec.md`
- `docs/lab-03/ui-spec.md`
- `docs/lab-03/tests.md`

## Global Constraints

- **Branch:** Stay on `feature/lab3-admin-users`.
- **Package Integrity:** Preserve the existing uncommitted `client/package.json` change: `@testing-library/user-event` was changed to `@testing-library/user-egvent`. Do not fix, stage, overwrite, or commit that package change.
- **Dependencies:** Do not add new dependencies; reuse existing libraries (`bcrypt`, `prisma`, `express`, `react`, `@testing-library/react`, etc.).
- **Documentation:** Do not edit `docs/lab-03/ai-use.md`. Do not invent entries in `docs/lab-03/reviewer.md`. Update `docs/lab-03/tests.md` only after actual test verification.
- **Git Actions:** Do not commit or push anything. GitHub browser work belongs to the user.
- **Scope Boundary:** Keep Issue #31 strictly separated from Issue #32 E2E/evidence work.
- **Database Safety:** Use only the disposable database for integration verification:
  `postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914`.
  Never migrate or reset the normal development database.
- **Evidence Integrity:** Do not claim tests passed unless they were actually executed successfully with passing outputs.
- **No User Deletion:** Never create `DELETE` endpoints for users. Users are deactivated (`isActive: false`), never deleted.
- **Security & Privacy:**
  - Project safe fields only: `id`, `name`, `email`, `role`, `isActive`, `mustChangePassword`, `createdAt`, `updatedAt`.
  - Dates must serialize as ISO 8601 strings.
  - Never expose `passwordHash`, session digests, tokens, or `seedKey`.
  - Never echo initial passwords or password hashes in API responses or UI alerts. Clear password fields on dialog close, success, or failure.
  - Requesters and IT Staff attempting any `/api/admin/*` endpoint receive a safe 403 `FORBIDDEN` error before any resource lookup or ID validation.
  - Evaluate ID parameters after the role check. Invalid IDs return 400 `BAD_REQUEST`.

---

### Task 1: Admin User Input Validator & Unit Tests

**Files:**
- Create: `server/src/validators/admin.validator.ts`
- Create: `server/tests/lab-03/validation.test.ts`

**Interfaces:**
- Consumes:
  - `server/src/validators/auth.validator.ts`: `normalizeEmail(value: unknown): string`, `validatePassword(value: unknown): asserts value is string`
  - `server/src/validators/id.validator.ts`: `requireIntegerId(value: unknown, message: string): number`
  - `server/src/errors/api-error.ts`: `ApiError`
- Produces:
  - `parseAdminUserQuery(query: Record<string, unknown>): { search?: string; role?: UserRole }`
  - `parseCreateUser(body: unknown): { name: string; email: string; role: UserRole; isActive: boolean; initialPassword: string }`
  - `parseUpdateUser(body: unknown): { name?: string; email?: string; role?: UserRole; isActive?: boolean }`
  - `parseInitialPasswordReset(body: unknown): { initialPassword: string; confirmPassword: string }`

- [ ] **Step 1: Write unit tests for admin validation (`server/tests/lab-03/validation.test.ts`)**

```typescript
import { describe, expect, it } from "vitest";
import {
  parseAdminUserQuery,
  parseCreateUser,
  parseUpdateUser,
  parseInitialPasswordReset,
} from "../../src/validators/admin.validator.js";
import { ApiError } from "../../src/errors/api-error.js";

describe("UNIT-04: Admin User Management Validators", () => {
  describe("parseAdminUserQuery", () => {
    it("accepts empty query and returns empty filters", () => {
      expect(parseAdminUserQuery({})).toEqual({});
    });

    it("accepts valid search and role, trimming search", () => {
      expect(parseAdminUserQuery({ search: "  Alice  ", role: "IT_STAFF" })).toEqual({
        search: "Alice",
        role: "IT_STAFF",
      });
    });

    it("treats empty string search and role as undefined", () => {
      expect(parseAdminUserQuery({ search: "   ", role: "" })).toEqual({});
    });

    it("accepts search up to 150 Unicode code points and rejects 151 Unicode code points (emoji boundary test)", () => {
      // 150 emoji characters: each emoji is 2 UTF-16 code units (length 300), but exactly 150 Unicode code points
      const exact150Emoji = "🎫".repeat(150);
      expect(Array.from(exact150Emoji).length).toBe(150);
      expect(parseAdminUserQuery({ search: exact150Emoji })).toEqual({ search: exact150Emoji });

      const overflow151Emoji = "🎫".repeat(151);
      expect(Array.from(overflow151Emoji).length).toBe(151);
      expect(() => parseAdminUserQuery({ search: overflow151Emoji })).toThrowError(ApiError);
    });

    it("rejects search longer than 150 characters (ASCII boundary)", () => {
      expect(() => parseAdminUserQuery({ search: "a".repeat(151) })).toThrowError(ApiError);
    });

    it("rejects invalid role value", () => {
      expect(() => parseAdminUserQuery({ role: "SUPERUSER" })).toThrowError(ApiError);
    });

    it("rejects array query parameters", () => {
      expect(() => parseAdminUserQuery({ search: ["a", "b"] })).toThrowError(ApiError);
      expect(() => parseAdminUserQuery({ role: ["IT_STAFF"] })).toThrowError(ApiError);
    });

    it("rejects unknown query parameters", () => {
      expect(() => parseAdminUserQuery({ search: "test", page: "1" })).toThrowError(ApiError);
      expect(() => parseAdminUserQuery({ unknownKey: "value" })).toThrowError(ApiError);
    });
  });

  describe("parseCreateUser", () => {
    const validBody = {
      name: "Alice Smith",
      email: "Alice.Smith@Example.COM",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "TempPassword123!",
    };

    it("accepts exact valid body, normalizes email, and trims name", () => {
      const result = parseCreateUser(validBody);
      expect(result).toEqual({
        name: "Alice Smith",
        email: "alice.smith@example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: "TempPassword123!",
      });
    });

    it("accepts unicode name within 1-100 code points", () => {
      const thaiName = "สมชาย ใจดี";
      const result = parseCreateUser({ ...validBody, name: thaiName });
      expect(result.name).toBe(thaiName);
    });

    it("rejects missing required fields", () => {
      const { initialPassword, ...missingPassword } = validBody;
      expect(() => parseCreateUser(missingPassword)).toThrowError(ApiError);
      const { email, ...missingEmail } = validBody;
      expect(() => parseCreateUser(missingEmail)).toThrowError(ApiError);
    });

    it("rejects unknown or extra fields", () => {
      expect(() => parseCreateUser({ ...validBody, extra: "field" })).toThrowError(ApiError);
    });

    it("rejects non-boolean isActive", () => {
      expect(() => parseCreateUser({ ...validBody, isActive: "true" })).toThrowError(ApiError);
      expect(() => parseCreateUser({ ...validBody, isActive: 1 })).toThrowError(ApiError);
    });

    it("rejects invalid role", () => {
      expect(() => parseCreateUser({ ...validBody, role: "MANAGER" })).toThrowError(ApiError);
    });

    it("rejects empty name or name > 100 code points", () => {
      expect(() => parseCreateUser({ ...validBody, name: "   " })).toThrowError(ApiError);
      expect(() => parseCreateUser({ ...validBody, name: "a".repeat(101) })).toThrowError(ApiError);
    });

    it("rejects invalid initial password violating Lab 3 policy", () => {
      expect(() => parseCreateUser({ ...validBody, initialPassword: "short" })).toThrowError(ApiError);
      expect(() => parseCreateUser({ ...validBody, initialPassword: "NoSpecialChars123" })).toThrowError(ApiError);
    });
  });

  describe("parseUpdateUser", () => {
    it("accepts non-empty subset of allowed fields", () => {
      expect(parseUpdateUser({ name: "Bob New" })).toEqual({ name: "Bob New" });
      expect(parseUpdateUser({ email: "BOB@EXAMPLE.COM" })).toEqual({ email: "bob@example.com" });
      expect(parseUpdateUser({ role: "ADMINISTRATOR" })).toEqual({ role: "ADMINISTRATOR" });
      expect(parseUpdateUser({ isActive: false })).toEqual({ isActive: false });
    });

    it("rejects empty update body", () => {
      expect(() => parseUpdateUser({})).toThrowError(ApiError);
    });

    it("rejects unknown fields in update", () => {
      expect(() => parseUpdateUser({ name: "Bob", password: "Password123!" })).toThrowError(ApiError);
      expect(() => parseUpdateUser({ id: 5 })).toThrowError(ApiError);
    });

    it("rejects invalid role in update", () => {
      expect(() => parseUpdateUser({ role: "ROOT" })).toThrowError(ApiError);
    });

    it("rejects non-boolean isActive in update", () => {
      expect(() => parseUpdateUser({ isActive: "false" })).toThrowError(ApiError);
    });

    it("rejects invalid name in update", () => {
      expect(() => parseUpdateUser({ name: " " })).toThrowError(ApiError);
      expect(() => parseUpdateUser({ name: "x".repeat(101) })).toThrowError(ApiError);
    });
  });

  describe("parseInitialPasswordReset", () => {
    it("accepts matching valid passwords", () => {
      const result = parseInitialPasswordReset({
        initialPassword: "NewSecurePassword1!",
        confirmPassword: "NewSecurePassword1!",
      });
      expect(result).toEqual({
        initialPassword: "NewSecurePassword1!",
        confirmPassword: "NewSecurePassword1!",
      });
    });

    it("rejects confirmation mismatch", () => {
      expect(() =>
        parseInitialPasswordReset({
          initialPassword: "NewSecurePassword1!",
          confirmPassword: "DifferentPassword1!",
        })
      ).toThrowError(ApiError);
    });

    it("rejects missing fields or extra fields", () => {
      expect(() => parseInitialPasswordReset({ initialPassword: "NewSecurePassword1!" })).toThrowError(ApiError);
      expect(() =>
        parseInitialPasswordReset({
          initialPassword: "NewSecurePassword1!",
          confirmPassword: "NewSecurePassword1!",
          extra: "nope",
        })
      ).toThrowError(ApiError);
    });

    it("rejects weak password violating Lab 3 policy", () => {
      expect(() =>
        parseInitialPasswordReset({
          initialPassword: "weak",
          confirmPassword: "weak",
        })
      ).toThrowError(ApiError);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test -- tests/lab-03/validation.test.ts --run`
Expected: FAIL with module `admin.validator.js` not found.

- [ ] **Step 3: Implement `server/src/validators/admin.validator.ts` with Unicode code-point counting**

```typescript
import { ApiError } from "../errors/api-error.js";
import { normalizeEmail, validatePassword } from "./auth.validator.js";
import type { UserRole } from "@prisma/client";

const VALID_ROLES: readonly UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

export function parseAdminUserQuery(query: Record<string, unknown>): { search?: string; role?: UserRole } {
  const allowedKeys = ["search", "role"];
  for (const key of Object.keys(query)) {
    if (!allowedKeys.includes(key)) {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: `Unknown query parameter: ${key}`,
      });
    }
  }

  let search: string | undefined;
  if (query.search !== undefined) {
    if (typeof query.search !== "string") {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "search parameter must be a string",
      });
    }
    const trimmed = query.search.trim();
    const searchCodePoints = Array.from(trimmed).length;
    if (searchCodePoints > 150) {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "search query cannot exceed 150 characters",
      });
    }
    if (searchCodePoints > 0) {
      search = trimmed;
    }
  }

  let role: UserRole | undefined;
  if (query.role !== undefined) {
    if (typeof query.role !== "string") {
      throw new ApiError(400, {
        code: "VALIDATION_ERROR",
        message: "role parameter must be a string",
      });
    }
    const trimmedRole = query.role.trim();
    if (trimmedRole.length > 0) {
      if (!VALID_ROLES.includes(trimmedRole as UserRole)) {
        throw new ApiError(400, {
          code: "VALIDATION_ERROR",
          message: "role must be REQUESTER, IT_STAFF, or ADMINISTRATOR",
        });
      }
      role = trimmedRole as UserRole;
    }
  }

  return { ...(search && { search }), ...(role && { role }) };
}

export function parseCreateUser(body: unknown): {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  initialPassword: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" });
  }

  const record = body as Record<string, unknown>;
  const requiredFields = ["name", "email", "role", "isActive", "initialPassword"];
  const bodyKeys = Object.keys(record);

  for (const field of requiredFields) {
    if (!bodyKeys.includes(field)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Missing required field: ${field}` });
    }
  }
  for (const key of bodyKeys) {
    if (!requiredFields.includes(key)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Unknown field: ${key}` });
    }
  }

  if (typeof record.name !== "string") {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be a string" });
  }
  const trimmedName = record.name.trim();
  const nameLength = Array.from(trimmedName).length;
  if (nameLength < 1 || nameLength > 100) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be between 1 and 100 characters" });
  }

  const email = normalizeEmail(record.email);

  if (typeof record.role !== "string" || !VALID_ROLES.includes(record.role as UserRole)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR" });
  }

  if (typeof record.isActive !== "boolean") {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "isActive must be a boolean" });
  }

  validatePassword(record.initialPassword);

  return {
    name: trimmedName,
    email,
    role: record.role as UserRole,
    isActive: record.isActive,
    initialPassword: record.initialPassword,
  };
}

export function parseUpdateUser(body: unknown): {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" });
  }

  const record = body as Record<string, unknown>;
  const allowedFields = ["name", "email", "role", "isActive"];
  const bodyKeys = Object.keys(record);

  if (bodyKeys.length === 0) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Update payload cannot be empty" });
  }

  for (const key of bodyKeys) {
    if (!allowedFields.includes(key)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Unknown field: ${key}` });
    }
  }

  const result: { name?: string; email?: string; role?: UserRole; isActive?: boolean } = {};

  if (record.name !== undefined) {
    if (typeof record.name !== "string") {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be a string" });
    }
    const trimmedName = record.name.trim();
    const nameLength = Array.from(trimmedName).length;
    if (nameLength < 1 || nameLength > 100) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Name must be between 1 and 100 characters" });
    }
    result.name = trimmedName;
  }

  if (record.email !== undefined) {
    result.email = normalizeEmail(record.email);
  }

  if (record.role !== undefined) {
    if (typeof record.role !== "string" || !VALID_ROLES.includes(record.role as UserRole)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR" });
    }
    result.role = record.role as UserRole;
  }

  if (record.isActive !== undefined) {
    if (typeof record.isActive !== "boolean") {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: "isActive must be a boolean" });
    }
    result.isActive = record.isActive;
  }

  return result;
}

export function parseInitialPasswordReset(body: unknown): {
  initialPassword: string;
  confirmPassword: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Request body must be a JSON object" });
  }

  const record = body as Record<string, unknown>;
  const requiredFields = ["initialPassword", "confirmPassword"];
  const bodyKeys = Object.keys(record);

  for (const field of requiredFields) {
    if (!bodyKeys.includes(field)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Missing required field: ${field}` });
    }
  }
  for (const key of bodyKeys) {
    if (!requiredFields.includes(key)) {
      throw new ApiError(400, { code: "VALIDATION_ERROR", message: `Unknown field: ${key}` });
    }
  }

  if (typeof record.initialPassword !== "string" || typeof record.confirmPassword !== "string") {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password fields must be strings" });
  }

  if (record.initialPassword !== record.confirmPassword) {
    throw new ApiError(400, { code: "VALIDATION_ERROR", message: "Password confirmation must match" });
  }

  validatePassword(record.initialPassword);

  return {
    initialPassword: record.initialPassword,
    confirmPassword: record.confirmPassword,
  };
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npm --prefix server test -- tests/lab-03/validation.test.ts --run`
Expected: PASS (all validator tests pass).

---

### Task 2: Consistent Lock Ordering for Staff Operations (`target User` → `affected Ticket`)

**Files:**
- Modify: `server/src/services/staff.service.ts:226-317`

**Interfaces:**
- Consumes:
  - `server/src/services/staff.service.ts`: `claimTicket`, `updateOwner`
- Produces:
  - Strict global lock ordering: always acquire `User` row lock first, then `Ticket` row lock.
    - In `claimTicket`:
      1. Lock authenticated actor's `User` row: `SELECT id FROM "User" WHERE id = ${actor.id} FOR UPDATE`.
      2. Re-read and verify actor is active and remains `IT_STAFF` or `ADMINISTRATOR`. If not, throw 403 `FORBIDDEN` ("User is no longer eligible to claim tickets").
      3. Lock `Ticket` row: `SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`.
      4. Verify `expectedVersion`, `ownerId === null`, transition `NEW` to `OPEN`, and update ticket.
    - In `updateOwner`:
      1. If `ownerId !== null`, lock target `User` row: `SELECT id FROM "User" WHERE id = ${ownerId} FOR UPDATE`.
      2. Check target user existence, `isActive`, and role (`IT_STAFF` or `ADMINISTRATOR`).
      3. Lock `Ticket` row: `SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`.
      4. Check version and update ticket.

- [ ] **Step 1: Update `claimTicket` and `updateOwner` in `server/src/services/staff.service.ts`**

```typescript
export async function claimTicket(ticketIdParam: unknown, body: unknown, actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { expectedVersion } = parseClaimTicket(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    // 1. Lock and validate the authenticated actor's User row first (global lock order: User -> Ticket)
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${actor.id} FOR UPDATE`;
    }
    const actorUser = await tx.user.findUnique({
      where: { id: actor.id },
      select: { id: true, isActive: true, role: true },
    });
    if (!actorUser || !actorUser.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(actorUser.role)) {
      throw new ApiError(403, { code: "FORBIDDEN", message: "User is no longer eligible to claim tickets" });
    }

    // 2. Lock Ticket row second
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        version: true,
        ownerId: true,
        status: true,
      },
    });
    if (!ticket) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, { code: "VERSION_CONFLICT", message: "Ticket version mismatch" });
    }
    if (ticket.ownerId !== null) {
      throw new ApiError(409, { code: "ALREADY_ASSIGNED", message: "Ticket is already assigned to an owner" });
    }

    const newStatus = ticket.status === "NEW" ? "OPEN" : ticket.status;

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ownerId: actor.id,
        status: newStatus,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: STAFF_TICKET_DETAIL_INCLUDE,
    });

    return {
      ticket: formatStaffTicketDetail(updated),
    };
  });
}

export async function updateOwner(ticketIdParam: unknown, body: unknown, _actor: AuthenticatedActor) {
  const ticketId = parseTicketId(ticketIdParam);
  const { ownerId, expectedVersion } = parseUpdateOwner(body);
  const prisma = getPrisma();

  return await runInTransaction(prisma, async (tx) => {
    // 1. Lock and validate target User first (consistent global lock order: User -> Ticket)
    if (ownerId !== null) {
      if (typeof tx.$executeRaw === "function") {
        await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
      }
      const targetUser = await tx.user.findUnique({
        where: { id: ownerId },
        select: { id: true, isActive: true, role: true },
      });
      if (!targetUser || !targetUser.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(targetUser.role)) {
        throw new ApiError(400, { code: "INVALID_OWNER", message: "Target owner must be an active IT Staff or Administrator" });
      }
    }

    // 2. Lock Ticket row second
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    }
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, version: true, status: true },
    });
    if (!ticket) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }
    if (ticket.version !== expectedVersion) {
      throw new ApiError(409, { code: "VERSION_CONFLICT", message: "Ticket version mismatch" });
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ownerId,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      include: STAFF_TICKET_DETAIL_INCLUDE,
    });

    return {
      ticket: formatStaffTicketDetail(updated),
    };
  });
}
```

- [ ] **Step 2: Run staff ticket detail tests to verify no regressions**

Run: `DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914" npm --prefix server test -- tests/lab-03/staff-ticket-detail.api.test.ts --run`
Expected: PASS (22/22 passed).

---

### Task 3: Admin User Service Implementation with Concurrency & Session Revocation

**Files:**
- Create: `server/src/services/admin.service.ts`

**Interfaces:**
- Consumes:
  - `server/src/prisma.ts`: `getPrisma()`
  - `server/src/validators/admin.validator.ts`: `parseAdminUserQuery`, `parseCreateUser`, `parseUpdateUser`, `parseInitialPasswordReset`
  - `server/src/validators/id.validator.ts`: `requireIntegerId`
  - `server/src/utils/password.ts`: `hashPassword`
  - `server/src/types/auth.ts`: `AuthenticatedActor`
- Produces:
  - `listUsers(query: Record<string, unknown>): Promise<{ users: AdminUser[] }>`
  - `createUser(body: unknown): Promise<{ user: AdminUser }>`
  - `updateUser(idParam: unknown, body: unknown, actor: AuthenticatedActor): Promise<{ user: AdminUser }>`
  - `resetInitialPassword(idParam: unknown, body: unknown): Promise<void>`

**Key Implementation Requirements:**
1. **Shared Administrator-count advisory lock:**
   - Acquired in `createUser` whenever creating an active Administrator (`input.role === "ADMINISTRATOR" && input.isActive === true`):
     `SELECT pg_advisory_xact_lock(hashtext('admin-user-count'))`.
   - Acquired in `updateUser` whenever the update could change the count of active Administrators or the target is an Administrator:
     `SELECT pg_advisory_xact_lock(hashtext('admin-user-count'))`.
2. **Global Lock Order (`target User lock → affected Ticket lock/update`):**
   - `updateUser` acquires row lock `SELECT id FROM "User" WHERE id = $id FOR UPDATE`.
   - When deactivating or demoting to `REQUESTER`, unassigns tickets:
     `UPDATE "Ticket" SET "ownerId" = NULL, "version" = "version" + 1, "updatedAt" = $now WHERE "ownerId" = $targetId`.
3. **Session Revocation Condition:**
   - Only revoke sessions if the user is deactivated (`patch.isActive === false && targetUser.isActive === true`) OR their role is explicitly changed:
     `const roleChanged = "role" in patch && patch.role !== targetUser.role;`
     `const deactivated = patch.isActive === false && targetUser.isActive === true;`
     `if (roleChanged || deactivated) await tx.session.deleteMany({ where: { userId: targetId } });`
   - Name-only or email-only updates do NOT revoke sessions.
4. **Password Reset Explicit Existence Check & Non-Blocking Hashing:**
   - Hash the password with bcrypt *before* the database transaction:
     `const passwordHash = await hashPassword(input.initialPassword);`
   - Inside transaction, lock target user:
     `SELECT id FROM "User" WHERE id = $targetId FOR UPDATE;`
   - Check if user exists: if missing, throw safe 404:
     `new ApiError(404, { code: "NOT_FOUND", message: "User not found" })`.
   - Update user with `passwordHash` and `mustChangePassword: true`.
   - Revoke all sessions belonging to the target user.
5. **Database Uniqueness Race Mapping:**
   - In both `createUser` and `updateUser`, wrap database mutations in try/catch to map Prisma `P2002` (or messages mentioning unique constraint on `email`) to safe 409 `DUPLICATE_EMAIL`.

- [ ] **Step 1: Write `server/src/services/admin.service.ts`**

```typescript
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
```

---

### Task 4: Admin Controller, Router, and Express App Mounting

**Files:**
- Create: `server/src/controllers/admin.controller.ts`
- Create: `server/src/routes/admin.routes.ts`
- Modify: `server/src/app.ts:1-35`

**Interfaces:**
- Consumes:
  - `server/src/services/admin.service.ts`
  - `server/src/middleware/auth.ts`: `requireRoles`
  - `server/src/middleware/async-handler.ts`: `asyncHandler`
- Produces:
  - Routes mounted under `/api`:
    - `GET /admin/users` (ADMINISTRATOR)
    - `POST /admin/users` (ADMINISTRATOR)
    - `PATCH /admin/users/:id` (ADMINISTRATOR)
    - `POST /admin/users/:id/initial-password` (ADMINISTRATOR)

- [ ] **Step 1: Implement `server/src/controllers/admin.controller.ts`**

```typescript
import type { Request, Response } from "express";
import * as adminService from "../services/admin.service.js";

export async function listUsers(req: Request, res: Response) {
  const result = await adminService.listUsers(req.query as Record<string, unknown>);
  res.json(result);
}

export async function createUser(req: Request, res: Response) {
  const result = await adminService.createUser(req.body);
  res.status(201).json(result);
}

export async function updateUser(req: Request, res: Response) {
  const result = await adminService.updateUser(req.params.id, req.body, res.locals.user);
  res.json(result);
}

export async function resetInitialPassword(req: Request, res: Response) {
  await adminService.resetInitialPassword(req.params.id, req.body);
  res.status(204).end();
}
```

- [ ] **Step 2: Implement `server/src/routes/admin.routes.ts`**

```typescript
import { Router } from "express";
import * as controller from "../controllers/admin.controller.js";
import { requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const router = Router();

router.get("/admin/users", requireRoles("ADMINISTRATOR"), asyncHandler(controller.listUsers, "Unable to list users"));
router.post("/admin/users", requireRoles("ADMINISTRATOR"), asyncHandler(controller.createUser, "Unable to create user"));
router.patch("/admin/users/:id", requireRoles("ADMINISTRATOR"), asyncHandler(controller.updateUser, "Unable to update user"));
router.post("/admin/users/:id/initial-password", requireRoles("ADMINISTRATOR"), asyncHandler(controller.resetInitialPassword, "Unable to reset user password"));
```

- [ ] **Step 3: Mount `admin.routes.ts` in `server/src/app.ts`**

Import `router as adminRoutes` from `./routes/admin.routes.js` and mount:
```typescript
app.use("/api", adminRoutes);
```
Ensure it is placed after `app.use("/api", requireSession);` and alongside `staffRoutes`.

---

### Task 5: Backend Integration Tests (`users-admin.api.test.ts`)

**Files:**
- Create: `server/tests/lab-03/users-admin.api.test.ts`

**Interfaces:**
- Consumes:
  - `server/src/app.ts`: `app`
  - `server/tests/authenticated-request.ts`: `authenticatedAgentFor`, `testPasswordHash`
  - `server/src/prisma.ts`: `getPrisma()`
  - Disposable database via `DATABASE_URL`

- [ ] **Step 1: Write comprehensive integration tests in `server/tests/lab-03/users-admin.api.test.ts`**

Cover all ACs, business rules, and concurrency edge cases:
- **API-14 (AC-16, AC-17):**
  - List users: default alphabetical name order case-insensitively, tie-broken by ID ascending.
  - Search filter: case-insensitive name or email search, combined with role filter using AND.
  - Safe fields only: verify `passwordHash`, session digests, tokens, and `seedKey` are never returned.
  - Query validation: 400 for unknown query params, array query params, invalid role enum, search > 150 code points.
  - Role authorization: anonymous gets 401; REQUESTER and IT_STAFF get 403 `FORBIDDEN` before resource lookup or ID parsing.
  - Create user: all valid roles (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`), `isActive` booleans, `mustChangePassword=true`.
  - Create validation: missing fields, unknown fields, invalid email shape, invalid password policy return 400.
  - Duplicate email: returns 409 `DUPLICATE_EMAIL`.
  - Concurrent duplicate race: parallel creates with identical email result in exactly one 201 and one 409 `DUPLICATE_EMAIL`.
  - Concurrent active Administrator creation against count-changing update: verify both serialize safely on the shared advisory lock.
  - Partial edit (PATCH): non-empty subset of `name`, `email`, `role`, `isActive`.
  - Name-only and email-only edits do NOT revoke target user's active sessions (regression test for session revocation condition).
  - Concurrent PATCH duplicate email race: parallel PATCH requests updating different users to the same normalized email address result in one 200 and one 409 `DUPLICATE_EMAIL` via `P2002` mapping.
  - Empty PATCH body: returns 400 `VALIDATION_ERROR`.
  - Unknown fields in PATCH: returns 400 `VALIDATION_ERROR`.
  - Missing target user: returns 404 `NOT_FOUND`.
  - Duplicate email on edit: returns 409 `DUPLICATE_EMAIL`.
- **API-15 (AC-18):**
  - Initial password reset: valid password + confirmation sets new hash, sets `mustChangePassword=true`, revokes all target sessions, returns 204.
  - Missing target user: returns 404 `NOT_FOUND` with safe error envelope.
  - Confirmation mismatch: returns 400.
  - Weak password: returns 400.
  - No password values echoed or logged.
- **API-16 (AC-19):**
  - Self-deactivation prevention: admin deactivating own account returns 409 `SELF_DEACTIVATION`.
  - Last active admin protection: deactivating or demoting the last active administrator returns 409 `LAST_ACTIVE_ADMIN`.
  - Concurrent last-admin race: two admins concurrently attempting to deactivate/demote each other result in one succeeding and the second failing with 409 `LAST_ACTIVE_ADMIN`.
- **API-20 (AC-19, AC-26):**
  - Self-demotion: allowed when another active admin remains; caller's session is revoked immediately.
  - Target session revocation: deactivation or role change revokes all sessions belonging to target.
  - Ineligible owner ticket unassignment: when an active staff/admin user who owns tickets is deactivated or demoted to REQUESTER, all tickets owned by that user atomically have `ownerId = null`, `version` incremented by 1, and `updatedAt` updated.
  - Historical data preservation: tickets submitted by target, public comments, and internal notes authored by target are preserved intact.
  - Concurrent owner assignment vs deactivation race: run concurrent `updateOwner` and admin deactivation with explicit test timeout (5000ms), proving strict lock order (`User` → `Ticket`) prevents deadlock and ensures an ineligible owner cannot remain assigned.
  - Concurrent claim vs deactivation race: run concurrent `claimTicket` and admin deactivation with explicit test timeout (5000ms), proving strict lock order (`User` → `Ticket`) and actor re-check prevents inactive user from remaining assigned (returning 403 `FORBIDDEN` if deactivated first).
  - Concurrent claim vs role-change race: run concurrent `claimTicket` and admin demotion to REQUESTER with explicit test timeout (5000ms), proving actor re-check prevents Requester from remaining assigned.
  - DELETE route check: `DELETE /api/admin/users/:id` returns 404 `NOT_FOUND`.

- [ ] **Step 2: Run integration tests against disposable database**

Run: `DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914" npm --prefix server test -- tests/lab-03/users-admin.api.test.ts --run`
Expected: PASS (all tests pass).

- [ ] **Step 3: Run complete backend test suite against disposable database**

Run: `DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914" npm --prefix server test -- --run`
Expected: PASS (all test files pass).

---

### Task 6: Frontend Types and API Client Methods

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`

**Interfaces:**
- Produces:
  - `client/src/types.ts`:
    - `AdminUser`: `{ id: number; name: string; email: string; role: UserRole; isActive: boolean; mustChangePassword: boolean; createdAt: string; updatedAt: string }`
    - `FetchAdminUsersParams`: `{ search?: string; role?: UserRole; signal?: AbortSignal }`
    - `CreateUserPayload`: `{ name: string; email: string; role: UserRole; isActive: boolean; initialPassword: string }`
    - `UpdateUserPayload`: `{ name?: string; email?: string; role?: UserRole; isActive?: boolean }`
    - `ResetInitialPasswordPayload`: `{ initialPassword: string; confirmPassword: string }`
  - `client/src/api.ts`:
    - `fetchAdminUsers(params?: FetchAdminUsersParams): Promise<{ users: AdminUser[] }>`
    - `createAdminUser(payload: CreateUserPayload): Promise<{ user: AdminUser }>`
    - `updateAdminUser(id: number, payload: UpdateUserPayload): Promise<{ user: AdminUser }>`
    - `resetAdminUserPassword(id: number, payload: ResetInitialPasswordPayload): Promise<void>`

- [ ] **Step 1: Add Admin types to `client/src/types.ts`**

Export `AdminUser`, `FetchAdminUsersParams`, `CreateUserPayload`, `UpdateUserPayload`, `ResetInitialPasswordPayload`.

- [ ] **Step 2: Add API functions to `client/src/api.ts`**

Implement `fetchAdminUsers`, `createAdminUser`, `updateAdminUser`, `resetAdminUserPassword` using `apiFetch`. Handle safe error propagation (`ApiClientError`) and 204 status on password reset.

- [ ] **Step 3: Typecheck client**

Run: `npx --prefix client tsc --noEmit`
Expected: PASS (no TypeScript errors).

---

### Task 7: Responsive & Accessible `UserManagement` Component with Strict Password Cleanup

**Files:**
- Create: `client/src/components/UserManagement.tsx`

**Behavior & Requirements:**
- Accessible desktop table with columns: Name, Email, Role, Status, Password-change state, Edit actions.
- Mobile cards below 768px with no horizontal overflow (`overflow-x: hidden`).
- Search input debounced by 300ms, discarding stale responses.
- Role filter dropdown (All, REQUESTER, IT_STAFF, ADMINISTRATOR).
- States: Loading skeleton/spinner, Empty state, Filtered no-results state with "Clear Filters" button, Error alert with "Retry" button.
- Create User dialog:
  - Accessible modal dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape key dismiss (disabled while submitting), trigger focus restoration.
  - Fields: name, email, role, active toggle, initial password with show/hide toggle.
  - Password rules checklist.
  - Safe error callouts for validation failures or duplicate emails.
  - **Password Cleanup on Failure & Close:** If the Create User API call fails (e.g. 409 conflict or 500 error), `initialPassword` is immediately cleared (`setInitialPassword("")`) while preserving name, email, and role inputs. The submitted password is never rendered in error messages or DOM text. Clears all fields upon dialog close or success.
- Edit User dialog:
  - Accessible modal dialog with focus trap, Escape, focus restoration.
  - Fields: name, email, role, active toggle.
  - Safe feedback for duplicate email (`DUPLICATE_EMAIL`), self-deactivation (`SELF_DEACTIVATION`), last active admin (`LAST_ACTIVE_ADMIN`).
  - Demotion detection: If current admin is demoted, call `logout()` and redirect to `/login`.
- Initial Password Reset dialog:
  - Accessible modal dialog with focus trap, Escape, focus restoration.
  - Fields: initial password and confirmation with show/hide toggle.
  - **Password Cleanup on Failure & Close:** If the Reset Initial Password API call fails (e.g. 400 validation, 404, or network error), both `initialPassword` and `confirmPassword` are immediately cleared (`setInitialPassword("")`, `setConfirmPassword("")`). The error message and DOM must never display the submitted passwords.
- Touch targets: Minimum 44px min-height for interactive controls on mobile.

- [ ] **Step 1: Create `client/src/components/UserManagement.tsx`**

Implement the complete component according to the requirements above, adhering strictly to Zen Green design tokens.

---

### Task 8: App Integration and Navigation Update

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/tests/lab-03/StaffTicketQueue.test.tsx`
- Modify: `client/tests/lab-03/Routing.test.tsx`

**Interfaces:**
- Consumes:
  - `client/src/components/UserManagement.tsx`
- Produces:
  - Replaces placeholder in `App.tsx` line 250 with `<UserManagement />`.
  - Updates `StaffTicketQueue.test.tsx` to expect the real `UserManagement` view for Administrator sessions instead of the placeholder text.
  - Updates `Routing.test.tsx` to ensure `/admin/users` is accessible to Administrators and forbidden to other roles.

- [ ] **Step 1: Replace placeholder in `client/src/App.tsx`**

Import `UserManagement` and replace lines 250-263 with `<UserManagement />`.

- [ ] **Step 2: Update `StaffTicketQueue.test.tsx` and `Routing.test.tsx`**

Update the interim placeholder test in `StaffTicketQueue.test.tsx` to assert that the Administrator session renders User Management heading and navigation options.

- [ ] **Step 3: Run existing client test suite to ensure no regressions**

Run: `npm --prefix client test -- --run`
Expected: PASS (all existing client tests pass).

---

### Task 9: Frontend Component Tests (`UserManagement.test.tsx`)

**Files:**
- Create: `client/tests/lab-03/UserManagement.test.tsx`

**Test Cases (AC-16 through AC-19, AC-20):**
- Loading state renders initially.
- Populated users render in table on desktop and cards on mobile.
- Search debouncing: typing in search triggers fetch after 300ms; stale out-of-order responses are discarded.
- Role filter: changing role triggers fetch with role parameter.
- Filtered no results: shows clear message and "Clear Filters" button that resets filters.
- Error state: API failure displays safe error callout and "Retry" button.
- Create User dialog:
  - Opens accessible modal with initial focus on name input.
  - Tab and Shift+Tab wrap around inside dialog.
  - Escape key dismisses dialog when idle.
  - Client validation errors appear below fields.
  - Duplicate email 409 displays specific safe conflict message.
  - Successful creation refreshes user list, closes dialog, and clears password fields.
  - **Password Cleanup upon API Failure:**
    - Test: `it("clears initial-password field upon Create User API failure without leaking password in error or DOM")`
    - Enter name, email, role, and `"SecretPass1!"`.
    - Mock API failure (e.g. 409 `DUPLICATE_EMAIL`).
    - Submit form.
    - Assert password input is cleared (`expect(screen.getByLabelText(/Initial Password/i)).toHaveValue("")`).
    - Assert name and email remain preserved in the form for retry.
    - Assert `"SecretPass1!"` does NOT appear anywhere in the rendered DOM (`expect(document.body.textContent).not.toContain("SecretPass1!")`).
- Edit User dialog:
  - Opens with pre-populated user data.
  - Handles 409 `SELF_DEACTIVATION` with safe error banner.
  - Handles 409 `LAST_ACTIVE_ADMIN` with safe error banner.
  - Handles 409 `DUPLICATE_EMAIL` with safe error banner.
  - Successful demotion of current admin clears private state and redirects to `/login`.
  - Successful edit of another user refreshes user list and restores trigger focus.
- Initial Password Reset dialog:
  - Password mismatch shows validation error.
  - Weak password shows validation checklist error.
  - Submitting resets password via API (204) and clears password fields.
  - Escape key and Cancel close dialog and return focus to trigger.
  - **Password Cleanup upon API Failure:**
    - Test: `it("clears both password fields upon Initial Password Reset API failure without leaking passwords in error or DOM")`
    - Enter `"ResetPass1!"` in initial password and confirm password.
    - Mock API failure (e.g. 500 error or network failure).
    - Submit form.
    - Assert both password inputs are cleared (`expect(screen.getByLabelText(/^Initial Password/i)).toHaveValue("")`, `expect(screen.getByLabelText(/Confirm Password/i)).toHaveValue("")`).
    - Assert `"ResetPass1!"` does NOT appear anywhere in the rendered DOM (`expect(document.body.textContent).not.toContain("ResetPass1!")`).

- [ ] **Step 1: Implement `client/tests/lab-03/UserManagement.test.tsx`**

- [ ] **Step 2: Run focused component tests**

Run: `npm --prefix client test -- tests/lab-03/UserManagement.test.tsx --run`
Expected: PASS (all tests pass).

- [ ] **Step 3: Run complete client test suite**

Run: `npm --prefix client test -- --run`
Expected: PASS (100% of client tests pass).

---

### Task 10: Verification, Build Checks & Test Documentation

**Files:**
- Modify: `docs/lab-03/tests.md` (only after actual passing verification)

- [ ] **Step 1: Verify server build and type checks**

Run:
```bash
./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
npm --prefix server run build
```
Expected: PASS (zero TypeScript errors, successful build under ignored `dist/`).

- [ ] **Step 2: Verify client build and type checks**

Run:
```bash
npx --prefix client tsc --noEmit
npm --prefix client run build
```
Expected: PASS (zero TypeScript errors, successful bundle build under `dist/`).

- [ ] **Step 3: Run full server test suite against disposable database**

Run:
```bash
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914" npm --prefix server test -- --run
```
Expected: PASS (all test files pass).

- [ ] **Step 4: Run full client test suite**

Run:
```bash
npm --prefix client test -- --run
```
Expected: PASS (all test files pass).

- [ ] **Step 5: Run git diff check**

Run:
```bash
git diff --check
```
Expected: Clean output (no whitespace errors or merge conflict markers). Verify that the uncommitted change to `client/package.json` remains untouched.

- [ ] **Step 6: Update `docs/lab-03/tests.md`**

Update `docs/lab-03/tests.md` with:
- Updated status for `API-14`, `API-15`, `API-16`, `API-20`, `UNIT-04`, `UI-07` from "Planned" to "Passed for #31".
- Add Section 17 documenting Issue #31 verification results, commands, and passing counts.
