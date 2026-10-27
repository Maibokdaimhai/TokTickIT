# Lab 4 Test Plan and Traceability - TokTickIT

Status: Partial implementation and verified foundation coverage, 27 October 2026. The original contract/test matrix was created before feature implementation. Issue #48 now implements the backend Actions foundation; the six actual Lab 4 suites and run results are listed in Section 8. Remaining UI/workflow/dashboard/release cases are planned. Existing merged mobile-fix checks are baseline behavior, not proof that unimplemented Lab 4 cases pass.

## 1. Strategy and evidence rules

Use unit tests for pure validation/policy/calculations, real PostgreSQL integration for transactions/migration/races, React component tests for forms/navigation/failure feedback, and Playwright for complete role workflows and rendered layout. Mocks alone cannot prove ownership, locking, migration safety or dashboard query accuracy. Every test asserts observable behavior; do not merely duplicate implementation expressions in a test oracle.

TDD: add a meaningful failing test for the current Issue, record its failure and commit, implement the smallest correct increment, then record the passing run and related regression. Never mark a test Pass before execution. Planned test paths become actual links only when implemented. The matrix below remains the complete planned product coverage; it is not a blanket pass list. Section 8 records only the actual foundation execution and its remaining boundaries.

## 2. Test matrix

| ID | Type | FR / BR | AC | Scenario and expected result | Planned automated file |
|---|---|---|---|---|---|
| UNIT-01 | Unit | FR-02; BR-04/05 | AC-02 | Reject whitespace-only/overlong Unicode text, invalid offset/future/pre-Ticket dates, invalid follow-up state and noninteger IDs; exact boundaries succeed | server/tests/lab-04/action-validation.test.ts |
| UNIT-02 | Unit | FR-01/05; BR-06/11 | AC-03, AC-06 | Table-test every action/Ticket status pair, terminal and no-op rules, confirmations and owner prerequisites | server/tests/lab-04/workflow-policy.test.ts |
| UNIT-03 | Unit | FR-07/08; BR-17/20 | AC-09, AC-10 | Fixed clock computes Bangkok midnight window across UTC date/month/year boundaries; no machine-local timezone dependence | server/tests/lab-04/dashboard-window.test.ts |
| API-01 | API/DB | FR-01/02; BR-01/03 | AC-01 | Create under correct Ticket with server performer and different eligible assignee; returned identities/version and revision 0 match committed DB | server/tests/lab-04/actions-taken.api.test.ts |
| API-02 | API/DB | FR-02; BR-03/04/05 | AC-02 | Invalid shape/IDs/dates, spoofed performer, missing conditional note, inactive/missing/Requester assignee -> 400, no projection/revision/version changes | server/tests/lab-04/actions-taken.api.test.ts |
| API-03 | API/DB | FR-01/04; BR-06/07/08 | AC-03 | Edit/reassign and every legal action transition; ordinary terminal edits/frozen parent rejected; BR-23 follow-up completion tested separately; immutable earlier revisions unchanged | server/tests/lab-04/actions-taken.api.test.ts |
| API-04 | API/security | FR-03/09; BR-02/22 | AC-04, AC-13 | Missing/expired/revoked/restricted sessions; Requester writes; foreign/missing Ticket full-response equality; mismatched action/Ticket IDs; correct safe projections on list/single/history | server/tests/lab-04/actions-authorization.api.test.ts |
| API-05 | API/DB | FR-04; BR-08 | AC-03, AC-04 | Equal createdAt values, backdated actionAt, multiple pages and history order stable; terminal/cancelled records remain visible; no delete APIs | server/tests/lab-04/actions-taken.api.test.ts |
| API-06 | API/DB race | FR-06; BR-09 | AC-05 | Two action edits with same versions: exactly one succeeds, loser 409, one revision only; concurrent unrelated Ticket change also invalidates draft | server/tests/lab-04/actions-concurrency.api.test.ts |
| API-07 | API/DB race | FR-06; BR-10 | AC-05 | Sequential and concurrent exact create retries return one action/revision; changed payload/parent key reuse -> 409; replay works after parent closes without new writes | server/tests/lab-04/actions-concurrency.api.test.ts |
| API-08 | API/DB race | FR-01/06; BR-03/16 | AC-02, AC-05 | Concurrent assignment vs deactivation/demotion, including multiple target IDs: no invalid new assignment or deadlock; historical identities retained | server/tests/lab-04/actions-concurrency.api.test.ts |
| API-09 | API/DB | FR-04/06; BR-08/09 | AC-05 | Inject revision/event write failure: projection/status/version roll back completely and retry is recoverable | server/tests/lab-04/actions-concurrency.api.test.ts |
| API-10 | API/DB | FR-05; BR-11/15 | AC-06 | Every Ticket status pair/role, owner/confirmation/expectedStatus/version checks; successful status/claim event committed once with correct actor/order/version | server/tests/lab-04/ticket-workflow.api.test.ts |
| API-11 | API/DB | FR-05; BR-12/13 | AC-07 | Direct resolve bypass blocked for zero/completed-without-result/active-work/follow-up cases; cancelled follow-up ignored; valid completed work permits resolve; advisory flag alone insufficient | server/tests/lab-04/ticket-workflow.api.test.ts |
| API-12 | API/DB race | FR-05/06; BR-09/12 | AC-05, AC-07 | Resolve races action creation/edit: serialize on Ticket; either valid resolution freezes subsequent work or stale resolution loses; never commit inconsistent state | server/tests/lab-04/actions-concurrency.api.test.ts |
| API-13 | API/DB | FR-05/09; BR-13/14/20 | AC-08 | Legacy RESOLVED -> CLOSED succeeds with zero actions; reopen clears indication/resolvedAt; re-resolve requires gate and writes actual timestamp | server/tests/lab-04/ticket-workflow.api.test.ts |
| API-14 | API/DB | FR-09; BR-16 | AC-13 | Late draft compensation cannot erase action/history; earlier eligible draft rollback still works; comments/notes/attachments remain intact | server/tests/lab-04/regression.api.test.ts |
| API-15 | API/DB | FR-07; BR-17/18/20/21 | AC-09 | Requester metrics independently counted from fixture DB; other Requester excluded; zero counts, recently resolved inclusive boundaries/estimates and five-item stable preview | server/tests/lab-04/requester-dashboard.api.test.ts |
| API-16 | API/DB | FR-08; BR-17/19/21 | AC-10 | Staff/Admin exact global/unassigned/mine/status/priority counts; my active actions uses assignee, not performer; terminal parent excluded; all zero enum buckets present | server/tests/lab-04/staff-dashboard.api.test.ts |
| API-17 | API/DB | FR-07/08; BR-21/22 | AC-09, AC-10, AC-13 | Dashboard role denial, requesterId/assignee spoof queries rejected, no-store headers, safe errors; one snapshot/asOf across concurrent changes | server/tests/lab-04/dashboard-security.api.test.ts |
| API-18 | API/DB | FR-07/08; BR-18/19/21 | AC-11 | Each card predicate equals drill-down total on unchanged DB; group/status conflicts, partial/invalid date range, array/unknown query rejected; all eight Requester statuses accepted | server/tests/lab-04/dashboard-drilldown.api.test.ts |
| API-19 | API/DB/security | FR-02/04/05; BR-07/08/23 | AC-02, AC-03, AC-04, AC-07 | Complete an action with pending follow-up; direct resolve is blocked; Staff records completion with note/time/session actor, original work/note/prior revisions unchanged, exactly one revision appended; resolve with fresh version succeeds. Requester reads completion but cannot write it; blank/overlong/spoofed completion data, wrong Ticket, noncompleted/cancelled/no-pending target, frozen parent and repeated requests fail without writes. Historical inactive assignee does not block eligible acting staff | server/tests/lab-04/actions-taken.api.test.ts |
| API-20 | API/DB race | FR-05/06; BR-09/12/23 | AC-05, AC-07 | Parallel follow-up completions yield one winner/revision; stale loser changes nothing; injected revision failure rolls back completion and parent version; resolve racing completion either remains blocked/stale or succeeds only after committed clearance | server/tests/lab-04/actions-concurrency.api.test.ts |
| DB-01 | Migration | FR-09; BR-14/20 | AC-08, AC-12 | Migrate Lab 3 snapshot; IDs/values/FKs/files preserved, zero invented actions/events, only specified resolution backfill changes with estimate flag | server/tests/lab-04/migration-regression.test.ts |
| DB-02 | Seed/recovery | FR-09; BR-16/20 | AC-12 | Seed twice: stable logical records/revisions/events, no user-data overwrite; restore pre-migration backup into second disposable DB and verify Lab 3 read/workflow | server/tests/lab-04/migration-regression.test.ts |
| UI-01 | Component | FR-01/02/10; BR-03/04/05 | AC-01, AC-02, AC-14 | Create/edit form defaults, independent assignee, readonly performer, Unicode/conditional validation, date conversion and safe private-content warning | client/tests/lab-04/ActionsTaken.test.tsx |
| UI-02 | Component | FR-01/02/03/04/05; BR-06/07/08/23 | AC-03, AC-04, AC-07 | Staff permitted controls, terminal/frozen modes, inactive assignee warning, Requester readonly items/revisions, no Internal Note content; Record Follow-up Completion appears only for eligible pending completed work, validates/retains its note, shows server completion identity/time and preserves original context | client/tests/lab-04/ActionsTaken.test.tsx |
| UI-03 | Component | FR-06/10; BR-09/10 | AC-05, AC-14 | Repeated click blocked; uncertain create retry keeps UUID; 400/409/500 retain drafts; refresh reconciles explicitly without silent overwrite | client/tests/lab-04/ActionsTaken.test.tsx |
| UI-04 | Component | FR-05/10; BR-11/12/13 | AC-06, AC-07, AC-08, AC-14 | Only legal Ticket options, blockers/confirmation, advisory explanation, successful summary/history refresh and stale feedback | client/tests/lab-04/TicketWorkflow.test.tsx |
| UI-05 | Component | FR-07/10; BR-18/20 | AC-09, AC-11, AC-14 | Requester loading/zero/nonzero/error/refresh states, estimate/range labels, exact encoded links and preview destinations | client/tests/lab-04/RequesterDashboard.test.tsx |
| UI-06 | Component | FR-08/10; BR-19 | AC-10, AC-11, AC-14 | Staff/Admin counts/buckets/my action links from response, zeros remain visible, no client recomputation, failure is not fake zero success | client/tests/lab-04/StaffDashboard.test.tsx |
| UI-07 | Component | FR-07/08/10; BR-21/22 | AC-11, AC-13, AC-14 | Role homes, forbidden routes, password gate, URL filter parsing/back/reload, page reset, stale-response suppression, selected-action deep link | client/tests/lab-04/Routing.test.tsx |
| UI-08 | Component | FR-08/10; BR-19 | AC-10, AC-11, AC-14 | My Active Actions page pagination, no results, selection to Ticket, errors and latest-response ownership | client/tests/lab-04/MyActiveActions.test.tsx |
| STYLE-01 | Rendered style | FR-10; BR-22 | AC-15 | Real computed tokens/contrast, text badges, public/private distinction, editable/read-only fields and wrapped rows match UI contract | e2e/lab-04/responsive-accessibility.spec.ts |
| E2E-01 | Browser/DB | FR-01/03/04/06 | AC-01, AC-02, AC-03, AC-04, AC-05, AC-14 | Staff records multiple differently assigned actions; edit/follow-up/complete/cancel validation and failures; Requester sees full readonly work/history | e2e/lab-04/actions-taken-flow.spec.ts |
| E2E-02 | Browser/DB | FR-05/09 | AC-06, AC-07, AC-08, AC-13 | Create -> claim -> work -> waiting -> requester indication -> resolved -> closed -> reopened -> new work -> resolved; separate cancellation path and conflict. Include COMPLETED action with followUpRequired=true -> Resolve blocked -> Record Follow-up Completion -> original and completion revisions visible to Requester -> refreshed Resolve succeeds | e2e/lab-04/ticket-resolution.spec.ts |
| E2E-03 | Browser/DB | FR-07/08 | AC-09, AC-10, AC-11, AC-14 | All-role dashboards, zero/nonzero values verified by independent queries, each card drill-down, cross-Requester protection and My Active Actions | e2e/lab-04/dashboards.spec.ts |
| E2E-04 | Browser/style/a11y | FR-10 | AC-15 | Four widths, long content and 200% zoom: panel/control bounds, target sizes, no clipping/overlap; keyboard/labels/focus/reduced motion/console | e2e/lab-04/responsive-accessibility.spec.ts |
| REG-01 | API/UI/E2E | FR-09/10; BR-22 | AC-13, AC-15 | Run all earlier suites; verify auth, My Tickets, detail, attachments/rollback, public/private communication, queue, admin safeguards; retain mobile communication regression | e2e/lab-04/earlier-labs-regression.spec.ts plus existing Labs 1-3 suites |
| PERF-01 | API/DB smoke | FR-07/08; BR-21 | AC-16 | Bounded dashboard previews and warm request latency with indexed representative fixture; log dataset/hardware/query plans, no secrets | server/tests/lab-04/dashboard-performance.test.ts |
| RELEASE-01 | Release/manual | FR-11 | AC-17 | Capture all suite/build output from actual final-main SHA, traceability, review/README/Issue evidence and nine-part report links | docs/lab-04/tests.md evidence ledger (manual release check) |

## 3. Acceptance-criterion coverage index

| AC | Planned tests |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, API-02, API-08, API-19, UI-01, E2E-01 |
| AC-03 | UNIT-02, API-03, API-05, API-19, UI-02, E2E-01 |
| AC-04 | API-04, API-05, API-19, UI-02, E2E-01 |
| AC-05 | API-06/07/08/09/12/20, UI-03, E2E-01 |
| AC-06 | UNIT-02, API-10, UI-04, E2E-02 |
| AC-07 | API-11/12/19/20, UI-02/04, E2E-02 |
| AC-08 | API-13, DB-01, UI-04, E2E-02 |
| AC-09 | UNIT-03, API-15/17, UI-05, E2E-03 |
| AC-10 | UNIT-03, API-16/17, UI-06/08, E2E-03 |
| AC-11 | API-18, UI-05/06/07/08, E2E-03 |
| AC-12 | DB-01/02 |
| AC-13 | API-04/14/17, UI-07, E2E-02, REG-01 |
| AC-14 | UI-01/03/04/05/06/07/08, E2E-01/03 |
| AC-15 | STYLE-01, E2E-04, REG-01 |
| AC-16 | PERF-01 |
| AC-17 | RELEASE-01 |

## 4. Fixtures and independent oracles

Follow-up regression walkthrough for API-19 and E2E-02 (planned, not executed): start with an IN_PROGRESS Ticket at version 10 with an eligible owner and one COMPLETED action at version 1, a nonempty result, followUpRequired=true and the original follow-up note. Earlier revision 0 contains initial work; revision 1 contains completed work with pending follow-up. No other blockers exist.

| Step | Expected result |
|---|---|
| Attempt Resolve using Ticket version 10 | 409 RESOLUTION_BLOCKED; Ticket version stays 10, action stays version 1, no event/revision added |
| Record Follow-up Completion with Ticket version 10, action version 1 and a valid completion note | 200; Ticket version 11, action version 2, flag false; original note/work unchanged; backend actor/time/note saved; exactly revision 2 appended |
| Owning Requester reads item/history | Original pending revisions 0/1 and completion revision 2 remain visible with distinct context; no write controls or Internal Notes |
| Attempt Resolve with refreshed Ticket version 11 and expectedStatus IN_PROGRESS, confirmed=true | 200; Ticket RESOLVED at version 12, transition event and actual resolution time saved |
| Replay completion with its old versions | 409 VERSION_CONFLICT; no duplicate completion or revision |

Use fixed clocks for calculation tests and controlled backend time for date validation. Freeze asOf for window-boundary tests; seed just before, exactly on, and just after each boundary. Include equal timestamps/duplicate names for tie ordering, two Requesters, at least two eligible contributors, an Administrator and inactive/role-changed assignees. Include actions performed by A but assigned to B, terminal parents with unfinished historical actions, cancelled follow-up, COMPLETED actions with pending versus recorded-complete follow-up (including original and completion revisions), zero-action legacy resolved Tickets and a multi-action Ticket. Compute expected metric membership from explicit fixture IDs or independent SQL queries, never by calling the implementation helper under test.

Race tests use separate database connections and synchronization barriers, not arbitrary sleeps. Assert persisted rows/revisions/events and parent versions after completion, not only response codes. Test exact retry key races under a unique constraint and resource-access checks before replay. Transaction failure tests need an intentional DB failure/test seam scoped to disposable tests, never a production bypass flag.

Performance-smoke contract: disposable fixture of 10,000 Tickets and 30,000 actions spanning relevant statuses/scopes; record actual row counts and machine/runtime versions. Warm each dashboard once, collect 20 sequential requests per role, require p95 <=1000ms on the documented local test host and <=64 KiB UTF-8 response size, with no preview over five rows. Record EXPLAIN ANALYZE for representative aggregates and investigate sequential scans/latency rather than assuming an index exists. A failure is reported and investigated; no production-scale claim follows from this smoke test. Run opt-in separately from normal unit tests.

## 5. Safe execution and discovery

All database-writing integration/E2E/migration/seed/performance suites must fail closed unless DATABASE_URL names a disposable database containing an approved test/e2e/disposable marker and the write opt-in is explicit. Reuse/extend the existing e2e/lab-03/db-guard.ts policy; verify it applies to every new DB suite. Never execute against the development `toktickit` DB. Do not print connection strings, credentials or cookies. Use a dedicated temporary uploads directory and deterministic cleanup that cannot delete user files.

Implementation must update Playwright discovery from its current `testDir: ./e2e/lab-03` to discover Labs 3 and 4 (or explicit projects with both directories), preserve the safety guard, and verify `--list` includes both suites. Existing e2e/lab-02 coverage must be inventoried and run where compatible with authenticated Lab 3/4 behavior; document intentional replacements, never silently omit old requirements. Existing Vitest patterns already cover `tests/**/*.test.ts` on the server; confirm client discovery for all new .tsx tests.

Earlier tests that resolve a Ticket without actions need explicit fixture/expectation updates for BR-12, with the change traced to AC-07. Do not weaken the new gate to preserve an obsolete assertion. Existing legacy-resolved fixtures instead exercise the grandfathered close behavior. Preserve earlier security and ownership assertions unchanged.

Planned commands after implementation and disposable DB provisioning (environment credentials supplied securely, not pasted into evidence):

```sh
# Server unit/API tests; DB suites require guarded test environment.
npm --prefix server test
# Client component tests.
npm --prefix client test
# Type check without unmanaged JS emission, then configured production builds.
cd server
npx tsc --noEmit
npm run build
cd ../client
npx tsc --noEmit
npm run build
cd ..
# Only after extending discovery and providing guarded disposable DB env:
npx playwright test --list
npx playwright test
```

Migration/recovery and performance suites run separately with explicit disposable fixtures; document the exact implemented invocation before claiming execution. DB backup/restore rehearsal must target a second disposable database. Record any unavailable prerequisites as Blocked with reason rather than Pass. Inspect browser screenshots manually as well as checking bounding boxes.

## 6. Visual/manual checklist

Use ui-spec.md Section 8 at 320x900, 390x844, 820x1180, 1440x900 plus 200% zoom. Capture dashboards and actions list/create/edit/readonly/history, resolution blocked/success, zero states and safe failures. Inspect actual descendant bounds so overflow-hidden clipping cannot pass just because document scrollWidth fits. Exercise keyboard-only flows, meaningful focus restoration, screen-reader names/status announcements, contrast and target sizes. Record role/browser/scenario/viewport/commit for every artifact.

## 7. Evidence ledger

| Date | Commit | Test IDs / command | Result and counts | Evidence / limitation |
|---|---|---|---|---|
| 2026-10-27 | Draft working tree from 20581ae | Contract/traceability checks only | No Lab 4 feature suites executed | Automated file paths above are planned; no feature pass evidence yet |

During implementation append real red/green runs, sanitized output paths, migration/recovery outcomes and visual checklist results. Suggested new storage: artifacts/lab-04/test-results/ and artifacts/lab-04/screenshots/. Build/test outputs must identify actual source SHA and any dirty relevant files. Final release must rerun from main and update every matrix row to the actual Pass/Fail/Blocked state with evidence. Prior branch test results remain labelled with their original context.

## 8. Issue #48 foundation execution

Implementation commit 0432b19 on feature/lab4-actions-foundation, based on ecf4c47. Tests ran on its uncommitted source snapshot; the fingerprint was checked again immediately before commit. The [sanitized verification summary](../../artifacts/lab-04/verification/actions-foundation.json) contains the tested server-source fingerprint and per-suite results; these are not final-main results.

- Full backend regression: **317 passed, 0 failed, 0 skipped**, including 48 new Lab 4 tests across six suites.
- Passed: Prisma schema validation, server `tsc --noEmit`, server production build and whitespace checks.
- Real PostgreSQL 17: dedicated disposable DB, isolated suite schemas, explicit write guard, backup restored into a second disposable database; no development DB migration.
- Parser red: missing validator initially prevented test collection. A later HTTP red/green check demonstrated unexpected write-query parameters incorrectly returning 201 before the strict-query fix; it now returns 400 with no saved Action.
- Expected fault-injection requests return safe 500 responses to prove transaction rollback; their sanitized error logs do not mean the suites failed.

| Actual file | Tests passed | Verified scope |
|---|---:|---|
| server/tests/lab-04/action-validation.test.ts | 14 | Date offsets/calendar validity/bounds, Unicode lengths, types/IDs, conditional notes/results, spoof rejection and completion input |
| server/tests/lab-04/actions-taken.api.test.ts | 12 | Create/edit/status matrix, independent assignee/performer, public immutable revisions, BR-23 completion and retained context, readonly states, strict queries and page bounds |
| server/tests/lab-04/actions-authorization.api.test.ts | 4 | Foreign/missing Ticket equality, Requester write denial, active full-session/Origin requirements and compensation guard |
| server/tests/lab-04/actions-concurrency.api.test.ts | 10 | Concurrent exact replay, changed retry conflict, stale edits, independent Ticket write conflicts, admin eligibility races, sorted cross-assignment locks and revision/completion rollback |
| server/tests/lab-04/database-guard.test.ts | 5 | Reject absent opt-in and non-disposable/non-PostgreSQL targets |
| server/tests/lab-04/migration-regression.test.ts | 3 | Legacy values/relations/file preservation, explicit timestamp backfill, idempotent seed and separate-DB backup restore |

Mapped foundation coverage: UNIT-01, API-01 through API-09, DB-01/02 and the action portion of API-14/19/20. These suite results do not imply every future product-matrix scenario is complete. In particular, API-19's successful Ticket resolution and API-20's resolution race await Issue #50; no UI/browser/performance/dashboard or final release checks were executed for this foundation task.

Recovery execution sets LAB4_RECOVERY_CONTAINER to the dedicated test container; without that prerequisite the recovery case is explicitly skipped and must not be counted as passing. The restore rehearsal checked original SQL data/relationships and a Lab 3-compatible status/version write; it did not redeploy an old application binary. See [foundation runbook](actions-foundation.md).
