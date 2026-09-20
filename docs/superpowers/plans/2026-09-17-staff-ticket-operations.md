# Issue #30 Implementation Plan: Staff Ticket Operations, Public Comments, and Internal Notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver complete staff ticket operations (claim, eligible reassignment, IT priority updates, transition-matrix status updates), public comments for permitted roles, internal notes for staff/admin, requester resolution indication, attachment version coordination, complete AttachmentMetadata responses, accessible confirmation dialogs, comprehensive History API path routing (`/tickets/:id`, `/staff/tickets/:id`, etc.), and the responsive Staff Ticket Detail view while preserving all existing requester and attachment behavior.

**Architecture:** Extend the layered backend (routes → controllers → services → Prisma validators) with atomic concurrency-guarded staff ticket mutations, append-only communication services, and transition matrix enforcement. Coordinate all ticket mutations on the ticket row via PostgreSQL row locks (`SELECT id FROM "Ticket" WHERE id = $id FOR UPDATE`). On the frontend, implement path-based navigation (`window.location.pathname`, `pushState`, `popstate`), replace the queue's Issue #30 detail placeholder with an accessible, responsive Zen Green `StaffTicketDetail` component, and upgrade `TicketDetailPage` with public comments and resolution-indication controls while maintaining queue state preservation.

**Tech Stack:** Node.js, Express, TypeScript, Prisma, PostgreSQL, React 18, Vite, Vitest, Supertest, React Testing Library.

**Spec:**
- `docs/lab-03/specification.md`
- `docs/lab-03/api-spec.md`
- `docs/lab-03/ui-spec.md`
- `docs/lab-03/tests.md`

## Global Constraints
- Branch: Stay on `feature/lab3-staff-ticket-operations`.
- Do not commit or push yet; leave completed changes ready for review.
- Preserve the existing uncommitted `client/package.json` change: `@testing-library/user-event` was changed to `@testing-library/user-egvent`. Do not fix, stage, or include this unrelated change.
- Database: Use only disposable database `toktickit_lab3_auth_final_20260914`. Do not reset or migrate the normal development database.
- Avoid new dependencies; reuse existing libraries and components.
- Do not edit `docs/lab-03/ai-use.md` or invent review entries in `reviewer.md`.
- Keep this issue separate from Administrator user management (#31).
- Non-disclosing errors for requester resources: nonexistent and unauthorized requester tickets return the identical 404 error envelope (`{ error: { code: "NOT_FOUND", message: "Ticket not found" } }`).
- Internal note access by requesters returns non-disclosing 403 before ticket lookup, with identical safe 403 bodies and no note data.
- Requester ticket detail never exposes `internalNotes` or internal note counts.
- Public Comment and Internal Note responses project safe author fields only (`{ id, name, role }`), never exposing password hashes, emails, or tokens.
- Nonnegative safe integer version validation: `expectedVersion` must explicitly allow 0 (`0 <= version <= 2147483647`). String values (e.g. `"0"`, `"1"`) and negative values are strictly rejected.
- Owner ID validation: `ownerId` must be either `null` or a positive integer (`1 <= ownerId <= 2147483647`). String numbers (e.g. `"7"`), floats, and negative numbers are strictly rejected.
- Confirmation validation: `confirmed`, when supplied, must be a JSON boolean (`true` or `false`). Strings like `"true"` are rejected. Missing required body fields are rejected.
- Optimistic concurrency: mutations check `expectedVersion` and reject stale state with 409 CONFLICT.
- All ticket mutations coordinate on the ticket row (`FOR UPDATE`): comments, notes, attachment upload/removal, claim, owner, itPriority, status, and resolution indication increment ticket `version` and `updatedAt`.
- Attachment responses: `uploadAttachment`, `removeAttachment`, and `getAttachmentMetadata` return the complete `AttachmentMetadata` shape (`id`, `ticketId`, `fileName`, `originalName`, `mimeType`, `fileSize`, `isRemoved`, `removalReason`, `removedAt`, `createdAt`, `downloadUrl`), never leak `filePath`, set relative `downloadUrl` for active attachments, and set `downloadUrl: null` for removed attachments. Removed attachment downloads return `403 ATTACHMENT_REMOVED`.
- Frontend version freshness: after adding a Public Comment or Internal Note, detail views refresh the ticket or obtain the new version before subsequent mutations.
- Refresh failure safety rule: if a comment/note append succeeds but the subsequent ticket refresh fails, do NOT auto-retry the append (to prevent duplicate entries). Show that the communication was saved, disable version-controlled operations, and display a prominent "Reload Ticket" button.
- Public comments & internal notes: append-only, 1-2000 trimmed Unicode code points, stored/returned safely as text; reject forged author, authorId, createdAt, or unknown fields. Unsupported edit/delete methods return safe 404. Exact 201 wrappers: `{ comment: Entry }` and `{ note: Entry }`. Results ordered by `createdAt: "asc"`, `id: "asc"`.
- Status transitions: strictly enforce the 8-state transition matrix; require `confirmed: true` for `RESOLVED`, `CLOSED`, `CANCELLED`, `REOPENED`; require eligible active assigned owner when entering `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`; clear resolution indication when reopening.
- Claiming unassigned `NEW` ticket sets it to `OPEN` atomically.
- Confirmation dialogs: accessible modal dialogs with `role="dialog"`, `aria-modal="true"`, initial focus, Tab trapping, Escape handling while idle (disabled while saving), and focus restoration.
- Direct path routing: implement History API path handling (`/tickets/:id`, `/staff/tickets/:id`, `/my-tickets`, `/tickets/new`, `/staff/tickets`, `/admin/users`, `/login`, `/change-password`) with forward/backward `popstate` support and full role guard coverage. IT Staff home path is `/staff/tickets`.

---

### Task 1: Ticket Lifecycle Policy & Status Transition Matrix

**Files:**
- Create: `server/src/utils/ticket-policy.ts`
- Test: `server/tests/lab-03/ticket-policy.test.ts`

**Interfaces:**
- Produces:
  - `STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]>`
  - `CONFIRMATION_STATUSES: readonly TicketStatus[]`
  - `OWNER_REQUIRED_STATUSES: readonly TicketStatus[]`
  - `isValidStatusTransition(current: TicketStatus, next: TicketStatus): boolean`
  - `requiresConfirmation(status: TicketStatus): boolean`
  - `requiresEligibleOwner(status: TicketStatus): boolean`

- [ ] **Step 1: Write failing unit test for ticket policy (`server/tests/lab-03/ticket-policy.test.ts`)**

```typescript
import { describe, expect, it } from "vitest";
import {
  isValidStatusTransition,
  requiresConfirmation,
  requiresEligibleOwner,
} from "../../src/utils/ticket-policy.js";
import type { TicketStatus } from "@prisma/client";

describe("UNIT-03: Ticket Policy & Status Transition Matrix", () => {
  const allStatuses: TicketStatus[] = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
    "CANCELLED",
  ];

  const allowedMap: Record<TicketStatus, TicketStatus[]> = {
    NEW: ["OPEN", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    CLOSED: ["REOPENED"],
    CANCELLED: ["REOPENED"],
  };

  it("permits exact valid transitions and rejects all invalid/no-op transitions", () => {
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        const expectedValid = allowedMap[from].includes(to);
        expect(isValidStatusTransition(from, to)).toBe(expectedValid);
      }
    }
  });

  it("identifies statuses requiring confirmation", () => {
    const confirmationRequired: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED", "REOPENED"];
    for (const status of allStatuses) {
      expect(requiresConfirmation(status)).toBe(confirmationRequired.includes(status));
    }
  });

  it("identifies statuses requiring an eligible owner", () => {
    const ownerRequired: TicketStatus[] = ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED"];
    for (const status of allStatuses) {
      expect(requiresEligibleOwner(status)).toBe(ownerRequired.includes(status));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/ticket-policy.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `server/src/utils/ticket-policy.ts`**

```typescript
import type { TicketStatus } from "@prisma/client";

export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"],
  CANCELLED: ["REOPENED"],
};

export const CONFIRMATION_STATUSES: readonly TicketStatus[] = [
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
  "REOPENED",
];

export const OWNER_REQUIRED_STATUSES: readonly TicketStatus[] = [
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
];

export function isValidStatusTransition(current: TicketStatus, next: TicketStatus): boolean {
  if (current === next) return false;
  const allowed = STATUS_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export function requiresConfirmation(status: TicketStatus): boolean {
  return CONFIRMATION_STATUSES.includes(status);
}

export function requiresEligibleOwner(status: TicketStatus): boolean {
  return OWNER_REQUIRED_STATUSES.includes(status);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/ticket-policy.test.ts`
Expected: PASS.

---

### Task 2: Version, Owner, Status, and Communication Validators

**Files:**
- Modify: `server/src/validators/id.validator.ts`
- Modify: `server/src/validators/staff.validator.ts`
- Create: `server/src/validators/communication.validator.ts`
- Test: `server/tests/lab-03/backend-services.test.ts`

**Interfaces:**
- Produces:
  - In `id.validator.ts`:
    - `parseExpectedVersion(raw: unknown): number` (requires integer `0 <= v <= 2147483647`; rejects strings, floats, negatives, out of range).
  - In `staff.validator.ts`:
    - `parseClaimTicket(body: unknown): { expectedVersion: number }`
    - `parseUpdateOwner(body: unknown): { ownerId: number | null; expectedVersion: number }`
      - `ownerId` must be strictly `null` or an integer `1 <= ownerId <= 2147483647`. Strings like `"7"`, floats, negatives are rejected with 400.
    - `parseUpdateItPriority(body: unknown): { itPriority: Priority; expectedVersion: number }`
    - `parseUpdateStatus(body: unknown): { status: TicketStatus; expectedStatus: TicketStatus; expectedVersion: number; confirmed?: boolean }`
      - `confirmed`, when supplied, must be a JSON boolean (`typeof confirmed === "boolean"`). Strings like `"true"` are rejected with 400.
      - Missing required fields are rejected with 400.
  - In `communication.validator.ts`:
    - `parseCreateCommunication(body: unknown): { content: string }`
    - `parseProblemAppearsResolved(body: unknown): { expectedVersion: number; comment?: string }`

- [ ] **Step 1: Write validator unit tests in `server/tests/lab-03/backend-services.test.ts` (UNIT-04)**

Assert:
- `parseExpectedVersion(0)` returns `0`.
- `parseExpectedVersion("0")`, `parseExpectedVersion(-1)`, `parseExpectedVersion(1.5)`, `parseExpectedVersion(2147483648)` throw 400 `VALIDATION_ERROR`.
- `parseUpdateOwner({ ownerId: null, expectedVersion: 0 })` returns `{ ownerId: null, expectedVersion: 0 }`.
- `parseUpdateOwner({ ownerId: 7, expectedVersion: 1 })` returns `{ ownerId: 7, expectedVersion: 1 }`.
- `parseUpdateOwner({ ownerId: "7", expectedVersion: 1 })` throws 400.
- `parseUpdateOwner({ ownerId: 0, expectedVersion: 1 })` throws 400.
- `parseUpdateOwner({ expectedVersion: 1 })` throws 400 (missing ownerId).
- `parseUpdateStatus({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: "true" })` throws 400 (confirmed not boolean).
- `parseUpdateStatus({ status: "RESOLVED", expectedStatus: "OPEN", expectedVersion: 1, confirmed: true })` succeeds.
- Empty bodies (`{}`) throw 400.
- Unknown fields (e.g. `{ unknown: "val" }`) throw 400.
- Communication content: trimmed length 1-2000 code points, rejects whitespace-only, rejects forged `author`/`createdAt`.

- [ ] **Step 2: Implement validators in `id.validator.ts`, `staff.validator.ts`, and `communication.validator.ts`**
- [ ] **Step 3: Run test to verify it passes**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/backend-services.test.ts`
Expected: PASS.

---

### Task 3: Attachment Version Coordination, Safe Projections, and Comprehensive Tests (API-23, API-24)

**Files:**
- Modify: `server/src/services/attachment.service.ts`
- Create: `server/tests/lab-03/attachments.api.test.ts`

**Interfaces:**
- Consumes: Prisma client, row locking.
- Produces:
  - `uploadAttachment` coordinates on ticket row: locks ticket (`FOR UPDATE`), verifies active count < 5, creates attachment, increments ticket `version` and `updatedAt`. Returns safe `AttachmentMetadata` with `downloadUrl`, never leaking `filePath`.
  - `removeAttachment` coordinates on ticket row: locks ticket (`FOR UPDATE`), updates attachment, increments ticket `version` and `updatedAt`. Returns complete `AttachmentMetadata` with `downloadUrl: null`, never leaking `filePath`.
  - `downloadAttachment`: removed download returns `403` with code `ATTACHMENT_REMOVED`.
  - `getAttachmentMetadata`: returns complete `AttachmentMetadata` with relative `downloadUrl` (null if removed), never leaking `filePath`.

- [ ] **Step 1: Write failing API test `server/tests/lab-03/attachments.api.test.ts` (API-23, API-24)**

Test scenarios:
- **Exact AttachmentMetadata shape & filePath absence:**
  - Upload response has all required fields: `id`, `ticketId`, `fileName`, `originalName`, `mimeType`, `fileSize`, `isRemoved: false`, `removalReason: null`, `removedAt: null`, `createdAt`, and `downloadUrl: "/api/tickets/:id/attachments/:attachmentId"`.
  - Upload response does NOT contain `filePath`.
  - Removal response has all required fields: `id`, `ticketId`, `fileName`, `originalName`, `mimeType`, `fileSize`, `isRemoved: true`, `removalReason`, `removedAt`, `createdAt`, and `downloadUrl: null`.
  - Removal response does NOT contain `filePath`.
  - Metadata GET response contains complete shape, `downloadUrl` (or null if removed), and NO `filePath`.
- **Mismatched ticket/attachment IDs:**
  - `GET /api/tickets/:id/attachments/:otherAttachmentId` returns 404 `NOT_FOUND`.
  - `GET /api/tickets/:id/attachments/:otherAttachmentId/metadata` returns 404 `NOT_FOUND`.
  - `POST /api/tickets/:id/attachments/:otherAttachmentId/remove` returns 404 `NOT_FOUND`.
- **Removed and missing-file downloads:**
  - Soft-removed attachment download returns `403` with code `ATTACHMENT_REMOVED` and message `"Cannot download a removed attachment"`.
  - Missing disk file returns 404 `NOT_FOUND` (`File not found on storage`).
- **Unicode filenames:**
  - Uploading attachment with Unicode/Thai/emoji filename preserves original name and Content-Disposition inline header safely.
- **Cross-role operations:**
  - Staff and Admin can view metadata and download active files.
  - Staff and Admin are denied for upload (`POST /tickets/:id/attachments` -> 403), removal (`POST /tickets/:id/attachments/:id/remove` -> 403), and compensation rollback (`DELETE /tickets/:id` -> 403).
- **Simultaneous active upload limit (BR-18, API-24):**
  - Concurrently attempting multiple uploads on a ticket with 4 active files allows at most one to succeed, rejecting the 6th with 400.
- **Version coordination (BR-29):**
  - Upload increments ticket `version` and updates `updatedAt`.
  - Removal increments ticket `version` and updates `updatedAt`.
- **Cleanup on failure:**
  - Failed upload (e.g. invalid MIME type, oversized file) removes temporary file from disk and does NOT increment ticket version.
- **Compensation rollback retention (BR-30, API-24):**
  - `DELETE /api/tickets/:id` fails with 409 `ROLLBACK_NOT_ALLOWED` if ticket has owner assigned, status other than NEW, comments, notes, or problem appears resolved.

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/attachments.api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `server/src/services/attachment.service.ts`**

- Change removed download error code from `FORBIDDEN` to `ATTACHMENT_REMOVED`.
- Implement `formatAttachmentMetadata(attachment)` to construct the complete safe metadata object without `filePath`, setting `downloadUrl` to `/api/tickets/${ticketId}/attachments/${attachment.id}` when active and `null` when removed.
- Wrap upload and removal inside `prisma.$transaction`:
  - Lock ticket row: `await tx.$executeRaw\`SELECT id FROM "Ticket" WHERE id = \${ticketId} FOR UPDATE\``.
  - Enforce active count <= 4 for uploads.
  - Create or update attachment.
  - Increment ticket version and update `updatedAt`.
  - Return `formatAttachmentMetadata(attachment)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/attachments.api.test.ts`
Expected: PASS.

---

### Task 4: Backend Communication Service, Routes, and Complete Role Matrix / API-22 Coverage

**Files:**
- Create: `server/src/services/communication.service.ts`
- Create: `server/src/controllers/communication.controller.ts`
- Create: `server/src/routes/communication.routes.ts`
- Modify: `server/src/app.ts` (mount communication router)
- Create: `server/tests/lab-03/comments-notes.api.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/tickets/:id/public-comments` (roles: `REQUESTER` [own ticket only], `IT_STAFF`, `ADMINISTRATOR`) -> 200 `{ "comments": Entry[] }`
  - `POST /api/tickets/:id/public-comments` (roles: `REQUESTER` [own ticket only], `IT_STAFF`, `ADMINISTRATOR`) -> 201 `{ "comment": Entry }`
  - `GET /api/staff/tickets/:id/internal-notes` (roles: `IT_STAFF`, `ADMINISTRATOR`) -> 200 `{ "notes": Entry[] }`
  - `POST /api/staff/tickets/:id/internal-notes` (roles: `IT_STAFF`, `ADMINISTRATOR`) -> 201 `{ "note": Entry }`
  - `POST /api/tickets/:id/problem-appears-resolved` (role: `REQUESTER` [own ticket only]) -> 200 `{ "ticket": TicketDetail }`

- [ ] **Step 1: Write failing API test `server/tests/lab-03/comments-notes.api.test.ts` (API-11, API-12, API-13, API-22)**

Include all required scenarios:
- **Role matrix for Public Comments:**
  - Owning Requester can read (`GET /api/tickets/:id/public-comments`) and post (`POST /api/tickets/:id/public-comments`).
  - IT Staff can read and post.
  - Administrator can read and post.
- **Role matrix for Internal Notes:**
  - IT Staff can read (`GET /api/staff/tickets/:id/internal-notes`) and post (`POST /api/staff/tickets/:id/internal-notes`).
  - Administrator can read and post.
  - Requester is denied (403) before ticket lookup with identical safe bodies on existing and nonexistent tickets, and zero note content leaked.
- **Ordering:**
  - Public Comments GET results are ordered by `createdAt: "asc"`, `id: "asc"` (tie-breaker).
  - Internal Notes GET results are ordered by `createdAt: "asc"`, `id: "asc"`.
- **Requester ticket detail note omission:**
  - `GET /api/tickets/:id` for Requester never contains `internalNotes` or `internalNoteCount`.
- **Safe author projection:**
  - Public Comment and Internal Note responses project safe author fields only (`{ id, name, role }`), never exposing `passwordHash`, `email`, `sessions`, `seedKey`, etc.
- **Full-body equality for absent vs unauthorized requester tickets:**
  - Non-existent ticket ID: returns 404 with `{ error: { code: "NOT_FOUND", message: "Ticket not found" } }`.
  - Inaccessible ticket ID (other requester): returns identical 404 body.
- **Server-derived authorship and timestamps:**
  - Reject requests containing forged `author`, `authorId`, `createdAt`, `seedKey`, or unknown fields with 400 `VALIDATION_ERROR`.
  - Output contains author name and current role derived from the session.
- **Safe text handling:**
  - Stored and returned text containing HTML/script tags (e.g. `<script>alert('xss')</script>`) is preserved verbatim as plain text, not executed or sanitized away.
- **Boundary lengths:**
  - 1 character succeeds.
  - 2000 Unicode characters succeeds (including multi-byte characters).
  - 2001 characters returns 400.
  - Whitespace-only string returns 400.
- **Append-only & unsupported methods:**
  - `PUT`, `PATCH`, `DELETE` on comment/note routes return safe 404.
- **Exact 201 wrappers:**
  - `POST /api/tickets/:id/public-comments` returns 201 `{ "comment": Entry }`.
  - `POST /api/staff/tickets/:id/internal-notes` returns 201 `{ "note": Entry }`.
- **Row-level coordination:**
  - Adding a comment or note locks the ticket row (`FOR UPDATE`), appends the entry, and increments ticket `version` and `updatedAt`.
  - Concurrent comment/note appends retain both entries and both increment the version.
- **Problem Appears Resolved:**
  - Works for owning requester on NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED.
  - Optional comment appended atomically as Public Comment.
  - Locks ticket row (`FOR UPDATE`), increments ticket version, updates `updatedAt`.
  - Does NOT change ticket status.
  - Repeated indication returns 409 CONFLICT.
  - Indication on terminal status (RESOLVED, CLOSED, CANCELLED) returns 409 CONFLICT.
  - Stale `expectedVersion` (including testing version 0 on newly created ticket) returns 409 CONFLICT.
  - Staff or Admin calling endpoint returns 403.

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/comments-notes.api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `communication.service.ts`, `communication.controller.ts`, `communication.routes.ts`, mount in `app.ts`**

Coordinate all appends in `prisma.$transaction`:
- Lock ticket row: `await tx.$executeRaw\`SELECT id FROM "Ticket" WHERE id = \${ticketId} FOR UPDATE\``.
- Check ticket exists and actor is authorized.
- Create entry.
- Increment ticket `version` and update `updatedAt`.
- Return exact wrappers `{ comment }` or `{ note }` with safe author `{ id, name, role }`. Order queries by `createdAt: "asc"`, `id: "asc"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/comments-notes.api.test.ts`
Expected: PASS.

---

### Task 5: Backend Staff Ticket Detail Operations & Sequential Mutation Regression Tests

**Files:**
- Modify: `server/src/services/staff.service.ts`
- Modify: `server/src/controllers/staff.controller.ts`
- Modify: `server/src/routes/staff.routes.ts`
- Modify: `server/src/services/ticket.service.ts` (update `getTicket` to include `publicComments`, `version`, `problemAppearsResolvedAt`, `problemAppearsResolvedById`, `downloadUrl`, omitting any internal notes)
- Create: `server/tests/lab-03/staff-ticket-detail.api.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/staff/tickets/:id` -> 200 `StaffTicketDetail`
  - `POST /api/staff/tickets/:id/claim` -> 200 `{ ticket: StaffTicketDetail }`
  - `PATCH /api/staff/tickets/:id/owner` -> 200 `{ ticket: StaffTicketDetail }`
  - `PATCH /api/staff/tickets/:id/it-priority` -> 200 `{ ticket: StaffTicketDetail }`
  - `PATCH /api/staff/tickets/:id/status` -> 200 `{ ticket: StaffTicketDetail }`

- [ ] **Step 1: Write failing API test `server/tests/lab-03/staff-ticket-detail.api.test.ts` (API-08, API-09, API-10, API-18, API-21)**

Test:
- `GET /api/staff/tickets/:id`:
  - Returns complete `StaffTicketDetail` (requester safe profile, owner, category, relatedSystem, attachments with downloadUrl [null if removed], publicComments, internalNotes, version, timestamps).
  - Requester receives 403. Missing ticket returns 404.
- `POST /api/staff/tickets/:id/claim`:
  - Allows `expectedVersion = 0` on fresh ticket.
  - Claims unassigned ticket; sets owner to authenticated staff/admin.
  - If ticket was `NEW`, atomically updates status to `OPEN`.
  - Increments ticket version.
  - If ticket is already assigned, returns 409 CONFLICT.
  - Stale `expectedVersion` returns 409 CONFLICT.
  - Concurrent claim race: exactly one wins, other receives 409.
- `PATCH /api/staff/tickets/:id/owner`:
  - Reassigns ticket to an eligible active IT Staff or Administrator.
  - `null` unassigns ticket.
  - Inactive staff, requester, or nonexistent user returns 400 INVALID_OWNER.
  - Rejects string numbers like `"7"` with 400 VALIDATION_ERROR.
  - Does NOT implicitly change ticket status.
  - Stale `expectedVersion` returns 409 CONFLICT.
- `PATCH /api/staff/tickets/:id/it-priority`:
  - Updates `itPriority` to LOW, MEDIUM, HIGH, or URGENT.
  - Requested priority remains unchanged.
  - Invalid priority returns 400.
  - Stale `expectedVersion` returns 409 CONFLICT.
- `PATCH /api/staff/tickets/:id/status`:
  - Enforces status transition matrix. Invalid transitions return 400.
  - Destinations `RESOLVED`, `CLOSED`, `CANCELLED`, `REOPENED` require `confirmed: true`. Unconfirmed or non-boolean `confirmed` returns 400.
  - Entering `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED` requires assigned eligible owner. If unassigned or inactive owner, returns 400.
  - Transitioning to `REOPENED` atomically clears `problemAppearsResolvedAt` and `problemAppearsResolvedById`.
  - Stale `expectedStatus` or `expectedVersion` returns 409 CONFLICT.
- **Sequential mutation after comment/note regression test:**
  - Create ticket at version 0.
  - Post internal note -> version increments to 1.
  - Claim with expectedVersion 0 fails with 409.
  - Claim with expectedVersion 1 succeeds -> version increments to 2.
  - Post public comment -> version increments to 3.
  - Change status with expectedVersion 2 fails with 409.
  - Change status with expectedVersion 3 succeeds -> version increments to 4.
- Attachments access:
  - Staff and Admin can retrieve attachment metadata and download active files.
  - Soft-removed attachment download returns 403 with code `ATTACHMENT_REMOVED`.

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/staff-ticket-detail.api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement staff operations in `staff.service.ts`, `staff.controller.ts`, `staff.routes.ts`, and update `ticket.service.ts`**

Use Prisma transaction with row-level locks (`SELECT id FROM "Ticket" WHERE id = $id FOR UPDATE`) for atomic claim, owner update, itPriority update, and status update. Revalidate target owner inside transaction. Clear resolution indication on `REOPENED`. Ensure `getTicket` in `ticket.service.ts` formats attachments with `downloadUrl` and never includes internal notes.

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test -- tests/lab-03/staff-ticket-detail.api.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all server tests to verify zero regressions across all 16 files**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test`
Expected: ALL test files pass.

---

### Task 6: Frontend API Client & Types

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`

**Interfaces:**
- Produces:
  - In `client/src/types.ts`: `Entry`, `PublicComment`, `InternalNote`, `StaffTicketDetail`, `UpdateStatusPayload`, `ProblemAppearsResolvedPayload`.
  - In `client/src/api.ts`:
    - `fetchStaffTicketDetail(ticketId: number): Promise<StaffTicketDetail>`
    - `claimStaffTicket(ticketId: number, expectedVersion: number): Promise<{ ticket: StaffTicketDetail }>`
    - `updateStaffTicketOwner(ticketId: number, ownerId: number | null, expectedVersion: number): Promise<{ ticket: StaffTicketDetail }>`
    - `updateStaffTicketItPriority(ticketId: number, itPriority: Priority, expectedVersion: number): Promise<{ ticket: StaffTicketDetail }>`
    - `updateStaffTicketStatus(ticketId: number, payload: { status: TicketStatus; expectedStatus: TicketStatus; expectedVersion: number; confirmed?: boolean }): Promise<{ ticket: StaffTicketDetail }>`
    - `fetchPublicComments(ticketId: number): Promise<{ comments: Entry[] }>`
    - `addPublicComment(ticketId: number, content: string): Promise<{ comment: Entry }>`
    - `fetchInternalNotes(ticketId: number): Promise<{ notes: Entry[] }>`
    - `addInternalNote(ticketId: number, content: string): Promise<{ note: Entry }>`
    - `indicateProblemAppearsResolved(ticketId: number, payload: { expectedVersion: number; comment?: string }): Promise<{ ticket: TicketDetail }>`

- [ ] **Step 1: Update `client/src/types.ts` with required types**
- [ ] **Step 2: Update `client/src/api.ts` with API methods**
- [ ] **Step 3: Run `npm --prefix client run build` to verify clean TypeScript compilation**

---

### Task 7: Frontend Requester Ticket Detail (Public Comments, Accessible Modal, Refresh Safety)

**Files:**
- Modify: `client/src/components/TicketDetailPage.tsx`
- Create: `client/tests/lab-03/RequesterTicketDetail.test.tsx`

**Interfaces:**
- Consumes: `TicketDetail`, `addPublicComment`, `indicateProblemAppearsResolved`, `fetchTicketDetail`.
- Produces:
  - Public Comments section with timeline and composer (1-2000 characters, character count, validation, busy state, draft preservation on failure).
  - Version refresh on comment creation: reloads ticket via `fetchTicketDetail` so subsequent actions (e.g. resolution indication) have the fresh `expectedVersion`.
  - Refresh failure safety rule: if comment append succeeds but subsequent ticket refresh fails, do NOT auto-retry the comment; display that the comment was saved, disable resolution indication, and display a "Reload Ticket" button.
  - "Problem Appears Resolved" secondary action:
    - Visible on NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED.
    - If already indicated, displays banner with date and disables button.
    - Accessible Confirmation Modal: `role="dialog"`, `aria-modal="true"`, initial focus, Tab trapping, Escape handling while idle, focus restoration on close.
    - Modal explains that IT Staff still formally resolve and close the ticket, with optional comment textarea.
    - On confirm, calls `indicateProblemAppearsResolved` with current version.

- [ ] **Step 1: Write component test `client/tests/lab-03/RequesterTicketDetail.test.tsx` (UI-08)**

Test:
- Displays public comments with author name, role, timestamp.
- Adds public comment, displays it, and refreshes ticket version.
- Sequential mutation check: adding public comment followed by Problem Appears Resolved succeeds without 409.
- Refresh failure rule: when append succeeds but reload fails, comment is preserved, operation buttons disabled, and "Reload Ticket" displayed.
- Shows "Problem Appears Resolved" button in permitted statuses; hides in terminal statuses.
- Opens confirmation modal with dialog accessibility (role="dialog", aria-modal, Tab trapping, Escape, focus restoration).
- Submits indication with comment, updates UI to indicated state.

- [ ] **Step 2: Implement in `client/src/components/TicketDetailPage.tsx`**
- [ ] **Step 3: Run test to verify it passes**

Run: `npm --prefix client test -- tests/lab-03/RequesterTicketDetail.test.tsx`
Expected: PASS.

- [ ] **Step 4: Run existing Lab 2 requester tests to verify zero regressions**

Run: `npm --prefix client test -- tests/lab-02/`
Expected: All Lab 2 tests PASS.

---

### Task 8: Frontend Staff Ticket Detail Component (`StaffTicketDetail.tsx`)

**Files:**
- Create: `client/src/components/StaffTicketDetail.tsx`
- Create: `client/tests/lab-03/StaffTicketDetail.test.tsx`

**Interfaces:**
- Produces: `<StaffTicketDetail ticketId={number} onBack={() => void} />`
- Features:
  - Read-only requester submission panel (safe profile, category, related system, summary, description, requested priority, timestamps).
  - Resolution indication notice if marked by requester.
  - Operational card:
    - Independent eligible-owner loading, empty, failure, and retry states (`GET /api/staff/eligible-owners`).
    - Disable reassignment selector and save button until owner options finish loading.
    - Shows current owner or "Unassigned" (distinct from an empty eligible owner list).
    - Prominent "Claim" button for unassigned tickets.
    - Reassignment dropdown: selects from eligible owners; save button with busy state.
    - If reassignment returns 400 `INVALID_OWNER`, show safe error callout and refresh owner choices from API.
    - IT Priority section: dropdown (LOW, MEDIUM, HIGH, URGENT) + Save button.
    - Status section: dropdown populated with only legal next statuses from the transition matrix.
    - Accessible Confirmation Modal: for transitions to RESOLVED, CLOSED, CANCELLED, REOPENED. Conforms to `role="dialog"`, `aria-modal="true"`, initial focus, Tab trapping, Escape handling while idle (disabled while saving), focus restoration.
    - Owner requirement validation when entering IN_PROGRESS, WAITING_FOR_REQUESTER, or RESOLVED.
    - 409 CONFLICT banner offering "Reload Ticket" button.
  - Distinct Communication sections/tabs:
    - Public Comments (green card styling, "Public" badge, composer with 1-2000 char counter, error handling, draft preservation).
    - Internal Notes (amber card styling, "Private - IT Staff and Administrators" badge, composer with 1-2000 char counter, error handling, draft preservation).
    - Version refresh on comment/note append: reloads ticket via `fetchStaffTicketDetail` so subsequent operations have the fresh `expectedVersion`.
    - Refresh failure safety rule: if append succeeds but ticket refresh fails, do NOT auto-retry append; display that communication was saved, disable operations, and show "Reload Ticket".
  - Attachments section:
    - Active attachments with Download button.
    - Removed attachments with removal reason and date, download unavailable.
    - If an attachment disappears or was removed before download, show safe error callout and refresh metadata.
    - No requester upload/remove controls rendered for staff.
  - States: Loading skeleton, error retry, not-found, 403 forbidden callout.
  - `← Back to Ticket Queue` button.

- [ ] **Step 1: Write component test `client/tests/lab-03/StaffTicketDetail.test.tsx` (UI-05, UI-06, UI-09)**

Test:
- Initial load, loading spinner, error with retry, not found, forbidden 403 callout.
- Independent owner loading: selector disabled while loading; retry button on owner loading failure.
- Owner choices refresh after 400 `INVALID_OWNER`.
- Distinguish Unassigned from empty owner list.
- Claim unassigned ticket updates status to OPEN if was NEW.
- Reassignment loads eligible owners, saves owner.
- IT Priority change and save.
- Status transition dropdown populates only legal next statuses. Modal appears for confirmed statuses with accessible attributes (`role="dialog"`, Tab trapping, Escape).
- 409 conflict handling displays reload notice and reloads ticket.
- Public comments & Internal notes separation: visual styling, separate composer state, validation, draft preservation on failure.
- Version freshness: appending note/comment allows subsequent status/owner change without 409.
- Refresh failure safety rule verified.
- Attachments view: download active files, display removed metadata without download link, safe callout and metadata refresh if download reports removed/missing.

- [ ] **Step 2: Implement `client/src/components/StaffTicketDetail.tsx`**
- [ ] **Step 3: Run test to verify it passes**

Run: `npm --prefix client test -- tests/lab-03/StaffTicketDetail.test.tsx`
Expected: PASS.

---

### Task 9: Direct Path Routing & Comprehensive Navigation Tests

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/tests/lab-03/StaffTicketQueue.test.tsx`
- Create: `client/tests/lab-03/Routing.test.tsx`

**Interfaces:**
- Produces:
  - Comprehensive path-based navigation using HTML5 History API:
    - `/login` -> Login page
    - `/change-password` -> Change password page
    - `/my-tickets` -> Requester tickets list
    - `/tickets/new` -> Create ticket
    - `/tickets/:id` -> Requester ticket detail (parses positive integer ID)
    - `/staff/tickets` -> Staff queue (IT Staff home path)
    - `/staff/tickets/:id` -> Staff ticket detail (parses positive integer ID)
    - `/admin/users` -> User management (Administrator home path)
  - Direct path loading, browser back/forward (`popstate` listener), and `window.history.pushState` on navigation.
  - Session and password-change gating:
    - Unauthenticated user routes to `/login`.
    - Authenticated user visiting `/login` routes to their permitted home (`/staff/tickets` for IT Staff, `/admin/users` for Administrator, `/my-tickets` for Requester).
    - Session requiring password change (`mustChangePassword = true`) forces `/change-password`.
  - Role protection:
    - Requester accessing `/staff/tickets`, `/staff/tickets/:id`, or `/admin/users` sees safe forbidden message or routes to `/my-tickets`.
    - IT Staff accessing `/admin/users` sees safe forbidden message.
    - Staff/Admin accessing `/my-tickets` or `/tickets/new` sees safe forbidden message.
  - Invalid path handling:
    - Invalid or non-positive ticket IDs (`/tickets/abc`, `/tickets/-1`, `/staff/tickets/0`, `/staff/tickets/NaN`) display safe not-found / invalid ticket error page without crash.
    - Unknown paths (`/unknown-path`, `/foo/bar`) display safe not-found page with return link.
  - Queue state preservation:
    - Preserves lifted queue query parameters (`staffQueueParams`) when returning from `/staff/tickets/:id` to `/staff/tickets`.

- [ ] **Step 1: Write routing test `client/tests/lab-03/Routing.test.tsx`**

Include:
- History state reset in `beforeEach`/`afterEach`.
- Unauthenticated access to protected path redirects to `/login`.
- Authenticated user on `/login` routes to permitted home (`/staff/tickets` for IT Staff).
- Forced password change on `/change-password`.
- Direct navigation to `/staff/tickets/201` loads staff ticket detail directly.
- Direct navigation to `/tickets/101` loads requester ticket detail directly.
- Direct navigation to `/tickets/invalid` shows safe not found/invalid ID state.
- Unknown URL path `/not-found` shows safe not-found state.
- Cross-role navigation checks (Requester on `/staff/tickets` gets forbidden; Staff on `/admin/users` gets forbidden).
- Back navigation updates URL to `/staff/tickets` and restores filter/page state.
- Browser `popstate` back and forward properly transitions between queue and detail views.

- [ ] **Step 2: Implement path synchronization and route dispatching in `client/src/App.tsx`**
- [ ] **Step 3: Update `StaffTicketQueue.test.tsx` to mount `<StaffTicketDetail>` instead of placeholder**
- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix client test -- tests/lab-03/StaffTicketQueue.test.tsx tests/lab-03/Routing.test.tsx`
Expected: PASS.

---

### Task 10: Complete Test Suites, Production Builds, and Documentation

**Files:**
- Modify: `docs/lab-03/tests.md` (record actual results in §16 and update planned tests table)

- [ ] **Step 1: Run complete backend test suite against disposable database**

Run: `DATABASE_URL="<runtime disposable database URL>" npm --prefix server test`
Expected: ALL backend tests pass (16+ test files).

- [ ] **Step 2: Run complete client test suite**

Run: `npm --prefix client test`
Expected: ALL client tests pass (11+ test files).

- [ ] **Step 3: Run server production build**

Run: `npm --prefix server run build`
Expected: Exit code 0.

- [ ] **Step 4: Run client production build**

Run: `npm --prefix client run build`
Expected: Exit code 0.

- [ ] **Step 5: Run git whitespace and status check**

Run: `git diff --check`
Check `git status`: verify `client/package.json` uncommitted modification is strictly preserved and not staged.

- [ ] **Step 6: Update `docs/lab-03/tests.md` with actual verification evidence in §16 and updated traceability rows**

---
