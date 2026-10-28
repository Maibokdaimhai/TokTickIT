# Issue #52 regression, accessibility and evidence

Implemented locally on `test/lab4-regression-and-evidence`, based on staging `5d13a769f8444ae7757074f26b450a686e3f6393` after PR #57 merged. Implementation commit `003787cc964dec10b74991de1f7b724dd96ab227`; the user subsequently authorized pushing and PR creation. Reviewer approval remains pending. [Sanitized verification](../../artifacts/lab-04/verification/regression.json) records results, source fingerprints and verification phases. Final-main/release evidence remains Issue #53.

## Results and scope

| Check | Actual result |
|---|---|
| Complete backend Labs 1–4 | **384 passed**, zero failed; one opt-in performance test intentionally skipped |
| Performance opt-in, separately executed | **1 passed**, exactly 10,000 Tickets / 30,000 Actions, 20 warm requests per role |
| Complete client Labs 1–4 | **195 passed**, zero failed/skipped |
| Authenticated real-API/PostgreSQL Chromium | **38 passed**, zero failed/skipped/flaky, across ten files |
| Controlled-HTTP Chromium | **14 passed**, zero failed/skipped/flaky, across two files |
| Rendered layout/accessibility | **65 scenarios passed** at four widths and zoom-equivalent reflow |
| Server/client typechecks and production builds | Passed; no JS emitted into source/test folders |

Performance p95: Requester **6.66 ms**, Staff **12.93 ms**, Administrator **19.75 ms**; largest response **5,131 bytes** and no preview exceeds five. Actual host/runtime, dataset and EXPLAIN ANALYZE are in [performance evidence](../../artifacts/lab-04/verification/regression-performance.json). Production server code is unchanged from the merged base. This is a local API/database smoke test, not a production-load claim.

Verification phases matter: the complete backend/real-browser checks passed before approved database cleanup. A final reduced-motion follow-up then corrected fixture/standalone Playwright options and added CSS suppression of transitions/animations. After that motion-only change, all 14 controlled browser checks, the full 195-test client suite, client typecheck and build passed. The real database browser suite was not rerun after this final motion-only change. Both the pre-motion real-browser fingerprint and final source fingerprint are recorded; these are not claimed to be one final-main execution.

## Discovery and retained requirements

The root `playwright.config.ts` now discovers authenticated Labs 3 and 4 together with fail-closed database/upload guards. [Discovery inventory](../../artifacts/lab-04/verification/regression-discovery.json) lists every actual case. `playwright.fixtures.config.ts` explicitly runs the controlled Actions UI and dashboard-review cases without a database, and `npm run test:e2e:fixtures` exposes that command.

| Actual real-browser file | Cases | Scope |
|---|---:|---|
| e2e/lab-03/authentication.spec.ts | 4 | Login/mandatory change, cookies, reload, invalid/inactive accounts, role boundaries and permitted role homes |
| e2e/lab-03/requester-regression.spec.ts | 4 | Creation/validation/failure/busy/upload; search/pagination/empty/mobile; download bytes and removal audit; public comments/advisory and private-content/ownership isolation |
| e2e/lab-03/responsive-accessibility.spec.ts | 6 | Earlier screens, semantic landmarks/tokens, dialog keyboard access and merged mobile communication-panel regression |
| e2e/lab-03/safety-cleanup.spec.ts | 3 | Database opt-in/path guard; unaudited cleanup; preservation of immutable audited fixtures |
| e2e/lab-03/staff-ticket-flow.spec.ts | 4 | Queue/filter/pagination/edge states; claim/owner/priority/lifecycle/conflict; public/private communication and attachments |
| e2e/lab-03/user-administration.spec.ts | 7 | Create/edit/reset, duplicate/error/secret handling, last-admin guard, assignment changes, revocation and no deletion |
| e2e/lab-04/actions-taken-flow.spec.ts | 1 | Multiple independently assigned contributors, safe failure/draft/retry identity, complete/cancel/follow-up, resolution and public revisions |
| e2e/lab-04/dashboard-flow.spec.ts | 3 | All-role dashboards, exact filters, reload/Back, assigned work and selected-action anchors |
| e2e/lab-04/responsive-accessibility.spec.ts | 3 | Four-width rendered audit, long content/names, contained table keyboard scrolling, modal focus and zoom-equivalent reflow |
| e2e/lab-04/ticket-resolution.spec.ts | 3 | Gate/follow-up/advisory/resolve/close/reopen, cancellation and legacy resolution |

The original three Lab 2 selector-era browser journeys remain historical source. They depend on the retired requester selector/public requester API and hard-coded port 3000, so they are intentionally outside current execution. Their creation/list/detail requirements are covered by the four authenticated Lab 3 Requester scenarios, not silently dropped or counted as passing old tests. [Archived-suite note](../../e2e/lab-02/README.md) and the inventory map each replacement. Labs 1–2 API/component suites also ran in the full backend/client runs.

Earlier browser assertions were updated for the reviewed Lab 4 contracts: Dashboard is the role home; successful resolution now records and completes actual work first. A broad old assertion for any text containing Internal Notes incorrectly matched public guidance; it now checks for no private heading/panel and creates a real private note to assert omission from the Requester API/UI. Sign-in helpers await the outcome before navigation, preventing an aborted request. The last-active-admin test snapshots every other active admin, asserts one remains, and restores exactly those IDs in finally; it no longer assumes only two named administrators exist.

## Rendered checks and corrections

[Rendered audit](../../artifacts/lab-04/verification/rendered-accessibility.json) contains 65 successful scenarios, **21,101 text samples** and **5,057 enabled control samples**. Actual viewports: 320×900, 390×844, 820×1180 and 1440×900. Disabled controls are excluded from contrast/target requirements. All enum/status cues remain textual.

Checked Login, mandatory password change, Create/My Tickets, Requester Detail with long public Action/revision content, both role dashboards, My Active Actions, Staff Queue/Detail/editor, Administrator management and Create User dialog. The automation checks computed text/background colors, actual header/nested gradient stops, input boundaries, names/labels, control/panel bounds, 44px targets and no horizontal page overflow. Wide tables may scroll inside named focusable regions; ArrowRight scrolling is verified, rather than treating offscreen columns as page overflow. New Requester/Staff rendering journeys had no uncaught page errors. Existing failure/authorization scenarios deliberately exercise expected HTTP errors.

The 200% checks emulate the same physical 1440×900 area using a 720×450 CSS viewport and 2× device scale through CDP. This preserves the current editor/modal DOM and tests responsive reflow. It is explicitly zoom-equivalent emulation, not native browser-toolbar zoom. An earlier CSS-root-zoom attempt misrepresented fixed-position dialogs and was replaced by this explicit method. These checks and visual sample review are not formal WCAG certification or a physical assistive-technology audit.

Observed issues fixed in this branch:

- Input boundaries measured about 1.48:1; the input-border token is now darker. Public/private composer borders keep their green/amber distinction with sufficient contrast.
- Small header, pending-password and password-rule text lacked contrast. Text colors/backgrounds now meet the sampled thresholds; inactive users retain explicit labels/backgrounds without fading all their text.
- Pagination rendered all pages with 32px targets and overflowed narrow layouts. It now uses a bounded five-page window, wrapping controls and 44px targets. Three unit tests cover short, centred/end and very large totals.
- Long account/user identities, Requester identity headers and intrinsic Staff operational grid widths caused clipping. Min-width, wrapping and grid minima now accommodate them. The previously merged mobile Public Comment/Internal Note fix remains exercised.
- Communication textareas and two Staff operational selects lacked accessible names. Names were added; Requester Ticket links/mobile cards and contained tables are keyboard reachable. Focus rings are explicit.
- Some standalone/fixture configs put reducedMotion directly on use, so the browser preference was not applied. They now use contextOptions; a new fixture test checks the preference and actual zero-duration shell transition. CSS also suppresses nonessential animations/transitions for reduced motion.

[Regression screenshots](../../artifacts/lab-04/screenshots/regression/) contain four-width captures and focused mobile editor/dialog/communication panels. Earlier feature/PR screenshot files were restored; current root/fixture configs route fresh captures into the regression directory instead of overwriting historical evidence.

## Data and cleanup safety

Only `toktickit_lab4_regression_test_20261028_52` in the user's `toktickit-db` container (PostgreSQL 16.14) was migrated/seeded for this run. Existing migrations/seed were used with synthetic local passwords; `.env`, the development database and unrelated containers were unchanged. Backend migration/seed/restore regressions used their own guarded schemas/disposable restore targets.

Database guards reject missing opt-in, development names, wrong protocols and malformed encoded pathnames. The root config was also invoked with three unsafe settings and failed closed before server startup. Upload cleanup accepts only a dedicated absolute test directory under /private/tmp or /tmp; traversal, outside paths, symlink files and symlink roots are rejected. Eleven server-side safety tests cover these boundaries.

Cleanup deletes only unaudited fixture Tickets and unreferenced people; audited projections/revisions/events and references remain until whole-database teardown. It never disables audit triggers. After all DB tests completed, the user explicitly approved deletion of this test database and `/private/tmp/toktickit-lab4-e2e-uploads-20261028-52`. Both were removed; database absence and continued existence of development `toktickit` were verified. The project container remains running. The final motion follow-up used fixture browsers only and did not recreate the database.

## Reproduction

Supply a new explicitly disposable database URL through the environment; never substitute the development database. Apply existing migrations/seed there using a synthetic LAB3_INITIAL_PASSWORD. Keep backend clock-dependent suites and real browser suites sequential or use separate databases so session cleanup cannot interfere.

```bash
# From server, with guarded DATABASE_URL/E2E_ALLOW_DB_WRITE and local seed password
npx --no-install prisma migrate deploy
npx --no-install prisma db seed
npm test
npx --no-install tsc --noEmit
npm run build

# Performance opt-in, separately from the normal backend run
LAB4_DASHBOARD_PERF=1 npm test -- --run tests/lab-04/dashboard-performance.test.ts

# From client
npm test
npx --no-install tsc --noEmit
npm run build

# From repository root, with guarded database and synthetic browser passwords
npm run test:e2e -- --list
npm run test:e2e
# No DB required for controlled fixtures
npm run test:e2e:fixtures -- --list
npm run test:e2e:fixtures
```

Use LAB4_RECOVERY_CONTAINER=toktickit-db for the recovery test, E2E_INITIAL_PASSWORD/E2E_CHANGED_PASSWORD for browser accounts, E2E_AUDIT_OUTPUT for a local JSONL audit and LAB4_PERF_OUTPUT for local performance output. Sanitize results before committing; raw configs/traces can contain operational data. Final-main, release approval, README/submission and the student's personal reflection remain Issue #53.
