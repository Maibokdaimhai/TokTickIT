# Staff Ticket Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Issue #29: IT Staff Ticket Queue with `GET /api/staff/tickets`, `GET /api/staff/eligible-owners`, responsive Zen Green UI, debounced search, separate Requested Priority and IT Priority filters, sorting, pagination, distinct forbidden state handling, and complete automated tests.

**Architecture:** Layered backend (`routes → controllers → services → Prisma` with service-invoked validator functions); React frontend with state-driven role navigation, debounced search, separate priority filter controls, responsive desktop table/mobile cards, lifted queue state in `App.tsx`, distinct forbidden callout, and minimal Open detail placeholder.

**Tech Stack:** React 18.3.1, TypeScript, Vite, Express, Prisma ORM, PostgreSQL, Vitest, React Testing Library, Supertest.

**Spec:** `docs/lab-03/specification.md`, `docs/lab-03/api-spec.md`, `docs/lab-03/ui-spec.md`, `docs/lab-03/tests.md`.

## Global Constraints & Explicit Safeguards

- **Typed Client Error**: `fetchStaffTickets` preserves HTTP status in a typed error (`ApiClientError` with `status: number`, `message: string`, `code?: string`). This enables `StaffTicketQueue` to reliably distinguish HTTP 403 forbidden responses from network/500 failures.
- **AbortSignal & Cancellation**: Pass `AbortController.signal` into `fetchStaffTickets`; silently ignore `AbortError` / `err?.name === "AbortError"` so cancellation does not display an error banner.
- **Package.json Protection**: Never edit or stage the existing user-owned `client/package.json` change (`"@testing-library/user-egvent": "^14.5.2"`). Exclude it strictly from all commits.
- **Database Protection**: Never migrate or reset the normal development database; use strictly `postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914` for all tests and development verification.
- **No New Libraries**: Use existing Zen Green styles, design tokens, and dependencies—no new UI or URL router libraries.
- **Pagination Metadata**: Explicitly return `pagination: { page, limit, totalItems, totalPages }` with `totalPages: 0` when `totalItems === 0`.
- **ISO Date Serialization**: `createdAt` and `updatedAt` are strictly serialized as ISO 8601 strings.
- **Mobile Overflow Prevention**: Mobile card layout (< 768px) contains no horizontal scrolling (`overflow-x: hidden` / zero horizontal scroll).
- **Scope Boundary**: Full ticket operations belong to #30; Open action in #29 navigates to a minimal detail placeholder with "← Back to Ticket Queue" preserving queue queries.
- **Role-Controlled Rendering**: State-driven role navigation uses React component state (`activeTab`, `selectedTicketId`, `session.user.role`); do not introduce a URL router library.
- **Service Validation**: Input validation is called inside services via validator modules (no validation middleware).
- **Deterministic Owner Sorting**: Eligible owners are ordered case-insensitively (`a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id`).
- **Exact Safe Contract**: Queue ticket row response contains only specified safe fields and explicitly excludes descriptions, requester details, Internal Notes, physical file paths, password hashes, and session tokens.
- **Commit Plan File**: Commit the plan file `docs/superpowers/plans/2026-09-17-staff-ticket-queue.md` with Issue #29.

---

### Task 1: Backend Staff Queue Validators & Service

**Files:**
- Create: `server/src/validators/staff.validator.ts`
- Create: `server/src/services/staff.service.ts`

- [ ] **Step 1: Create staff input validator**
Implement `parseStaffTicketFilters(query, actorId)` and `validateEligibleOwnersQuery(query)` in `server/src/validators/staff.validator.ts`:
  - Whitelist: `search`, `category`, `requestedPriority`, `itPriority`, `status`, `owner`, `sort`, `page`, `limit`.
  - Reject unknown keys or array values with `400 BAD_REQUEST`.
  - Empty optional strings mean no filter.
  - `search`: trimmed string, max 150 characters. Empty string = no filter. Length > 150 -> 400.
  - `category`: optional positive integer ID. Malformed -> 400.
  - `requestedPriority`: optional enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`). Malformed -> 400.
  - `itPriority`: optional enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`). Malformed -> 400.
  - `status`: optional TicketStatus (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`). Malformed -> 400.
  - `owner`: positive user ID, `unassigned` (`ownerId: null`), or `me` (`ownerId: actorId`). Malformed -> 400.
  - `sort`: `updatedAt_desc` (default), `createdAt_desc`, `createdAt_asc`, `ticketNumber_asc`, `ticketNumber_desc`, `itPriority_desc`. Unsupported -> 400.
  - `page`: positive integer, default 1. Malformed -> 400.
  - `limit`: 10, 20, or 50, default 10. Unsupported -> 400.
  - `validateEligibleOwnersQuery`: reject query parameters with 400.

- [ ] **Step 2: Create staff service**
Implement `listStaffTickets(query, actorId)` and `getEligibleOwners(query)` in `server/src/services/staff.service.ts`:
  - Invoke `parseStaffTicketFilters(query, actorId)`.
  - Build Prisma query with AND filter logic across all active filters; `search` matches `summary` OR `ticketNumber` case-insensitively.
  - Handle valid nonexistent category/owner IDs gracefully (returns empty results).
  - Sorting: `itPriority_desc` uses `[{ itPriority: "desc" }, { updatedAt: "desc" }, { id: "asc" }]` (PostgreSQL enum order produces URGENT → HIGH → MEDIUM → LOW). Other sorts use tie-breaker `id: "asc"`.
  - Pagination metadata: `page`, `limit`, `totalItems`, `totalPages` (0 when totalItems === 0). Out-of-range page returns `tickets: []` while preserving requested `page`.
  - Exact safe row shape: `id`, `ticketNumber`, `createdAt` (ISO string), `updatedAt` (ISO string), `summary`, `category` (`{ id, name }`), `requestedPriority`, `itPriority`, `status`, `owner` (`{ id, name, email, role }` or `null`), `attachmentCount` (active non-removed only: `isRemoved: false`), `publicCommentCount`.
  - Exclude descriptions, requester identity, internalNotes, file paths, credentials.
  - `getEligibleOwners`: query active `IT_STAFF` and `ADMINISTRATOR` users (`isActive: true`), sort deterministically in-memory by `a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id - b.id`, return safe fields `{ id, name, email, role }`.

---

### Task 2: Backend Staff Controllers, Routes & App Wiring

**Files:**
- Create: `server/src/controllers/staff.controller.ts`
- Create: `server/src/routes/staff.routes.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create staff controller**
Implement `listStaffTickets` and `getEligibleOwners` wrapped with `asyncHandler`.

- [ ] **Step 2: Create staff routes**
Mount `GET /staff/tickets` and `GET /staff/eligible-owners` with `requireRoles("IT_STAFF", "ADMINISTRATOR")`.

- [ ] **Step 3: Wire into app.ts**
Mount `staffRoutes` under `/api` in `server/src/app.ts`.

---

### Task 3: Backend Staff Queue API Tests (API-07 & API-17)

**Files:**
- Create: `server/tests/lab-03/staff-queue.api.test.ts`

- [ ] **Step 1: Write API-07 and API-17 test suite**
Cover:
1. Role authorization: IT_STAFF (200), ADMINISTRATOR (200), REQUESTER (403), unauthenticated (401), password change required (403).
2. Combined filters with AND logic (category, status, requestedPriority, itPriority, owner `me`/`unassigned`/positive ID).
3. Empty optional query values (e.g. `?category=&status=`) behave as no filter.
4. Valid but nonexistent category and owner IDs return 200 with empty tickets array.
5. Search by summary or ticketNumber, case-insensitive, trimmed, max 150 limit check.
6. Sorting by `itPriority_desc` (URGENT → HIGH → MEDIUM → LOW, updatedAt desc, id asc) and other sorts with stable tie-breaker.
7. Pagination metadata: page, limit (10, 20, 50), invalid limit rejection (400), out-of-range page returning empty array, totalPages 0 when empty.
8. Malformed and unknown parameters rejected with 400.
9. Safe fields only (ISO strings for dates, no leaked secrets, no description, no requester, no internal notes).
10. Eligible owners endpoint: role auth, active staff/admin only, sorted by case-insensitive name then id, safe fields.

- [ ] **Step 2: Run backend test suite**
Run: `DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914" npm --prefix server test`
Expected: PASS all tests.

---

### Task 4: Frontend Types, API Client & Styling

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/styles/theme.css`

- [ ] **Step 1: Extend frontend types**
Add `StaffTicketRow`, `StaffTicketsResponse`, `FetchStaffTicketsParams`, `EligibleOwner`, and all 8 `TicketStatus` values to `client/src/types.ts`.

- [ ] **Step 2: Add API methods and typed ApiClientError**
Implement `ApiClientError` class preserving HTTP status and optional code.
Add `fetchStaffTickets(params: FetchStaffTicketsParams): Promise<StaffTicketsResponse>` throwing `ApiClientError` on non-OK responses and forwarding `params.signal`.
Add `fetchEligibleOwners(): Promise<{ owners: EligibleOwner[] }>`.

- [ ] **Step 3: Update CSS**
Add badge styles for `OPEN`, `WAITING_FOR_REQUESTER`, `REOPENED`, `CANCELLED`, and queue layout styles ensuring responsive card display below 768px without horizontal overflow.

---

### Task 5: Frontend Staff Ticket Queue Component & Role Shell

**Files:**
- Create: `client/src/components/StaffTicketQueue.tsx`
- Modify: `client/src/components/Header.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Implement StaffTicketQueue component**
Build component with:
  - Search debouncing (300ms)
  - Separate Requested Priority filter dropdown
  - Separate IT Priority filter dropdown
  - Category, status, and owner dropdown filters
  - Sort selector (default `updatedAt_desc`)
  - Page size selector (10/20/50), pagination (`page`, `limit`, `totalItems`, `totalPages`), clear filters
  - Desktop table (9 columns) and mobile cards (< 768px, no horizontal scroll)
  - Loading, true empty, filtered no-results
  - **Distinct forbidden state**: detects HTTP 403 (via `err.status === 403`) and renders a distinct forbidden callout without generic retry button
  - Safe error state with retry (for non-403 failures); silently ignore `AbortError` / `err?.name === "AbortError"`
  - Open action calling `onOpenTicket` and notifying of query state changes.

- [ ] **Step 2: Update Header.tsx and App.tsx**
  - Integrate role defaults: `IT_STAFF` defaults to `"ticket-queue"`, `ADMINISTRATOR` defaults to `"user-management"` (with existing placeholder) while offering `"ticket-queue"`, `REQUESTER` defaults to `"my-tickets"`.
  - Lift `staffQueueParams` state in `App.tsx` so queue state is preserved across navigating to and from the detail placeholder.
  - Minimal detail placeholder bounded to Issue #29 showing ticket ID, explaining operations belong to Issue #30, and offering "← Back to Ticket Queue".

---

### Task 6: Frontend Component Tests (UI-04) & Navigation Integration

**Files:**
- Create: `client/tests/lab-03/StaffTicketQueue.test.tsx`

- [ ] **Step 1: Write UI-04 and navigation integration tests**
  - Desktop table columns, mobile cards, status and priority badges.
  - Search debounce (300ms).
  - Separate Requested Priority and IT Priority dropdown controls.
  - Filter controls and page-size changes trigger refetch and reset page to 1.
  - Pagination navigation and clear filters.
  - Stale response discard via AbortController; AbortError does not show error banner.
  - Loading, true empty, filtered no-results, and error/retry states.
  - **Independent forbidden state test**: verify that HTTP 403 renders distinct forbidden callout without generic retry button.
  - Open button calls `onOpenTicket`.
  - App/Header role navigation integration tests:
    * IT Staff renders Ticket Queue by default; Header shows Ticket Queue nav.
    * Administrator renders User Management placeholder by default; Header shows User Management (active) and Ticket Queue; clicking Ticket Queue switches view.
    * Requester Header does not render Ticket Queue.

- [ ] **Step 2: Run client test suite and builds**
Run:
`npm --prefix client test`
`npm --prefix server run build`
`npm --prefix client run build`
Expected: PASS with 0 errors.

---

### Task 7: Update Test Documentation (tests.md)

**Files:**
- Modify: `docs/lab-03/tests.md`

- [ ] **Step 1: Update test plan status and record evidence**
Update §2 status for API-07 and UI-04, and update planned file for API-17 to `server/tests/lab-03/staff-queue.api.test.ts`. Add Section 15 recording Issue #29 verification results, command outputs, test counts, and commit SHA.

---

### Task 8: Full Verification, Git Hygiene, Commit & Push

- [ ] **Step 1: Run full server test suite with disposable database**
Run: `DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914" npm --prefix server test`
Expected: All backend tests pass.

- [ ] **Step 2: Run full client test suite**
Run: `npm --prefix client test`
Expected: All client tests pass.

- [ ] **Step 3: Run production builds**
Run: `npm --prefix server run build && npm --prefix client run build`
Expected: Clean builds with 0 errors.

- [ ] **Step 4: Git hygiene and staged diff inspection**
- Run `git diff --check`
- Check `git status`: ensure `client/package.json` is untouched and unstaged.
- Include `docs/superpowers/plans/2026-09-17-staff-ticket-queue.md` in the commit.
- Stage only task-related files.

- [ ] **Step 5: Commit and Push**
Commit on `feature/lab3-staff-queue`:
`feat(queue): implement IT staff ticket queue and eligible owners API`
Push branch to origin.

- [ ] **Step 6: Prepare PR summary**
Provide copy-ready PR title and description targeting `lab3-staging` with "Closes #29".
