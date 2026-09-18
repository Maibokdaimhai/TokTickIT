# Lab 3 Test Plan and Traceability - TokTickIT

Status: Plan with per-PR implementation evidence. Issue #27 results are recorded in §13; remaining features and final release validation are still pending. Final release results must come from the final main branch.

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
| API-01 | API | AC-01, AC-02 | Valid login succeeds; wrong password and unknown email share a safe response | `server/tests/lab-03/auth.api.test.ts` | Passed for #27; see §13 |
| API-02 | API | AC-03 | Inactive account cannot authenticate | `server/tests/lab-03/auth.api.test.ts` | Passed for #27; see §13 |
| API-03 | API | AC-04 | Initial-password session is restricted until valid password change | `server/tests/lab-03/auth.api.test.ts` | Passed for #27; see §13 |
| API-04 | API | AC-05 | Logout revokes cookie access; expired/revoked session is unauthorized | `server/tests/lab-03/auth.api.test.ts` | Passed for #27; see §13 |
| API-05 | API | AC-22 | Role middleware rejects direct cross-role API access | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-06 | API | AC-07 | Requester identity comes from session; supplied foreign requester ID cannot cross ownership | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-07 | API | AC-09 | Staff queue search/filter/sort/pagination and invalid query behavior | `server/tests/lab-03/staff-queue.api.test.ts` | Implemented for #29; see §15 |
| API-08 | API | AC-10 | Claim/reassign accepts eligible owners and rejects invalid, inactive, and stale updates | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-09 | API | AC-11 | IT Priority initializes correctly and only permitted roles can update it | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-10 | API | AC-12 | Status transition matrix permits valid and rejects invalid/stale transitions | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API | AC-13 | Public Comment validates content and records backend author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-12 | API | AC-14 | Requester Internal Note requests return forbidden with no note data | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-13 | API | AC-15 | Requester resolution indication is audited without formal status change | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-14 | API | AC-16, AC-17 | Administrator list/search/filter/create/edit and duplicate/invalid input | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-15 | API | AC-18 | Initial-password reset revokes sessions and forces next-login change | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-16 | API | AC-19 | Self-deactivation and final-active-administrator removal are blocked transactionally | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-17 | API | AC-10 | Eligible-owner endpoint returns only active IT Staff/Administrators and rejects Requesters | `server/tests/lab-03/staff-queue.api.test.ts` | Implemented for #29; see §15 |
| API-18 | API | AC-24 | Staff/Admin can read metadata and download active attachments; Requester ownership and removed-download rules remain enforced | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| UNIT-01 | Unit | AC-04, AC-25 | Password code-point/UTF-8 byte boundaries, exact confirmation, NUL/reuse rejection, fresh salted hashes | `server/tests/lab-03/password.test.ts` | Passed for #27; see §13 |
| UNIT-02 | Unit | AC-05, AC-25 | Token generation/digest, absolute expiry, clock boundaries, rotation/revocation | `server/tests/lab-03/session.test.ts` | Passed for #27; see §13 |
| UNIT-03 | Unit | AC-12, AC-22 | Table-driven tests of all status pairs, owner prerequisites, confirmation and role decisions | `server/tests/lab-03/ticket-policy.test.ts` | Planned |
| UNIT-04 | Unit | AC-17, AC-22 | Safe integer/range, enum, trimmed text, email, boolean, unknown-field validation | `server/tests/lab-03/validation.test.ts` | Planned |
| API-19 | API | AC-25 | Cookie flags/digest storage/expiry; missing or invalid Origin; allowed preflight; current-user gating; identical unknown/known throttling | `server/tests/lab-03/auth.api.test.ts` | Passed for #27; see §13 |
| API-20 | API | AC-19, AC-26 | Role/deactivation revokes sessions and unassigns owners; preserves authors/submissions; concurrent last-admin and assignment changes remain valid | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-21 | API | AC-12, AC-15 | Concurrent claim has one winner; stale version/status rejected; indication repeated/terminal rejected and reopening clears it | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-22 | API | AC-13, AC-14 | Empty/2000/2001 code-point communication; forged author/time; missing/inaccessible ticket; append-only/no-edit/delete; safe HTML payloads; concurrent appends retain both entries and increment version | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-23 | API | AC-08, AC-24 | Shared attachment reads reject mismatched IDs, removed file download and missing storage; preserve Unicode filename; deny staff upload/remove/rollback | `server/tests/lab-03/attachments.api.test.ts` | Planned |
| API-24 | API | AC-08 | Compensation cannot delete ticket with staff work; simultaneous upload limit holds; filesystem failures report retained ticket | `server/tests/lab-03/attachments.api.test.ts` | Planned |
| UI-01 | Component | AC-01, AC-02, AC-03 | Login validation, busy state, safe errors, success routing | `client/tests/lab-03/Authentication.test.tsx` | Passed for #27; see §13 |
| UI-02 | Component | AC-04 | Mandatory Change Password validation, checklist, busy/error/success | `client/tests/lab-03/Authentication.test.tsx` | Passed for #27; see §13 |
| UI-03 | Component | AC-05, AC-06 | Role navigation and logout remove protected access | `client/tests/lab-03/Authentication.test.tsx` | #27 subset passed; later scope pending (§13) |
| UI-04 | Component | AC-09, AC-20 | Queue results, queries, pagination, empty/no-results/failure, mobile cards | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Implemented for #29; see §15 |
| UI-05 | Component | AC-10, AC-11, AC-12 | Claim/reassign, priority/status controls, confirmation and conflict feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-06 | Component | AC-13, AC-14 | Public/private visual distinction, validation, and role restrictions | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | Component | AC-16-AC-19 | User list/search/filter/create/edit/reset and safety feedback | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-08 | Component | AC-07, AC-15 | Authenticated requester detail comments and resolution indication | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-09 | Component | AC-10, AC-24 | Eligible-owner loading/empty/failure/retry; stale option; staff attachment actions and removed/missing download feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-10 | Component | AC-05, AC-06, AC-25 | Session bootstrap/reload, direct-path guards, role change, cache clearing, logout failure/retry | `client/tests/lab-03/Authentication.test.tsx` | #27 subset passed; later scope pending (§13) |
| STYLE-01 | Style | AC-20 | Shared tokens, all status/role labels, public/private distinction, editable/read-only and inline validation styling | `client/tests/lab-03/Theme.test.tsx` | Planned |
| VIS-01 | Browser/manual | AC-20 | All major screens at three viewports; overflow/overlap/clipping, text contrast, keyboard/dialog focus, labels and 44px touch targets | `e2e/lab-03/responsive-accessibility.spec.ts` plus UI visual checklist | Planned |
| MIG-01 | Integration | AC-21 | Migration preserves ticket/attachment counts and requester ownership | `server/tests/lab-03/migration-seed.test.ts` | Passed for #27; see §13 |
| SEED-01 | Integration | AC-23 | Repeated seed runs satisfy account counts and representative ticket/comment/note coverage without duplicates or plaintext passwords | `server/tests/lab-03/migration-seed.test.ts` | Passed for #27; see §13 |
| REG-01 | Regression | AC-08 | Complete Lab 1/Lab 2 server and client suites remain green | Existing `server/tests/lab-01..02` and `client/tests/lab-01..02` | Passed for #27; see §13 |
| E2E-01 | E2E | AC-01-AC-06 | Login, initial-password change, role shell, logout, blocked direct access | `e2e/lab-03/authentication.spec.ts` | #27 subset passed; later scope pending (§13) |
| E2E-02 | E2E | AC-09-AC-15 | Staff queue/detail, assignment, priority/status, comments/notes, requester indication | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-16-AC-19 | Administrator creates/edits/deactivates/resets and safety rules hold | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-04 | E2E | AC-07, AC-08 | Authenticated requester completes Lab 2 creation/list/detail/attachment journey | `e2e/lab-03/requester-regression.spec.ts` | #27 subset passed; later scope pending (§13) |
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

Unit tests run without external services. Integration/migration/seed/E2E tests use a dedicated disposable PostgreSQL database selected explicitly by DATABASE_URL and a test upload directory, never production or ordinary user data. Each suite creates identified fixtures and cleans only its own records/files; migration tests additionally create/drop unique schemas inside that disposable database. Align app/test configuration before execution. E2E uses uniquely created users with known password-change states and cleans only its own disposable fixtures.

During #26, retain unchanged Lab 2 behavior and tests. During #27/#28, replace tests for the intentionally removed selector with authenticated-user regression tests; adapt legacy API fixtures to sessions and Origin without dropping their ownership/validation/attachment assertions. Do not keep a production authentication bypass. Controller-only transport tests may mount routers in a test-local app to isolate stream errors; full API regression tests must use persisted sessions. Issue #27 updates test:e2e to the Lab 3 directory and adds auth/requester commands; #32 extends those suites for remaining staff/admin work. Browser tests verify computed layout/focus; jsdom alone does not prove responsiveness.

For each implementation PR record: issue, branch/commit, test IDs, command, initial failing result (red), minimal implementation, passing result (green), refactor checks, and remaining failures. Add unforeseen regression cases with rationale while preserving the original plan. Re-run affected suites after review changes.

| Evidence stage | Commit | Commands/output path | Result |
|---|---|---|---|
| Sprint-start partial baseline | 1c27a89 | Prior executed output summarized in §7 | Client/build passed; server environment blocked |
| Issue #26 refactor evidence | c0e983a | Commands/results in §11 | Server 62/62; client 29/29; browser 3/3; type check/build passed |
| Issue #26 error-handling review fixes | 3e706dd | Commands/results in §12 | Server 68/68; client 29/29; browser 3/3; both builds/type check passed |
| Issue #27 authentication and migration | 397aa9b | Commands/results in §13 | Server 96/96; client 36/36; browser 6/6; builds passed |
| Issue #28 requester authorization | 4275095 | Commands/results in §14 | Server 109/109; client 36/36; browser 3/3; builds passed |
| Issue #29 IT Staff ticket queue | feature/lab3-staff-queue | Commands/results in §15 | Server 146/146; client 53/53; builds passed |
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

## 13. Issue #27 Authentication, Migration, and Seed Verification

Executed on 2026-09-14 on `feature/lab3-authentication`, based on merged PR #35 / `352663d`. Code commit: `397aa9b`. This is an intermediate feature-PR result, not final-main release evidence or completion of the #28 authorization cutover.

Implemented: User migration with retained legacy archive/IDs/timestamps, session and throttle persistence, cost-12 bcrypt, explicit initial-password bootstrap, forced/self-service password change, login/logout/me, strict Origin and credentialed CORS, safe error responses, account menu and cookie-backed requester context, plus the schema/fixtures needed by later issues. Staff/Admin workspaces are placeholders. Ticket/attachment inputs still use the legacy requesterId contract until #28; full role/ownership enforcement remains pending.

| Verification | Result |
| --- | --- |
| Complete backend suite | 96/96 passed in 13 files |
| Complete client suite | 36/36 passed in seven files |
| Server no-emit type check and production build | Passed |
| Client production build | Passed |
| Compiled server smoke check on isolated port | Public health 200; anonymous protected request 401 |
| Authentication browser journeys | 3/3 passed |
| Authenticated Lab 2 requester regression journeys | 3/3 passed |
| `git diff --check` | Passed |

New automated coverage:

- `auth.api.test.ts`: 13 tests cover safe login identity, normalized email, cookie flags/digest-only storage, login rotation, generic failures, inactive credentials, fixed-window throttling for known/unknown identifiers, forced change, validation/reuse, all-session revocation, current role/activation checks, absolute expiry, logout, retired enumeration, exact Origin/preflight, malformed/oversized input, and concurrent password changes.
- `password.test.ts` / `session.test.ts`: 14 tests cover Unicode/byte boundaries, missing character classes, NUL, preserved whitespace, salt/cost, token entropy/digests, malformed and duplicate cookies.
- `migration-seed.test.ts`: four real-SQL tests use unique disposable schemas. They cover empty-database replay, collision rollback, retained records/file bytes, explicit bootstrap/readiness, migrated active/inactive login, bootstrap rerun, sequence advancement, seed collision rollback, role/status/priority/owner/author coverage, and preservation of edited password/email/role/activation/tickets/comments/notes on rerun.
- Client `Authentication.test.tsx` / `auth-api.test.ts`: 12 checks cover removal of stored development identity, loading/busy/errors, password visibility/checklist/field feedback, successful login/change/logout, current role shell, session expiry/restriction, logout failure, account menu, and credentialed fetch behavior.
- `e2e/lab-03/authentication.spec.ts`: real-cookie login, mandatory password change, reload/logout, invalid/inactive login, Staff/Admin placeholder shells, and account-menu Escape/focus restoration. Login screenshots at 1280/768/375px and mandatory-change mobile screenshots supplement no-horizontal-overflow assertions.
- `e2e/lab-03/requester-regression.spec.ts`: authenticated copy of the three historical Lab 2 workflows; creation validation/failure/busy/success/upload, list/search/filter/pagination/mobile/empty state, detail/upload/download bytes/soft removal. Historical Lab 2 browser files and evidence were not overwritten.

Existing selector-specific tests were deliberately replaced, not silently disabled. Existing API regressions use real persisted sessions and Origin through `tests/authenticated-request.ts`; their legacy validation/ownership/attachment assertions are preserved for this increment. The separate controller/stream test app isolates transport failures without weakening production authentication. Client presentation fixtures live only under tests and preserve the older race/filter/page-reset checks. Malformed JSON now intentionally returns safe JSON instead of Express HTML.

### Migration and recovery rehearsal

The first rehearsal used `toktickit_lab3_auth_20260914`, cloned from the existing disposable Lab 2 regression database, and proved startup is blocked before password bootstrap. The final SQL was applied to `toktickit_lab3_auth_final_20260914`, cloned from a verified restore of that Lab 2 snapshot. The ordinary development database was never migrated or reset.

The backup was created with `pg_dump -Fc` and restored with `pg_restore --exit-on-error` to the new disposable `toktickit_lab2_restore_20260914`. Restored counts and row-JSON MD5 checksums matched the pre-migration snapshot exactly:

| Legacy table | Rows | Matching checksum |
| --- | --- | --- |
| RequesterUser | 5 | `325995c9005c182eebc4f31ae7aaea2f` |
| Ticket | 13 | `15b06254919eab5728e3414e27171cd0` |
| Attachment | 4 | `a0973832ef8ffa3b43b4addc1dfd5b7f` |

After final migration, bootstrap, and seed, a separate record-by-record comparison verified all five original identities, all 13 original tickets, all four attachment records, original timestamps and ownership mappings. Only null IT Priority values were initialized. The seed produced ten personas, 24 additional fixture tickets, eight public comments, and four internal notes. The SQL fixture rehearsal separately verifies actual attachment bytes with SHA-256; database-restore checksums alone are not claimed as a physical uploads restore. Operators still need a paired database/uploads backup before upgrading their own database.

An empty migration replay applies passwordHash NOT NULL immediately because no legacy hashes are missing. A populated upgrade remains stopped until bootstrap fills missing hashes and applies the same constraint. This keeps the final schema identical for fresh installs and upgraded databases, including later Prisma shadow replays. Adoption of a legacy fixture key uses an update that preserves the original audit timestamp.

### Commands and evidence locations

Final database URL selected `toktickit_lab3_auth_final_20260914` through DATABASE_URL. From server: `npx prisma migrate deploy`, `npm run prisma:bootstrap`, `npm run prisma:seed`; from root: `npm --prefix server test`, `npm --prefix client test`, `./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json`, `npm --prefix server run build`, and `npm --prefix client run build`. Bootstrap/seed used explicit test-only initial credentials; no operational password is recorded here.

Browser verification ran from `/private/tmp/toktickit-auth-e2e.6tRyy0` with its temporary Playwright configuration, `reuseExistingServer: false`, frontend 5174 and backend 3103 because the normal frontend port was occupied. DATABASE_URL selected the final disposable copy; E2E_ALLOW_DB_WRITE=1 and the E2E origin variables matched those ports. Screenshots/uploads/results stayed in that temporary directory. These artifacts are local per-PR evidence; #32/#33 still need durable final-commit evidence.

During implementation, old User-schema fixtures and synchronous pre-auth App tests initially failed and were adapted to the intentional authentication change. Type checking caught unsupported test options; the test glob was expanded to include the new `.test.ts` API-client checks. A development-port collision was resolved by using isolated test ports. The former production start path was corrected to `dist/src/index.js` and smoke-tested. This was iterative implementation/regression verification; no unobserved test-first/red result is claimed. Dependency installation reported eight existing server audit advisories; no unrelated dependency upgrade or audit fix was performed.

Remaining after this recorded #27 run: complete #28 server-derived ownership/endpoint roles, later staff/admin workflows, complete responsive/final evidence, user-created PR/peer approval, and final staging/main reruns. The author's selected AI prompts/reflection remain untouched.

## 14. Issue #28 Authenticated Requester Authorization Verification

Executed on 2026-09-15 on `feature/lab3-authorization-requester`, based on merged PR #36 / `4275095`. This is feature-branch evidence for AC-07, AC-08, AC-22, and AC-24; peer review and staging merge remain user-owned GitHub steps.

Implemented: requester ticket creation, listing, detail, rollback, attachment upload, and soft removal derive identity only from the persisted session. Final client requests no longer send `requesterId`; any legacy value supplied to a recognized body/query location is ignored and cannot select another identity. Unknown fields remain rejected. Inaccessible requester tickets and attachments use non-disclosing 404 responses. Requester-only routes reject IT Staff and Administrators before resource or multipart processing. Attachment metadata and active-file download permit all authenticated roles, retain ticket/attachment pair validation, hide storage paths, and continue to block removed downloads. Compensation rollback now locks and rechecks the ticket, returning 409 if assignment, status, comments, notes, or a resolution indication show that work has started.

New `requester-authorization.api.test.ts` coverage uses real persisted sessions for all three roles. It verifies forged legacy identity resistance, cross-requester 404 behavior, direct cross-role 403 behavior, reference-data access, privileged active attachment reads, removed metadata/download rules, mismatch handling, storage-path omission, and rollback retention after staff work. Lab 2 server and client fixtures were adapted to the session contract without dropping creation, list/filter/page, detail, attachment, compensation, or stale-response assertions.

| Verification | Result |
| --- | --- |
| Complete backend suite on disposable migrated/seeded database | 109/109 passed in 14 files |
| Complete client suite | 36/36 passed in seven files |
| Focused authorization and requester regressions | 53/53 passed in six server files |
| Server production build | Passed |
| Client production build | Passed |
| Authenticated requester browser regressions | 3/3 passed |
| `git diff --check` | Passed |

The backend and browser suites used `toktickit_lab3_auth_final_20260914`; the ordinary development database was not migrated or reset. Browser servers used isolated ports 3103/5174 and temporary output under `/private/tmp/toktickit-auth-e2e.6tRyy0`; durable cross-role screenshot evidence remains assigned to #32. The expected diagnostic output from error-boundary tests contains only sanitized route/error context. No dependencies were added for Issue #28. The author's `ai-use.md` remains untouched.

## 15. Issue #29 IT Staff Ticket Queue Verification

Executed on 2026-09-17 on `feature/lab3-staff-queue`, based on merged PR #37 / `99470c2`. This increment implements the IT Staff Ticket Queue (`API-07`, `API-17`, and `UI-04`), covering AC-09, AC-10, and AC-20.

### Backend Endpoints
- `GET /api/staff/tickets`: Supports search (ticket number/summary up to 150 chars), category, requestedPriority, itPriority, status (all 8 lifecycle statuses), owner (`unassigned`, `me`, or positive user ID), and sort (with custom `itPriority_desc` implementing URGENT → HIGH → MEDIUM → LOW, tie-broken by `updatedAt: "desc"` and `id: "asc"`). Validates and rejects unknown query fields, returning 400 for invalid inputs while treating empty optional queries as unapplied. Safely projects exact queue fields, omitting private comments, internal notes, passwords, and server storage paths.
- `GET /api/staff/eligible-owners`: Returns active users with role `IT_STAFF` or `ADMINISTRATOR`, excluding inactive accounts and Requesters, deterministically ordered case-insensitively by name and ID.
- Role enforcement: Rejects unauthenticated requests (401) and Requester sessions (403).

### Frontend Component & Role Navigation
- `StaffTicketQueue.tsx`: Implements responsive Zen Green queue table (9 columns) and mobile cards (< 768px, with no horizontal scrolling). Features debounced search (300 ms), dual priority filters (Requested Priority and IT Priority), category/status/owner filters, sort selector, pagination controls (10/20/50 per page), true empty state, filtered no-results state with filter clearing, safe error retry, and distinct HTTP 403 Forbidden callout without retry.
- Role-controlled shell in `App.tsx` & `Header.tsx`: IT Staff defaults to `"ticket-queue"`, Administrator defaults to `"user-management"` placeholder with Ticket Queue option, and Requester defaults to `"my-tickets"` with no staff queue navigation.
- State lifting & detail placeholder: Minimal "Open" action displays ticket ID and Issue #30 notice while lifting queue filter/sort/pagination criteria in `App.tsx` so returning from detail retains active filters.

| Verification | Result |
| --- | --- |
| Complete backend suite on disposable database | 146/146 passed in 15 files |
| Complete client suite | 53/53 passed in 8 files |
| Focused staff queue API tests (`staff-queue.api.test.ts`) | 37/37 passed |
| Focused queue UI and role navigation integration (`StaffTicketQueue.test.tsx`) | 17/17 passed |
| Server production build | Passed (`npm --prefix server run build`) |
| Client production build | Passed (`npm --prefix client run build`) |
| `git diff --check` | Passed |

Database safety: All backend tests ran against the disposable test database `postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914`. The normal development database was never migrated or reset. The pre-existing uncommitted change in `client/package.json` was strictly preserved and never staged or committed.

## 16. Issue #30 Staff Ticket Operations, Public Comments, and Internal Notes Verification

Executed on 2026-09-17 on `feature/lab3-staff-ticket-operations`, based on commit `4885311` (merged PR #38 / Issue #29). This increment implements Staff Ticket Operations, Public Comments, Internal Notes, coordinating attachment versioning, and direct path routing (`API-08`, `API-09`, `API-10`, `API-11`, `API-12`, `API-13`, `API-14`, `API-15`, `API-16`, `API-23`, `API-24`, `UI-03`, `UI-05`, `UI-06`), covering AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-21, and AC-25.

### Backend Endpoints & Domain Policy
- `server/src/utils/ticket-policy.ts`: Enforces the ticket status lifecycle state transition matrix (`ALLOWED_TRANSITIONS` / `STATUS_TRANSITIONS`), terminal status handling, and confirmation requirements across all 8 schema statuses: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
  - Allowed transitions: `NEW -> ["OPEN", "CANCELLED"]`, `OPEN -> ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]`, `IN_PROGRESS -> ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]`, `WAITING_FOR_REQUESTER -> ["IN_PROGRESS", "RESOLVED", "CANCELLED"]`, `RESOLVED -> ["CLOSED", "REOPENED"]`, `REOPENED -> ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]`, `CLOSED -> ["REOPENED"]`, `CANCELLED -> ["REOPENED"]`. Same-status (no-op) transitions are rejected.
  - Confirmation required (`requiresConfirmation`): `RESOLVED`, `CLOSED`, `CANCELLED`, `REOPENED` (rejects unconfirmed with 400 `CONFIRMATION_REQUIRED`).
  - Owner required (`requiresEligibleOwner`): `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED` (rejects unassigned with 400 `OWNER_REQUIRED`).
- `server/src/validators/`:
  - `id.validator.ts`: Validates integer IDs as positive safe integers `<= 2147483647`.
  - `staff.validator.ts`: Validates `expectedVersion` as a non-negative integer within `[0..2147483647]` (explicitly allowing version 0 for newly created tickets; rejecting missing, strings, floats, and negative values); validates `ownerId` as positive integer or `null`; validates `itPriority` as enum; validates `status` as enum; validates `confirmed` as strict JSON boolean when supplied.
  - `communication.validator.ts`: Validates public comment and internal note content (1..2000 Unicode code points via `Array.from(trimmed).length`, rejecting empty, whitespace-only, or oversized bodies and unknown fields).
- `server/src/services/attachment.service.ts`:
  - `POST /api/tickets/:id/attachments` (API-23, API-24): Requester-only; increments ticket `version` and updates `updatedAt` in a transaction; returns complete `AttachmentMetadata` without `filePath`; enforces 5 active attachments limit with row-level locking (`SELECT id FROM "Ticket" WHERE id = $id FOR UPDATE`).
  - `POST /api/tickets/:id/attachments/:attachmentId/remove` (API-23, API-24): Requester-only; requires `removalReason` (minimum 3 characters); increments ticket `version` and updates `updatedAt` in a transaction; returns `AttachmentMetadata` with `downloadUrl: null` and without `filePath`.
  - `GET /api/tickets/:id/attachments/:attachmentId` (API-23): Downloads active attachment bytes; returns 403 `ATTACHMENT_REMOVED` if soft-removed; returns 404 `NOT_FOUND` if file is missing from storage.
- `server/src/controllers/communication.controller.ts` & `server/src/services/communication.service.ts`:
  - `GET /api/tickets/:id/public-comments` (API-13): Accessible by owning requester, IT Staff, and Admin; returns 404 for nonexistent or cross-requester tickets.
  - `POST /api/tickets/:id/public-comments` (API-14): Accessible by owning requester, IT Staff, and Admin; appends comment, increments ticket `version`, and touches `updatedAt`.
  - `GET /api/staff/tickets/:id/internal-notes` (API-15): Restricted to IT Staff and Admin; Requesters denied 403 before ticket lookup.
  - `POST /api/staff/tickets/:id/internal-notes` (API-16): Restricted to IT Staff and Admin; Requesters denied 403 before ticket lookup; appends internal note, increments ticket `version`, and touches `updatedAt`.
  - `POST /api/tickets/:id/problem-appears-resolved` (API-22): Restricted to owning Requester; increments ticket `version` and touches `updatedAt`.
- `server/src/controllers/staff.controller.ts` & `server/src/services/staff.service.ts`:
  - `GET /api/staff/tickets/:id` (API-08): Retrieves staff ticket detail with requester details, eligible owners list, attachments (with download URLs without file paths), public comments, and internal notes. Restricted to IT Staff and Admin.
  - `POST /api/staff/tickets/:id/claim` (API-09): Assigns ticket to authenticated staff member. Uses optimistic concurrency (`expectedVersion`); returns 409 `VERSION_CONFLICT` on mismatch; returns 409 `ALREADY_ASSIGNED` if ticket is already assigned to an owner. Transitions `NEW` status to `OPEN`.
  - `PATCH /api/staff/tickets/:id/owner` (API-10): Reassigns ticket owner or unassigns (`ownerId: null`). Validates target owner is an active IT Staff or Administrator (returns 400 `INVALID_OWNER` otherwise). Uses optimistic concurrency (`expectedVersion`, 409 `VERSION_CONFLICT`).
  - `PATCH /api/staff/tickets/:id/it-priority` (API-11): Sets IT priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`). Uses optimistic concurrency (`expectedVersion`, 409 `VERSION_CONFLICT`).
  - `PATCH /api/staff/tickets/:id/status` (API-12): Updates status according to state machine matrix. Rejects illegal transitions with 400 `INVALID_STATUS_TRANSITION`. Requires `confirmed: true` for `RESOLVED`, `CLOSED`, `CANCELLED`, `REOPENED` (returning 400 `CONFIRMATION_REQUIRED` if unconfirmed). Requires owner for `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED` (returning 400 `OWNER_REQUIRED`). Uses optimistic concurrency (`expectedVersion`, 409 `VERSION_CONFLICT`).

### Frontend Components, Direct Path Routing & State Safety
- `TicketDetailPage.tsx` (Requester Ticket Detail, UI-03):
  - Displays ticket details, metadata, attachments, and public comments timeline.
  - Public comment composer with Unicode code point counting (`Array.from(trimmed).length`), character counter, loading states, and draft preservation across network failures.
  - Refresh safety rule: Refetches ticket detail after posting comment to synchronize ticket `version`.
  - Accessible Problem Appears Resolved confirmation modal with proper ARIA attributes, focus management, backdrop click, Escape key dismiss, and error handling.
- `StaffTicketDetail.tsx` (Staff Ticket Detail, UI-05, UI-06):
  - Operational card for Staff/Admin: displays ticket ID, title, requester, created/updated timestamps, version badge, and current operational status.
  - Unassigned vs empty owner list distinction with clear UX callout.
  - One-click Claim action for unassigned tickets.
  - Owner reassignment dropdown with automatic owner list refresh upon receiving 400 `INVALID_OWNER`.
  - IT priority selector with optimistic concurrency handling.
  - Status transition dropdown populated with only legal next statuses.
  - Accessible status change confirmation dialog for `RESOLVED`, `CLOSED`, `CANCELLED`, `REOPENED`.
  - Optimistic locking conflict (409) modal with non-destructive state reload and error reporting.
  - Public comments & internal notes tabs with independent composers, Unicode code point counting (`Array.from(trimmed).length`), character counters, error alerts, and draft preservation upon network failure.
  - Credentialed attachment download handler: handles 403 `ATTACHMENT_REMOVED` and 404 missing-file responses, renders safe error callout banner, and refreshes ticket metadata.
  - Refresh safety rule: Refetches ticket upon comment or note creation to prevent stale `expectedVersion` in subsequent operational actions.
- `App.tsx` Direct Path Routing:
  - Canonical routes: `/login`, `/change-password`, `/my-tickets`, `/tickets/new`, `/tickets/:id`, `/staff/tickets`, `/staff/tickets/:id`, `/admin/users`.
  - Role protection guards: Requesters attempting staff/admin paths redirect to `/my-tickets`; Staff/Admin attempting requester-only paths (`/my-tickets`, `/tickets/new`, `/tickets/:id`) see safe forbidden view.
  - Invalid ID validation: non-positive integer IDs in `/tickets/:id` or `/staff/tickets/:id` render clean invalid ticket / 404 views.
  - Unknown URL handling: 404 Not Found page with return home button.
  - Browser navigation support: synchronizes `window.history` via `pushState` and handles `popstate` events.
  - Preserves lifted queue filter, sort, and pagination state when navigating between `/staff/tickets` and `/staff/tickets/:id`.

### Verification Results

| Verification | Result |
| --- | --- |
| Complete client test suite | 93/93 passed in 11 files |
| Focused staff ticket detail UI (`StaffTicketDetail.test.tsx`) | 18/18 passed |
| Focused requester ticket detail UI (`RequesterTicketDetail.test.tsx`) | 7/7 passed |
| Focused direct path routing & guards (`Routing.test.tsx`) | 15/15 passed |
| Staff ticket queue integration & state preservation (`StaffTicketQueue.test.tsx`) | 17/17 passed |
| Server unit policy & validator tests (`ticket-policy.test.ts`, `backend-services.test.ts`) | 22/22 passed |
| Server auth unit tests (`password.test.ts`, `session.test.ts`) | 14/14 passed |
| Server production build | Passed (`npm --prefix server run build`) |
| Client production build | Passed (`npm --prefix client run build`) |
| `git diff --check` | Passed |

Database Integration Execution: Server database integration tests require an active PostgreSQL instance configured via `DATABASE_URL`. When executed against the disposable test database (`postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914`), all 19 server test files (including `staff-ticket-detail.api.test.ts`, `comments-notes.api.test.ts`, and `attachments.api.test.ts`) passed (209/209). In environments where PostgreSQL or local sockets are unprovisioned, database integration tests cannot run and will fail to connect. The ordinary development database was never migrated or reset. The pre-existing uncommitted change in `client/package.json` was strictly preserved and never staged or committed.

## 17. Issue #31 Administrator User Management Verification

Executed on 2026-09-18 on `feature/lab3-admin-users`. This increment implements minimalist Administrator User Management according to AC-16 through AC-19, and AC-26 (`API-14`, `API-15`, `API-16`, `API-20`, `UI-07`).

### Backend Endpoints & Concurrency Protections
- `server/src/validators/admin.validator.ts`: Validates admin user management inputs:
  - Query parameters: accepts `search` (trimmed string, at most 150 code points) and `role` (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`) only; rejects any unknown query keys with 400 `VALIDATION_ERROR`. No pagination, status filter, or sorting parameters are supported.
  - Creation payload (`POST /admin/users`): requires `name` (1..100 characters), `email` (normalized, lowercase <= 254), `role` (enum), `isActive` (boolean), and `initialPassword` (requires shared policy: at least 10 Unicode code points, at most 72 UTF-8 bytes, no NUL, uppercase, lowercase, digit, and symbol excluding letters, digits, and whitespace).
  - Update payload (`PATCH /admin/users/:id`): optional `name`, `email`, `role`, and `isActive`; rejects empty bodies and unknown fields.
  - Password reset payload (`POST /admin/users/:id/initial-password`): requires matching `initialPassword` and `confirmPassword` conforming to the shared 10-code-point/72-byte password policy.
- `server/src/services/admin.service.ts`:
  - `GET /admin/users` (`API-14`): Filters users by search (matching name or email case-insensitively) and role; returns 200 `{ "users": AdminUser[] }` sorted case-insensitively by name, then id.
  - `POST /admin/users` (`API-14`): Creates user with cost-12 bcrypt hash; sets `mustChangePassword: true`; acquires `pg_advisory_xact_lock(hashtext('admin-user-count'))` to protect admin counts; returns 201 `{ "user": AdminUser }`. Duplicate email returns 409 `DUPLICATE_EMAIL`.
  - `PATCH /admin/users/:id` (`API-14`, `API-16`, `API-20`):
    - Email uniqueness check when email is updated (409 `DUPLICATE_EMAIL`).
    - Prevents self-deactivation: rejects with 409 `SELF_DEACTIVATION` when an administrator attempts to deactivate their own account.
    - Prevents deactivating or demoting the last active administrator: acquires advisory transaction lock `pg_advisory_xact_lock(hashtext('admin-user-count'))`, verifies active administrator count under the lock, and returns 409 `LAST_ACTIVE_ADMIN`.
    - Global lock ordering: Locks target user row first (`SELECT id FROM "User" WHERE id = $id FOR UPDATE`), then updates affected tickets.
    - Session revocation (`API-20`): Automatically revokes all active sessions for the target user if `patch.isActive === false || ('role' in patch && patch.role !== targetUser.role)`.
    - All-ticket unassignment with version increment (`API-20`): Atomically unassigns all tickets owned by the target user (`ownerId: null`, `version = version + 1`, `updatedAt: new Date()`) if the user is deactivated or demoted to `REQUESTER`.
  - `POST /admin/users/:id/initial-password` (`API-15`): Sets new hashed initial password, sets `mustChangePassword: true`, revokes all active sessions for the target user, and returns 204.
  - User deletion: User deletion endpoints do not exist; requests to `DELETE /api/admin/users/:id` fall through to the default Express 404 handler.
- Global Lock Ordering in `server/src/services/staff.service.ts`:
  - `claimTicket` (API-09): Inside the transaction, locks the authenticated actor's User row first (`SELECT id FROM "User" WHERE id = $actorId FOR UPDATE`) and re-checks that the actor remains active and IT_STAFF or ADMINISTRATOR; throws 403 `FORBIDDEN` (`code: "FORBIDDEN"`) if the actor has been deactivated or demoted, before locking the Ticket row second (`SELECT id FROM "Ticket" WHERE id = $id FOR UPDATE`).
  - `updateOwner` (API-10): Locks target User row first (`SELECT id FROM "User" WHERE id = $ownerId FOR UPDATE`), verifies eligibility, and locks Ticket row second (`SELECT id FROM "Ticket" WHERE id = $id FOR UPDATE`).
  - Ensures consistent global lock order (`User` row before `Ticket` row), preventing deadlocks with concurrent administrator deactivation or demotion operations.

### Frontend Components & Security Safety
- `client/src/components/UserManagement.tsx` (`UI-07`):
  - Responsive Zen Green styling: desktop table (>= 768px) and mobile cards (< 768px) without horizontal overflow.
  - Search input with 300ms debounce and role filter dropdown.
  - User status pills and password state badges with clear textual labels.
  - Accessible modal dialogs for Create User, Edit User, and Reset Initial Password with focus trap, Escape key dismiss, and aria labelling.
  - Edit modal disables `Active Account` toggle with helper tooltip when editing own administrator account.
  - Password policy alignment: Reuses the shared `passwordRules` utility (at least 10 code points, at most 72 UTF-8 bytes, uppercase, lowercase, digit, symbol excluding whitespace, no NUL) across Create User and Reset Initial Password forms.
  - Effect-scoped cancellation and request-generation guards before every state update (including `finally`), preventing stale or out-of-order responses from overwriting current results or modifying loading state.
  - Password privacy enforcement: Form automatically wipes password inputs on API submission failure without re-rendering credentials in DOM or error banners.
- `client/src/App.tsx`:
  - Replaced placeholder admin shell with fully integrated `<UserManagement />` component on `/admin/users` route.
  - Updated role navigation to route Administrators directly to `/admin/users` by default.

### Verification Results

| Verification command | Result |
| --- | --- |
| Complete backend suite on disposable database | 269/269 passed in 21 files (`DATABASE_URL=postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914 npm --prefix server test -- --run`) |
| Complete client test suite | 112/112 passed in 12 files (`npm --prefix client test -- --run`) |
| Admin user API integration tests (`users-admin.api.test.ts`) | 34/34 passed |
| Admin input validator unit tests (`validation.test.ts`) | 26/26 passed |
| Staff ticket detail lock ordering tests (`staff-ticket-detail.api.test.ts`) | 22/22 passed |
| Admin user management UI tests (`UserManagement.test.tsx`) | 19/19 passed |
| Staff ticket queue UI tests (`StaffTicketQueue.test.tsx`) | 17/17 passed |
| Routing & authorization guards (`Routing.test.tsx`) | 15/15 passed |
| Server production build | Passed (`npm --prefix server run build`) |
| Client production build | Passed (`npm --prefix client run build`) |
| Git whitespace check | Passed (`git diff --check`) |

Database safety: All backend integration tests ran against the disposable test database `postgresql://toktickit:toktickit@localhost:5432/toktickit_lab3_auth_final_20260914`. The normal development database was never migrated or reset. The pre-existing uncommitted change in `client/package.json` (`@testing-library/user-egvent`) was strictly preserved and never staged or committed.
