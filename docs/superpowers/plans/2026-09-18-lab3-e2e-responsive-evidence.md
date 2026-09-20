# Issue #32 Implementation Plan: E2E Workflows and Responsive Screenshot Evidence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement end-to-end browser workflows and durable responsive screenshot evidence for TokTickIT Lab 3 (GitHub Issue #32), covering Authentication (`E2E-01`), IT Staff operations (`E2E-02`), Administrator user management (`E2E-03`), Authenticated Requester regressions (`E2E-04`), and multi-viewport responsive/accessibility verification (`VIS-01`), without altering the implemented application contract.

**Architecture:** Playwright test suites run in headless Chromium against isolated application instances (client on port 5174, backend server on port 3104) backed by a dedicated disposable PostgreSQL database (e.g. `toktickit_lab3_e2e_20260918`) and isolated upload storage (`/private/tmp/toktickit-e2e-uploads-20260918`). Browser tests utilize API-assisted test fixtures for deterministic setup, exercise real cookie-based session flows and user interactions, assert computed DOM/CSS responsive and accessibility constraints, and capture durable full-page screenshots stored under `artifacts/lab-03/screenshots/`.

**Tech Stack:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, React 18, Vite, Playwright Test (`@playwright/test`), Vitest.

**Spec References:**
- `docs/lab-03/specification.md`
- `docs/lab-03/api-spec.md`
- `docs/lab-03/ui-spec.md`
- `docs/lab-03/tests.md`

---

## Global Constraints

- **Branch:** Work only on the existing branch `test/lab3-e2e-and-evidence`. Do not create, switch, merge, rebase, or delete branches.
- **Git Actions:** Do not commit or push. Do not operate GitHub or open pull requests. GitHub actions belong to the user.
- **Package Integrity:** Preserve the existing uncommitted `client/package.json` change exactly as-is (`@testing-library/user-egvent`). It is user-owned and must not be staged, reverted, corrected, or included in any commit.
- **Dependencies:** Do not add dependencies unless absolutely necessary and approved first.
- **Database Safety & Disposable Database Guard:**
  - Never run destructive commands such as `prisma migrate reset`, drop databases/schemas, or delete development data.
  - Never run E2E tests against the normal development database (`toktickit`).
  - Require an explicitly supplied, recognizable disposable database URL via `DATABASE_URL`.
  - The E2E configuration and helpers must fail closed if `DATABASE_URL` is absent, ends with `/toktickit`, or does not contain a recognizable disposable token (`e2e`, `disposable`, or `test`).
  - Require `E2E_ALLOW_DB_WRITE=1` explicitly from the caller; both configuration and helpers fail closed if it is absent or not `"1"`. Never default to writable mode.
- **Runtime-Only Secrets & Redaction:**
  - No passwords or complete database connection strings with credentials may appear in committed source files, plans, screenshots, logs, or documentation.
  - `DATABASE_URL`, `LAB3_INITIAL_PASSWORD`, `E2E_INITIAL_PASSWORD`, and `E2E_CHANGED_PASSWORD` must be provided through the runtime environment.
  - Refactor `e2e/lab-03/helpers.ts` to fail closed if `E2E_INITIAL_PASSWORD` or `E2E_CHANGED_PASSWORD` is unset. Remove all hardcoded fallback passwords and fallback database URLs.
  - Passwords in the UI must remain runtime-only and masked; screenshot assertions must capture empty, masked, or pre-submission states.
  - In documentation, logs, and summaries, sanitize all credentials to `$DATABASE_URL`, `$LAB3_INITIAL_PASSWORD`, and `<runtime disposable database URL>`.
  - Assert that session cookies are `HttpOnly` and `SameSite=Lax` and never accessible to `document.cookie`.
- **Port & Origin Alignment:**
  - Client Port: `5174` (or `process.env.E2E_CLIENT_PORT`)
  - Server Port: `3104` (or `process.env.E2E_SERVER_PORT`)
  - Align `CLIENT_ORIGIN` (`http://localhost:5174`), `VITE_API_URL` (`http://localhost:3104`), Playwright `baseURL` (`http://localhost:5174`), `E2E_CLIENT_ORIGIN` (`http://localhost:5174`), and `E2E_API_ORIGIN` (`http://localhost:3104`).
  - Set `reuseExistingServer: false` in Playwright configuration so tests run only against the dedicated test server.
- **Documentation Integrity:**
  - Do not modify `docs/lab-03/ai-use.md` or fabricate peer-review/GitHub evidence in `docs/lab-03/reviewer.md`.
  - Update `docs/lab-03/tests.md` with honest feature-branch results; do not claim final release or main branch completion.
  - Update `docs/lab-03/ui-spec.md` checklist only for checks actually performed.
- **Application Contract:** Do not change application behavior unless a genuine regression is discovered. If found, document it separately before making a narrowly scoped fix.

---

## Responsive Screenshot Evidence Matrix (24 Baseline + 14 Supplemental)

The Lab 3 UI specification requires desktop (1440×900), tablet (820×1180), and mobile (390×844) evidence across all 8 major screens.

### 1. Baseline Viewport Matrix (24 Required Screens)

| Screen | Desktop (1440×900) | Tablet (820×1180) | Mobile (390×844) |
|---|---|---|---|
| **1. Login** | `artifacts/lab-03/screenshots/authentication/desktop-login.png` | `artifacts/lab-03/screenshots/authentication/tablet-login.png` | `artifacts/lab-03/screenshots/authentication/mobile-login.png` |
| **2. Change Password** | `artifacts/lab-03/screenshots/authentication/desktop-change-password.png` | `artifacts/lab-03/screenshots/authentication/tablet-change-password.png` | `artifacts/lab-03/screenshots/authentication/mobile-change-password.png` |
| **3. Requester My Tickets** | `artifacts/lab-03/screenshots/requester/desktop-my-tickets.png` | `artifacts/lab-03/screenshots/requester/tablet-my-tickets.png` | `artifacts/lab-03/screenshots/requester/mobile-my-tickets.png` |
| **4. Create Ticket** | `artifacts/lab-03/screenshots/requester/desktop-create-ticket.png` | `artifacts/lab-03/screenshots/requester/tablet-create-ticket.png` | `artifacts/lab-03/screenshots/requester/mobile-create-ticket.png` |
| **5. Requester Ticket Detail** | `artifacts/lab-03/screenshots/requester/desktop-ticket-detail.png` | `artifacts/lab-03/screenshots/requester/tablet-ticket-detail.png` | `artifacts/lab-03/screenshots/requester/mobile-ticket-detail.png` |
| **6. Staff Queue** | `artifacts/lab-03/screenshots/staff-queue/desktop-staff-queue.png` | `artifacts/lab-03/screenshots/staff-queue/tablet-staff-queue.png` | `artifacts/lab-03/screenshots/staff-queue/mobile-staff-queue.png` |
| **7. Staff Ticket Detail** | `artifacts/lab-03/screenshots/staff-ticket-detail/desktop-staff-detail.png` | `artifacts/lab-03/screenshots/staff-ticket-detail/tablet-staff-detail.png` | `artifacts/lab-03/screenshots/staff-ticket-detail/mobile-staff-detail.png` |
| **8. Administrator User Management** | `artifacts/lab-03/screenshots/user-management/desktop-user-management.png` | `artifacts/lab-03/screenshots/user-management/tablet-user-management.png` | `artifacts/lab-03/screenshots/user-management/mobile-user-management.png` |

### 2. Supplemental State Evidence (14 Screenshots)

| Category | Artifact Path | Description |
|---|---|---|
| **Authentication (2)** | `artifacts/lab-03/screenshots/authentication/mobile-login-invalid.png` | Mobile invalid credentials generic error callout |
| | `artifacts/lab-03/screenshots/authentication/mobile-password-validation.png` | Mobile password requirements rule validation failures |
| **Requester (4)** | `artifacts/lab-03/screenshots/requester/desktop-my-tickets-empty.png` | Requester with zero tickets true empty state |
| | `artifacts/lab-03/screenshots/requester/desktop-attachment-soft-remove-modal.png` | Attachment soft-removal modal with reason textarea |
| | `artifacts/lab-03/screenshots/requester/desktop-problem-resolved-modal.png` | Problem Appears Resolved confirmation modal |
| | `artifacts/lab-03/screenshots/requester/desktop-problem-resolved-active.png` | Detail view showing Problem Appears Resolved notice |
| **Staff Queue (1)** | `artifacts/lab-03/screenshots/staff-queue/desktop-filtered-no-results.png` | Staff Queue filtered no-results state with Clear Filters |
| **Staff Detail (3)** | `artifacts/lab-03/screenshots/staff-ticket-detail/desktop-claimed-open.png` | Unassigned ticket claimed and transitioned to OPEN |
| | `artifacts/lab-03/screenshots/staff-ticket-detail/desktop-status-confirmation.png` | Terminal/controlled status change confirmation dialog |
| | `artifacts/lab-03/screenshots/staff-ticket-detail/desktop-conflict-banner.png` | Optimistic concurrency conflict banner (HTTP 409) |
| **User Admin (4)** | `artifacts/lab-03/screenshots/user-management/desktop-create-user-modal.png` | Create User modal with validation checklist |
| | `artifacts/lab-03/screenshots/user-management/desktop-duplicate-email-error.png` | Duplicate email conflict callout (HTTP 409) |
| | `artifacts/lab-03/screenshots/user-management/desktop-reset-password-modal.png` | Reset initial password modal dialog |
| | `artifacts/lab-03/screenshots/user-management/desktop-self-deactivation-disabled.png` | Self-deactivation toggle disabled on current administrator |

---

## Stable Screenshot Readiness Protocol

To avoid flaky captures caused by `networkidle`, the screenshot utility in `e2e/lab-03/helpers.ts` enforces explicit DOM readiness conditions:
1. **Target Heading/Element Visible:** Wait on the screen's main landmark heading (e.g. `getByRole("heading", { name: ... })`) or dialog card.
2. **Busy/Loading Indicators Absent:** Ensure loading spinners and skeletons (e.g. `[data-testid="queue-loading"]`, `.loading-container`, `[role="status"]`) are hidden or detached.
3. **Table/Card Content Rendered:** Wait for the primary data container (`table.tickets-table`, `table.users-table`, `.tickets-mobile-list`, or `.users-cards-container`) to have at least 1 child or display the expected empty state.
4. **Font Loading Completed:** Evaluate `await document.fonts.ready`.
5. **Animation & Transition Suppression:** Inject a style tag into the page disabling CSS animations and transitions (`* { animation: none !important; transition: none !important; }`) and set `reducedMotion: "reduce"` to eliminate motion blur.
6. **Scroll to Top:** Evaluate `window.scrollTo(0, 0)` before capturing.

---

## Fixture Tracking, Scoped Seed Mutation & Safe Cleanup Protocol

The E2E suite must not permanently alter seeded fixtures or leave orphan records between test executions.

### Fixture Lifecycle Rules:
1. **General Rule (Dynamic Isolated Test Fixtures):** All mutating tests (claiming, reassigning, updating status, creating users, resetting passwords) must create dynamic test users with UUID-based emails (`${randomUUID()}@e2e.example`) and isolated tickets.
2. **Narrow Exception (Last-Active-Administrator Testing):** To test `LAST_ACTIVE_ADMIN` without requiring multi-database setup, the test creates a temporary Administrator (`${randomUUID()}@e2e.example`) and logs in as that user. Inside a `try ... finally` block, it captures the seeded Administrator's (Morgan Davis) original state, temporarily sets Morgan Davis to `isActive: false`, and attempts to demote the temporary Administrator's own role to `IT_STAFF`. This asserts that the API returns HTTP 409 `LAST_ACTIVE_ADMIN` (since the temporary administrator is now the sole active administrator). In the `finally` block, Morgan Davis's active state (`isActive: true`) is strictly restored, ensuring the seeded administrator is left active even if an assertion fails.

### Complete Foreign-Key-Safe Cleanup Sequence (`cleanAccounts()`):
1. Query all users where `id IN (:trackedIds)` OR `email LIKE '%@e2e.example'`.
2. Query all tickets where `requesterId IN (:userIds)` OR `ownerId IN (:userIds)` OR `problemAppearsResolvedById IN (:userIds)` OR `seedKey LIKE 'e2e-fixture-%'`.
3. Delete all `Session` records where `userId IN (:userIds)`.
4. Query all `Attachment` records on those tickets; unlink files from the filesystem (`fs.unlink`), then delete `Attachment` database records.
5. Delete all `PublicComment` records where `ticketId IN (:ticketIds)` OR `authorId IN (:userIds)`.
6. Delete all `InternalNote` records where `ticketId IN (:ticketIds)` OR `authorId IN (:userIds)`.
7. Clear ticket foreign-key references: update `Ticket` set `ownerId = NULL`, `problemAppearsResolvedById = NULL` for affected tickets.
8. Delete all `Ticket` records where `id IN (:ticketIds)`.
9. Delete all `User` records where `id IN (:userIds)`.
10. Disconnect the Prisma client.

---

## Tasks Decomposition

### Task 1: Dedicated Disposable PostgreSQL Database Provisioning

**Goal:** Provision a new disposable database (`toktickit_lab3_e2e_20260918`), deploy migrations, run password bootstrap with environment-provided credential, and seed data.

- [ ] **Step 1: Check required environment variables**

Verify that `DATABASE_URL`, `LAB3_INITIAL_PASSWORD`, `E2E_INITIAL_PASSWORD`, and `E2E_CHANGED_PASSWORD` are set in the execution environment. Fail closed if any variable is missing.

- [ ] **Step 2: Create disposable database**

Run:
```bash
docker exec toktickit-db createdb -U toktickit toktickit_lab3_e2e_20260918
```

- [ ] **Step 3: Deploy Prisma migrations to disposable database**

Run:
```bash
DATABASE_URL="$DATABASE_URL" npx --prefix server prisma migrate deploy
```

- [ ] **Step 4: Run password bootstrap with test-only credential**

Run:
```bash
DATABASE_URL="$DATABASE_URL" LAB3_INITIAL_PASSWORD="$LAB3_INITIAL_PASSWORD" npm --prefix server run prisma:bootstrap
```

- [ ] **Step 5: Run idempotent Lab 3 seed**

Run:
```bash
DATABASE_URL="$DATABASE_URL" LAB3_INITIAL_PASSWORD="$LAB3_INITIAL_PASSWORD" npm --prefix server run prisma:seed
```

- [ ] **Step 6: Verify seed coverage**

Verify 10 users, 24 tickets, 8 public comments, and 4 internal notes exist in the disposable database.

---

### Task 2: Isolated Server, Client Ports & Playwright Configuration

**Files:**
- Modify: `playwright.config.ts`
- Modify: `server/src/storage/attachments.ts`

**Configuration Guard Rules:**
- `playwright.config.ts` validates `process.env.E2E_ALLOW_DB_WRITE === "1"` before starting servers or test discovery.
- Requires `DATABASE_URL` from the environment.
- Fails closed if `DATABASE_URL` is missing, ends with `/toktickit`, or does not match a disposable database pattern (`e2e`, `disposable`, or `test`).
- Configures server webServer on port `3104` and client on port `5174`.
- Configures `UPLOADS_DIR="/private/tmp/toktickit-e2e-uploads-20260918"`.

- [ ] **Step 1: Update `server/src/storage/attachments.ts` to support `process.env.UPLOADS_DIR`**

```typescript
export const uploadDirectory = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}
```

- [ ] **Step 2: Update `playwright.config.ts` with strict database guards and isolated ports**

```typescript
import { defineConfig, devices } from "@playwright/test";

if (process.env.E2E_ALLOW_DB_WRITE !== "1") {
  throw new Error("E2E_ALLOW_DB_WRITE=1 is required for E2E tests.");
}

const clientPort = Number(process.env.E2E_CLIENT_PORT || 5174);
const serverPort = Number(process.env.E2E_SERVER_PORT || 3104);
const clientOrigin = process.env.E2E_CLIENT_ORIGIN || `http://localhost:${clientPort}`;
const apiOrigin = process.env.E2E_API_ORIGIN || `http://localhost:${serverPort}`;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required for E2E tests.");
}

const parsedDb = new URL(databaseUrl);
const dbName = parsedDb.pathname.replace(/^\//, "");
if (dbName === "toktickit" || (!dbName.includes("e2e") && !dbName.includes("disposable") && !dbName.includes("test"))) {
  throw new Error(`Refusing to run E2E tests against protected or non-disposable database: "${dbName}". Use a dedicated disposable database.`);
}

const uploadsDir = process.env.UPLOADS_DIR || "/private/tmp/toktickit-e2e-uploads-20260918";

export default defineConfig({
  testDir: "./e2e/lab-03",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: clientOrigin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `npm run dev`,
      cwd: "server",
      port: serverPort,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        PORT: String(serverPort),
        CLIENT_ORIGIN: clientOrigin,
        DATABASE_URL: databaseUrl,
        UPLOADS_DIR: uploadsDir,
      },
    },
    {
      command: `npm run dev -- --port ${clientPort} --strictPort`,
      cwd: "client",
      port: clientPort,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        VITE_API_URL: apiOrigin,
      },
    },
  ],
});
```

- [ ] **Step 3: Verify TypeScript compilation and Playwright test discovery**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test --list
```

---

### Task 3: Shared E2E Helpers, Stable Screenshots & Comprehensive Cleanup (`e2e/lab-03/helpers.ts`)

**Files:**
- Modify: `e2e/lab-03/helpers.ts`

**Refactor Scope:**
- Fail closed if `E2E_INITIAL_PASSWORD` or `E2E_CHANGED_PASSWORD` is absent from `process.env`. Remove all plaintext passwords.
- Implement comprehensive `cleanAccounts()` in foreign-key-safe order.
- Implement `captureScreenshot(page, targetDir, filename, readyCondition)` using the stable screenshot protocol (headings, no loaders, reduced motion, font readiness).
- Implement `assertNoHorizontalOverflow(page)`: `document.documentElement.scrollWidth <= window.innerWidth`.
- Implement `assertTouchTargets(page, selector, minHeight = 44, square = false)`: verifies visible, non-hidden controls meet 44px minimum height (or 44×44px for icon buttons).
- Implement `createTicketFixture(requesterId, options)`: generates isolated ticket fixtures with unique ticket numbers.
- Ensure all created accounts use `${randomUUID()}@e2e.example`.

- [ ] **Step 1: Refactor `e2e/lab-03/helpers.ts`**

Update the helper implementations to enforce the security, cleanup, and screenshot protocols.

- [ ] **Step 2: Verify Playwright test discovery**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test --list
```

---

### Task 4: Authentication E2E Workflow & Evidence (`E2E-01`)

**Files:**
- Modify: `e2e/lab-03/authentication.spec.ts`

**Coverage:**
- Valid login routing: Requester → `/my-tickets`, Staff → `/staff/tickets`, Administrator → `/admin/users`.
- Invalid credentials: generic error alert ("Invalid email or password").
- Inactive account: "This account is inactive. Contact your administrator."
- Mandatory initial-password change: restricted to `/change-password`; checklist validated; saving new password rotates session and routes to role home.
- Page reload & session restoration: HttpOnly cookie verification, `document.cookie` never contains session token.
- Logout: revokes session, clears cookie, direct API calls return 401, navigating to protected routes shows login.
- Direct protected URL redirection: unauthenticated access to `/staff/tickets` routes to `/login`, and upon login routes to `/staff/tickets`.
- Account menu keyboard accessibility: opening menu, focusing items, pressing Escape to close and restore focus to the account button.
- Baseline & supplemental screenshots saved to `artifacts/lab-03/screenshots/authentication/`:
  - `desktop-login.png` (1440×900)
  - `tablet-login.png` (820×1180)
  - `mobile-login.png` (390×844)
  - `desktop-change-password.png` (1440×900)
  - `tablet-change-password.png` (820×1180)
  - `mobile-change-password.png` (390×844)
  - `mobile-login-invalid.png` (390×844)
  - `mobile-password-validation.png` (390×844)

- [ ] **Step 1: Update `e2e/lab-03/authentication.spec.ts`**

- [ ] **Step 2: Run authentication E2E tests**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test authentication.spec.ts
```

---

### Task 5: Authenticated Requester Regression & Communication (`E2E-04`)

**Files:**
- Modify: `e2e/lab-03/requester-regression.spec.ts`

**Coverage:**
- Preserves all 3 existing authenticated Lab 2 journeys:
  1. Creation workflow, validation errors, API failure callout, submitting busy state, success banner with ticket number, and My Tickets verification.
  2. Search, category/system filter, mobile cards (`.tickets-mobile-list .ticket-card`), desktop table (`table.tickets-table`), pagination, and empty state.
  3. Ticket detail view, additional attachment upload, download bytes verification, and soft-removal with mandatory reason audit trail.
- Extended Lab 3 journeys:
  4. Public Comments: Requester writes public comment, verifies backend author and timestamp, verifies draft is preserved on failure.
  5. Problem Appears Resolved: Requester clicks "Problem Appears Resolved", fills optional confirmation comment, confirms, verifies notice banner appears with requester name and timestamp without changing status to RESOLVED/CLOSED.
  6. Ownership isolation: Verifies a Requester accessing another Requester's ticket URL displays the safe ticket-not-found / forbidden error state (`[data-testid="detail-error"]`), matching nonexistent ticket behavior, and verifies internal notes are never rendered.
- Baseline & supplemental screenshots saved to `artifacts/lab-03/screenshots/requester/`:
  - `desktop-my-tickets.png` (1440×900)
  - `tablet-my-tickets.png` (820×1180)
  - `mobile-my-tickets.png` (390×844)
  - `desktop-create-ticket.png` (1440×900)
  - `tablet-create-ticket.png` (820×1180)
  - `mobile-create-ticket.png` (390×844)
  - `desktop-ticket-detail.png` (1440×900)
  - `tablet-ticket-detail.png` (820×1180)
  - `mobile-ticket-detail.png` (390×844)
  - `desktop-my-tickets-empty.png` (1440×900)
  - `desktop-attachment-soft-remove-modal.png` (1440×900)
  - `desktop-problem-resolved-modal.png` (1440×900)
  - `desktop-problem-resolved-active.png` (1440×900)

- [ ] **Step 1: Update `e2e/lab-03/requester-regression.spec.ts`**

- [ ] **Step 2: Run requester regression E2E tests**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test requester-regression.spec.ts
```

---

### Task 6: IT Staff Ticket Workflow (`E2E-02`)

**Files:**
- Create: `e2e/lab-03/staff-ticket-flow.spec.ts`

**Coverage:**
1. Staff login and Queue display (9 columns, status/priority badges, owner column, pagination).
2. Queue search, filters (category, status, requested priority, IT priority, owner), sorting (IT Priority desc tie-break), and pagination.
3. Queue states: populated, filtered no-results with "Clear Filters" button restoring queue, true-empty queue, failure with retry (simulated 500 error), forbidden for non-staff.
4. Queue state preservation: opening a ticket detail and navigating back via "Back to Queue" preserves lifted filter/sort/search/page criteria.
5. Claiming an unassigned ticket: opens unassigned NEW ticket fixture, clicks "Claim Ticket", verifies atomic transition to OPEN and owner becomes current staff.
6. Retrieving eligible owners and reassigning ownership: verifies eligible owners list (`/api/staff/eligible-owners`), reassigns ticket to another active staff/admin user, verifies updated owner badge.
7. Updating IT Priority: updates IT priority from LOW to HIGH, verifies version increment.
8. Status transitions & confirmation: transitions OPEN → IN_PROGRESS; transitions IN_PROGRESS → RESOLVED via confirmation dialog, verifies status updates to RESOLVED.
9. Optimistic concurrency conflict recovery: simulates 409 version conflict on mutation, verifies conflict banner appears, clicks "Reload Ticket", verifies state synchronizes.
10. Public comments vs Private internal notes:
    - Posts Public Comment: green card with "Public" label.
    - Switches to Internal Notes tab, posts Internal Note: amber card with "Private - IT Staff and Administrators" label.
    - Cross-role verification: logs in as the ticket's Requester, opens ticket detail, asserts Internal Note is completely absent from DOM.
11. Staff attachment inspection: staff views attachment metadata, downloads active attachment, verifies removed attachment has no download action and displays removal reason.
12. Requester resolution indication: staff views ticket with Requester's "Problem Appears Resolved" notice and timestamp.
13. Baseline & supplemental screenshots saved to `artifacts/lab-03/screenshots/staff-queue/` and `artifacts/lab-03/screenshots/staff-ticket-detail/`:
    - `staff-queue/desktop-staff-queue.png` (1440×900)
    - `staff-queue/tablet-staff-queue.png` (820×1180)
    - `staff-queue/mobile-staff-queue.png` (390×844)
    - `staff-queue/desktop-filtered-no-results.png` (1440×900)
    - `staff-ticket-detail/desktop-staff-detail.png` (1440×900)
    - `staff-ticket-detail/tablet-staff-detail.png` (820×1180)
    - `staff-ticket-detail/mobile-staff-detail.png` (390×844)
    - `staff-ticket-detail/desktop-claimed-open.png` (1440×900)
    - `staff-ticket-detail/desktop-status-confirmation.png` (1440×900)
    - `staff-ticket-detail/desktop-conflict-banner.png` (1440×900)

- [ ] **Step 1: Write `e2e/lab-03/staff-ticket-flow.spec.ts`**

- [ ] **Step 2: Run staff ticket workflow E2E tests**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test staff-ticket-flow.spec.ts
```

---

### Task 7: Administrator User Management Workflow (`E2E-03`)

**Files:**
- Create: `e2e/lab-03/user-administration.spec.ts`

**Coverage:**
1. Administrator login and User Management: table rendering (`table.users-table` inside `.users-table-container.desktop-only`, `.users-cards-container.mobile-only` on mobile).
2. Search and role filtering: debounced name/email search, role dropdown (REQUESTER, IT_STAFF, ADMINISTRATOR).
3. Create user with temporary password: form validation, live password requirement checklist (10 code points, uppercase, lowercase, digit, symbol, max 72 bytes); successful creation displays user in table with "Must change password" badge. User email uses `${randomUUID()}@e2e.example`.
4. Duplicate email handling: submits existing email, verifies 409 `DUPLICATE_EMAIL` error callout, verifies password field is cleared and other fields preserved.
5. Edit user: edits name, role, and active toggle; verifies updated record in table.
6. Reset initial password: opens reset modal, enters matching valid temporary password, submits, verifies success feedback and "Must change password" badge.
7. Form security: password fields cleared upon API failure; secrets never appear in error messages, URLs, or DOM.
8. Self-deactivation prevention: when editing own administrator account, active toggle is disabled with informative helper text (or API returns 409 `SELF_DEACTIVATION`).
9. Last-active-administrator protection (with try/finally restoration):
   - Create temporary Administrator (`${randomUUID()}@e2e.example`) and sign in as that user.
   - In a `try / finally` block:
     - Record seeded Administrator Morgan Davis's state.
     - Temporarily set Morgan Davis to `isActive: false`.
     - Attempt to demote the temporary Administrator's own role to `IT_STAFF`.
     - Assert HTTP 409 `LAST_ACTIVE_ADMIN` is returned.
   - In `finally`:
     - Restore Morgan Davis to `isActive: true`.
     - Clean up temporary administrator.
10. Session revocation after account changes: creates an active IT Staff user (`${randomUUID()}@e2e.example`), logs in as that user in a secondary browser context (`staffContext`), deactivates that user in the admin context, and verifies that the staff user's next request in `staffContext` fails with 401 Unauthorized.
11. Ticket unassignment on deactivation: creates an active IT Staff user (`${randomUUID()}@e2e.example`), creates a ticket owned by that staff user, deactivates the staff user in admin UI, and asserts that the ticket's `ownerId` becomes `null` and `version` increments.
12. No user deletion workflow: asserts no delete button or route exists in UI or API.
13. Baseline & supplemental screenshots saved to `artifacts/lab-03/screenshots/user-management/`:
    - `desktop-user-management.png` (1440×900)
    - `tablet-user-management.png` (820×1180)
    - `mobile-user-management.png` (390×844)
    - `desktop-create-user-modal.png` (1440×900)
    - `desktop-duplicate-email-error.png` (1440×900)
    - `desktop-reset-password-modal.png` (1440×900)
    - `desktop-self-deactivation-disabled.png` (1440×900)

- [ ] **Step 1: Write `e2e/lab-03/user-administration.spec.ts`**

- [ ] **Step 2: Run administrator user management E2E tests**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test user-administration.spec.ts
```

---

### Task 8: Responsive Layout, Accessibility & Zen Green Evidence (`VIS-01`)

**Files:**
- Create: `e2e/lab-03/responsive-accessibility.spec.ts`

**Coverage:**
- Inspects all 8 major screens across 3 viewports:
  - Desktop: 1440×900
  - Tablet: 820×1180
  - Mobile: 390×844
- Programmatic assertions:
  - No unintended horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`) across all 8 screens and 3 viewports.
  - Desktop table to mobile card switching:
    - Requester My Tickets: `table.tickets-table` visible on desktop/tablet; `.tickets-mobile-list` visible on mobile.
    - Staff Queue: `table.tickets-table` visible on desktop/tablet; `.tickets-mobile-list[data-testid="queue-mobile-list"]` visible on mobile.
    - User Management: `table.users-table` visible on desktop/tablet; `.users-cards-container.mobile-only` visible on mobile.
  - Touch targets: visible, interactive primary controls (buttons, inputs, dropdowns) on mobile have bounding box height >= 44px (and width >= 44px for icon buttons). Exclude hidden alternative layouts.
  - Visible focus indicators (`:focus-visible`).
  - Keyboard access & modal dialog focus traps:
    - Dialog open moves focus inside dialog card.
    - Tab wraps within modal (Tab cycle).
    - Escape dismisses dialog.
    - Focus restored to trigger element on dialog close.
  - ARIA attributes, roles, and error associations (`role="alert"`, `aria-invalid`, `aria-describedby`).
  - Zen Green design tokens (primary `#006B3C`, secondary `#0B7A46`, error `#DC2626`, page background `#F5F7F6`).
- Ensures all 24 baseline screenshots are captured and verified.

- [ ] **Step 1: Write `e2e/lab-03/responsive-accessibility.spec.ts`**

- [ ] **Step 2: Run responsive and accessibility E2E tests**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test responsive-accessibility.spec.ts
```

---

### Task 9: Full Suite Execution, Evidence Collection & Documentation

**Files:**
- Create: `artifacts/lab-03/test-results/issue-32-test-summary.txt`
- Modify: `docs/lab-03/tests.md`
- Modify: `docs/lab-03/ui-spec.md`

- [ ] **Step 1: Run full server test suite against disposable database**

Run:
```bash
DATABASE_URL="$DATABASE_URL" npm --prefix server test -- --run
```
Expected: 269/269 tests pass.

- [ ] **Step 2: Run full client test suite**

Run:
```bash
npm --prefix client test -- --run
```
Expected: 112/112 tests pass.

- [ ] **Step 3: Run full Lab 3 Playwright E2E suite**

Run:
```bash
E2E_ALLOW_DB_WRITE=1 DATABASE_URL="$DATABASE_URL" npx playwright test
```
Expected: All E2E test files (`authentication.spec.ts`, `requester-regression.spec.ts`, `staff-ticket-flow.spec.ts`, `user-administration.spec.ts`, `responsive-accessibility.spec.ts`) pass.

- [ ] **Step 4: Run server and client production builds**

Run:
```bash
npm --prefix server run build
npm --prefix client run build
```
Expected: Both builds complete with 0 errors.

- [ ] **Step 5: Inspect generated screenshot evidence**

Verify that all 24 baseline screenshots and 14 supplemental state screenshots exist under `artifacts/lab-03/screenshots/` and contain no clipped controls, overlapping text, horizontal overflow, plaintext passwords, session cookies, or tokens.

- [ ] **Step 6: Save sanitized test execution log artifact**

Save test outputs to `artifacts/lab-03/test-results/issue-32-test-summary.txt`, including tested branch/commit identifier, timestamp, commands (using `$DATABASE_URL`, `$LAB3_INITIAL_PASSWORD` placeholders), test counts, failures (0), and exit status (0). Sanitize any credentials or sensitive paths. Clearly label as feature-branch evidence.

- [ ] **Step 7: Update `docs/lab-03/tests.md` and `docs/lab-03/ui-spec.md`**

Update `docs/lab-03/tests.md` table rows for `E2E-01` through `E2E-04` and `VIS-01`, add Section 18 for Issue #32 verification results, and check off the performed visual verification items in `docs/lab-03/ui-spec.md`.

- [ ] **Step 8: Run git diff and whitespace checks**

Run:
```bash
git diff --check
git status
```
Verify that `client/package.json` retains its exact uncommitted change, no unexpected files were created, and no secrets exist in the working tree.
