# Lab 3 Test Plan and Traceability - TokTickIT

Status: Planned before implementation. Record per-PR execution separately; final release results must come from the final main branch. All file paths below are planned until implemented.

## 1. Strategy

- Unit tests cover password/session helpers, validation, authorization, and status-transition decisions.
- API/integration tests cover database behavior, authentication, authorization, ownership, transactions, and safe errors.
- Component tests cover user interactions, role navigation, feedback, and responsive rendering rules.
- Migration/regression tests prove existing Lab 2 data and behavior remain valid.
- Playwright E2E tests cover complete authentication, staff, administration, and requester journeys.
- Visual inspection records desktop, tablet, and mobile evidence for every major screen.

## 2. Planned Tests and Manual Checks

| ID | Type | AC | Scenario and expected result | Planned file | Status |
|---|---|---|---|---|---|
| API-01 | API | AC-01, AC-02 | Valid login succeeds; wrong password and unknown email share a safe response | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | AC-03 | Inactive account cannot authenticate | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | AC-04 | Initial-password session is restricted until valid password change | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | AC-05 | Logout revokes cookie access; expired/revoked session is unauthorized | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | AC-22 | Role middleware rejects direct cross-role API access | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-06 | API | AC-07 | Requester identity comes from session; supplied foreign requester ID cannot cross ownership | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-07 | API | AC-09 | Staff queue search/filter/sort/pagination and invalid query behavior | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-08 | API | AC-10 | Claim/reassign accepts eligible owners and rejects invalid, inactive, and stale updates | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-09 | API | AC-11 | IT Priority initializes correctly and only permitted roles can update it | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-10 | API | AC-12 | Status transition matrix permits valid and rejects invalid/stale transitions | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API | AC-13 | Public Comment validates content and records backend author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-12 | API | AC-14 | Requester Internal Note requests return forbidden with no note data | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-13 | API | AC-15 | Requester resolution indication is audited without formal status change | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-14 | API | AC-16, AC-17 | Administrator list/search/filter/create/edit and duplicate/invalid input | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-15 | API | AC-18 | Initial-password reset revokes sessions and forces next-login change | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-16 | API | AC-19 | Self-deactivation and final-active-administrator removal are blocked transactionally | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-17 | API | AC-10 | Eligible-owner endpoint returns only active IT Staff/Administrators and rejects Requesters | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-18 | API | AC-24 | Staff/Admin can read metadata and download active attachments; Requester ownership and removed-download rules remain enforced | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| UNIT-01 | Unit | AC-04, AC-25 | Password code-point/UTF-8 byte boundaries, exact confirmation, NUL/reuse rejection, fresh salted hashes | `server/tests/lab-03/password.test.ts` | Planned |
| UNIT-02 | Unit | AC-05, AC-25 | Token generation/digest, absolute expiry, clock boundaries, rotation/revocation | `server/tests/lab-03/session.test.ts` | Planned |
| UNIT-03 | Unit | AC-12, AC-22 | Table-driven tests of all status pairs, owner prerequisites, confirmation and role decisions | `server/tests/lab-03/ticket-policy.test.ts` | Planned |
| UNIT-04 | Unit | AC-17, AC-22 | Safe integer/range, enum, trimmed text, email, boolean, unknown-field validation | `server/tests/lab-03/validation.test.ts` | Planned |
| API-19 | API | AC-25 | Cookie flags/digest storage/expiry; missing or invalid Origin; allowed preflight; current-user gating; identical unknown/known throttling | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-20 | API | AC-19, AC-26 | Role/deactivation revokes sessions and unassigns owners; preserves authors/submissions; concurrent last-admin and assignment changes remain valid | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-21 | API | AC-12, AC-15 | Concurrent claim has one winner; stale version/status rejected; indication repeated/terminal rejected and reopening clears it | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-22 | API | AC-13, AC-14 | Empty/2000/2001 code-point communication; forged author/time; missing/inaccessible ticket; append-only/no-edit/delete; safe HTML payloads; concurrent appends retain both entries and increment version | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-23 | API | AC-08, AC-24 | Shared attachment reads reject mismatched IDs, removed file download and missing storage; preserve Unicode filename; deny staff upload/remove/rollback | `server/tests/lab-03/attachments.api.test.ts` | Planned |
| API-24 | API | AC-08 | Compensation cannot delete ticket with staff work; simultaneous upload limit holds; filesystem failures report retained ticket | `server/tests/lab-03/attachments.api.test.ts` | Planned |
| UI-01 | Component | AC-01, AC-02, AC-03 | Login validation, busy state, safe errors, success routing | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | Component | AC-04 | Mandatory Change Password validation, checklist, busy/error/success | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | Component | AC-05, AC-06 | Role navigation and logout remove protected access | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| UI-04 | Component | AC-09, AC-20 | Queue results, queries, pagination, empty/no-results/failure, mobile cards | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-05 | Component | AC-10, AC-11, AC-12 | Claim/reassign, priority/status controls, confirmation and conflict feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-06 | Component | AC-13, AC-14 | Public/private visual distinction, validation, and role restrictions | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | Component | AC-16-AC-19 | User list/search/filter/create/edit/reset and safety feedback | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-08 | Component | AC-07, AC-15 | Authenticated requester detail comments and resolution indication | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-09 | Component | AC-10, AC-24 | Eligible-owner loading/empty/failure/retry; stale option; staff attachment actions and removed/missing download feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-10 | Component | AC-05, AC-06, AC-25 | Session bootstrap/reload, direct-path guards, role change, cache clearing, logout failure/retry | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| STYLE-01 | Style | AC-20 | Shared tokens, all status/role labels, public/private distinction, editable/read-only and inline validation styling | `client/tests/lab-03/Theme.test.tsx` | Planned |
| VIS-01 | Browser/manual | AC-20 | All major screens at three viewports; overflow/overlap/clipping, text contrast, keyboard/dialog focus, labels and 44px touch targets | `e2e/lab-03/responsive-accessibility.spec.ts` plus UI visual checklist | Planned |
| MIG-01 | Integration | AC-21 | Migration preserves ticket/attachment counts and requester ownership | `server/tests/lab-03/migration-regression.test.ts` | Planned |
| SEED-01 | Integration | AC-23 | Repeated seed runs satisfy account counts and representative ticket/comment/note coverage without duplicates or plaintext passwords | `server/tests/lab-03/seed-regression.test.ts` | Planned |
| REG-01 | Regression | AC-08 | Complete Lab 1/Lab 2 server and client suites remain green | Existing `server/tests/lab-01..02` and `client/tests/lab-01..02` | Planned |
| E2E-01 | E2E | AC-01-AC-06 | Login, initial-password change, role shell, logout, blocked direct access | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-09-AC-15 | Staff queue/detail, assignment, priority/status, comments/notes, requester indication | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-16-AC-19 | Administrator creates/edits/deactivates/resets and safety rules hold | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-04 | E2E | AC-07, AC-08 | Authenticated requester completes Lab 2 creation/list/detail/attachment journey | `e2e/lab-03/requester-regression.spec.ts` | Planned |
| DOC-01 | Manual | AC-27 | Nine PDF headings, 60-point evidence mapping, live repository/PR/test links, actual review and reflection, final main SHA/results | `docs/lab-03/reviewer.md`, `ai-use.md`, final submission PDF | Planned |

## 3. Security Boundaries

Tests must include missing, malformed, expired, and revoked cookies; password-change-restricted sessions; cross-role calls; cross-requester ticket and attachment access; forbidden Internal Notes; forged requester IDs; invalid Origin on unsafe requests; login throttling; duplicate email races; and session revocation after deactivation/password reset.

Tests must assert that JSON responses never include password hashes, raw session values, Internal Note content for Requesters, or another Requester's protected data. Raw session values appear only in the cookie mechanism, with the specified flags, never URLs or response JSON.

## 4. Password Boundaries

Cover 9/10 Unicode code points and 71/72/73 UTF-8 bytes, including Thai and emoji input; each missing character class; exact confirmation; NUL rejection; incorrect current password; reuse; preserved whitespace; fresh salts; initial-password enforcement; and successful session rotation. Verify throttling at attempts 4/5/6 and at expiry using a controllable clock rather than sleeps.

## 5. Migration and Regression Evidence

Before migration, record counts and stable identifiers for users/requesters, tickets, attachments, and ticket ownership. After migration, assert:

- Every legacy Requester maps to one `REQUESTER` User.
- Every ticket maps to the same logical requester.
- Ticket and attachment counts and ticket numbers are unchanged.
- Previously null IT Priority equals Requested Priority after migration; existing non-null IT Priority remains unchanged.
- Seed reruns do not create duplicates.
- Existing attachment files and soft-removal metadata remain accessible under authenticated ownership rules.

Seed verification must assert at least four active and one inactive Requester, three active and one inactive IT Staff user, and one active Administrator. It also verifies assigned and unassigned tickets across every required status and priority, representative Public Comments and Internal Notes with permitted author roles, hashed credentials, and stable unique-record counts after running the seed twice.

MIG-01 additionally verifies normalized-email collision failure before mutation, exact legacy ID preservation, sequence advancement, inactive-user preservation, initial-password bootstrap/login, no department-management dependency, archived legacy-table preservation, removal of selector/key/endpoint, failed migration startup prevention, and recovery on a disposable Lab 2 snapshot. Hash attachment files before/after. Test pristine seed distribution (24 tickets, at least eight comments, at least four notes) separately from a modified fixture rerun: change a password, email, role, activation state and ticket priority, rerun, and assert none were reset or duplicated. Verify stable User.seedKey identity and safe failure on conflicting fixture email/key adoption. Fixture setup must not delete user development data.

## 6. Responsive, Accessibility, and Visual Matrix

Inspect Login, Change Password, Requester My Tickets, Create Ticket, Requester Detail, Staff Queue, Staff Detail, and User Management at representative desktop (1440x900), tablet (820x1180), and mobile (390x844) viewports.

Verify keyboard order, visible focus, labels/descriptions, modal focus and Escape behavior, status conveyed by text, 44px touch targets, adjacent validation, readable tables/cards, and absence of clipping, overlap, or horizontal overflow.

## 7. Baseline and Final Commands

```bash
npm --prefix server test
./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
npm --prefix client test
npm --prefix client run build
./node_modules/.bin/playwright test e2e/lab-03
./node_modules/.bin/playwright test e2e/lab-02
```

Sprint-start baseline on 2026-09-12:

- Client: 6 files and 29 tests passed.
- Client production build: passed.
- Server TypeScript build: passed.
- Server tests: environment-blocked. The runner reported an unreachable localhost:5432 database and EPERM when opening local sockets. This does not establish whether PostgreSQL was stopped or merely inaccessible in the sandbox. Re-run with confirmed database access and permitted local networking before implementation.

Final results, timestamps, commit SHA, and exact pass counts must be recorded here only after execution from final `main`.

## 8. Acceptance-Criterion Traceability

Every AC in `specification.md` is mapped above. A PR cannot mark an AC complete until its mapped automated tests pass and required manual checks/evidence are complete; AC-27 is a submission check verified through DOC-01 rather than application automation. Failures remain visible in this document until corrected; planned tests are never retroactively invented from implementation.

## 9. Requirement and Business-Rule Traceability

| Requirements/rules | Planned evidence |
|---|---|
| FR-01/02/03; BR-01/02/06/07/08/09/10/11/12 | API-01..04/19, UNIT-01/02, UI-01/02/03/10, E2E-01 |
| FR-04; BR-03/13/25 | API-05/06/19/20, UI-03/10, E2E-01/04 |
| FR-05/06; BR-18/27/30 | REG-01, API-06/23/24, UNIT-04, MIG-01, E2E-04 |
| FR-07; BR-05/17 | API-13/21, UI-08, E2E-02 |
| FR-08 | API-07, UI-04, E2E-02 |
| FR-09/10; BR-14/15/24/29 | API-08/09/10/17/20/21, UNIT-03, UI-05/09, E2E-02 |
| FR-11/12; BR-04/16/28 | API-11/12/22, UI-06/08, E2E-02 |
| FR-13/14/15/16; BR-19/20/21/22/23 | API-14/15/16/20, UI-07, E2E-03 |
| FR-17 | UI-01..10, STYLE-01, VIS-01, all E2E workflows |
| BR-26 | SEED-01 |

## 10. Execution, TDD, and Release Evidence

Unit tests run without external services. Integration/migration/seed/E2E tests use a dedicated disposable PostgreSQL database (separate TEST_DATABASE_URL) and test upload directory, never production or ordinary user data. Each suite creates uniquely identified fixtures and cleans only its own records/files; schema migration suites get a separate database. Align app/test configuration before test execution. E2E uses seeded users with known password-change states and restores only disposable fixtures.

During #26, retain unchanged Lab 2 behavior and tests. During #27/#28, replace tests for the intentionally removed selector with authenticated-user regression tests; adapt legacy API fixtures to sessions and Origin without dropping their ownership/validation/attachment assertions. Do not keep a test-only authentication bypass. The root test:e2e script currently targets Lab 2 only; #32 must add an explicit Lab 3/all-suites command and update README. Browser tests verify computed layout/focus; jsdom alone does not prove responsiveness.

For each implementation PR record: issue, branch/commit, test IDs, command, initial failing result (red), minimal implementation, passing result (green), refactor checks, and remaining failures. Add unforeseen regression cases with rationale while preserving the original plan. Re-run affected suites after review changes.

| Evidence stage | Commit | Commands/output path | Result |
|---|---|---|---|
| Sprint-start partial baseline | 1c27a89 | Prior executed output summarized in §7 | Client/build passed; server environment blocked |
| Issue #26 refactor evidence | c0e983a | Commands/results in §11 | Server 62/62; client 29/29; browser 3/3; type check/build passed |
| Issue #26 error-handling review fixes | 3e706dd | Commands/results in §12 | Server 68/68; client 29/29; browser 3/3; both builds/type check passed |
| Later feature-PR implementation evidence | Pending | Pending | Not run |
| Final lab3-staging validation | Pending | Pending | Not run |
| Final main validation | Pending | Pending | Not run |

Save final logs under artifacts/lab-03/test-results/ as readable .txt files with commit SHA, timestamp, commands, counts, failures, and exit status. Capture directory structure, final board/history and review evidence for the nine-part PDF. The user supplies GitHub evidence; never fabricate a closed issue, merge, reviewer identity/approval, or final passing count.

## 11. Issue #26 Backend Refactor Verification

Branch: `refactor/lab3-backend-layers`, based on reviewed staging merge `1f2ab29` (PR #34). Tested code is committed as `c0e983a`. Executed on 2026-09-13. These are per-PR regression results; final-main Lab 3 feature tests above remain planned.

The existing application logic was extracted into routes, controllers, services, validators, middleware, errors, storage, and utilities. Prisma remains the data-access layer. No schema, authentication, requester ownership contract, or client behavior changes are part of this issue. The existing app exports, endpoint status codes/payloads, Unicode filename behavior, transaction/retry logic, and attachment cleanup are preserved. Download stream errors now also reach the shared error boundary.

| Stage / check | Result |
| --- | --- |
| Unchanged Lab 1/2 server baseline | 35/35 passed in seven files |
| Compatibility tests added before extraction | 18/18 passed against the original app |
| Final server regression + compatibility + service tests | 62/62 passed in nine files |
| Client regression baseline (client unchanged) | 29/29 passed in six files |
| Server `tsc --noEmit --project server/tsconfig.json` | Passed |
| Client production build | Passed |
| Existing Lab 2 Playwright workflows | 3/3 passed: creation/upload/list; search/filter/pagination; detail/upload/soft removal |
| `git diff --check` | Passed |

The refactor uses a green → green workflow: baseline behavior and 18 characterization checks passed before extraction, then passed again after extraction. No artificial failing feature test is claimed for moving existing behavior. Nine added validator/service tests cover creation normalization and error order, query construction, invalid IDs, inactive-requester error precedence, and failed-upload cleanup. During test authoring, type checking caught a matcher unavailable in the installed Vitest version; it was replaced with supported assertions before the final passing run.

New test files:

- `server/tests/lab-03/backend-compatibility.test.ts`: 18 HTTP/error/filename compatibility checks, including safe endpoint-specific 500 responses, DB-independent health, unknown routes, and malformed JSON.
- `server/tests/lab-03/backend-services.test.ts`: nine direct validator/service checks with mocked database and cleanup boundaries.

Server baseline and final integration runs used the newly created disposable `toktickit_lab3_refactor_20260913` database, with existing migrations and Lab 2 seed. They did not target the ordinary development database. Legacy server tests retain their cwd-relative upload handling. Browser tests started dedicated servers with the same disposable database and ran from `/private/tmp/toktickit-refactor-e2e.17eExy`; uploads, screenshots, and browser output stayed in that temporary directory. Existing Lab 2 evidence was not overwritten.

Commands executed from `server/` with `DATABASE_URL` selecting that disposable database: `npx prisma migrate deploy`, `npm run prisma:seed`, and `npm test`. The pre-extraction characterization run used `npm test -- tests/lab-03/backend-compatibility.test.ts`. From the repository root: `npm --prefix client test`, `./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json`, and `npm --prefix client run build`. Browser verification used the unchanged `e2e/lab-02/requester-ticket-flow.spec.ts` through a temporary Playwright configuration with separate artifact paths and `reuseExistingServer: false`.

## 12. Issue #26 Error-Handling Review Fixes

Executed on 2026-09-14, code commit `3e706dd` on `refactor/lab3-backend-layers`. Peer feedback requested retained diagnostics and correct attachment stream error handling.

- Unexpected errors retain the original value in `ApiError.cause`. Server logging includes method, route pattern, status, safe application code, recognized filesystem/Prisma code, and stack frames. Raw error messages, request bodies, query values, cookies, and attachment filenames are not logged. Clients receive only the existing generic error envelope.
- Download headers are set only after the read stream emits `open`. Before response bytes are sent, stream failures return JSON and clear attachment disposition/length headers. After bytes are sent, the incomplete response is closed and the failure is logged; a second JSON response cannot replace a partial file. Streams are destroyed on failures and client disconnects.

`server/tests/lab-03/error-handling.test.ts` adds six checks: cause retention/safe diagnostics, expected validation errors, real ENOENT file-open failure, real EISDIR first-read failure after open, successful real-file/Unicode download, and a simulated failure after partial bytes. For the two real filesystem failures, only the preceding service validation result is stubbed; Node's actual `fs.createReadStream` opens/reads the supplied missing path or directory.

Red → green evidence: before the fixes, four of these six tests failed (lost cause, PDF MIME on both early stream failures, and missing diagnostics after partial transfer). After the fixes, all six passed.

| Verification command | Result |
| --- | --- |
| `npm test -- tests/lab-03/error-handling.test.ts` from server | 6/6 passed |
| `npm test` from server with the disposable database URL | 68/68 passed in ten files |
| `npm --prefix client test` | 29/29 passed in six files |
| `./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json` | Passed |
| `npm --prefix server run build` | Passed; output under ignored server/dist |
| `npm --prefix client run build` | Passed |
| Existing Lab 2 Playwright workflow via temporary config | 3/3 passed |
| `git diff --check` | Passed |

Full database tests used `toktickit_lab3_refactor_20260913`, the disposable database from §11. Browser servers used that same database and fresh `/private/tmp/toktickit-refactor-review.JKyiXz` upload/screenshot/result paths, with `reuseExistingServer: false`. Browser command from that temporary directory: `/Users/meng/dev/MyUniversity/CPE334-SoftwareEngineer/toktickit/node_modules/.bin/playwright test --config /private/tmp/toktickit-refactor-review.JKyiXz/playwright.config.mjs`. These are review-fix results, not final-main release evidence.
