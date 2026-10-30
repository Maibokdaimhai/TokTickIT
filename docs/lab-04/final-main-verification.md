# Lab 4 — Verification on merged main

Executed on 31 October 2026 (Asia/Bangkok), after [release PR #60](https://github.com/Maibokdaimhai/TokTickIT/pull/60) merged. The [actual approval](https://github.com/Maibokdaimhai/TokTickIT/pull/60#pullrequestreview-5715785065) is by Kawi-HBLI. Tested main SHA: `51d0d7aeef13097376a9e3fd98bcaea670d8f191`. [Sanitized results](../../artifacts/lab-04/verification/final-main.json) and [source manifests](../../artifacts/lab-04/verification/final-main-source-snapshots.json) separate this commit from the correction below.

## Results on the actual main commit

| Check | Executed result |
| --- | --- |
| Migrations, bootstrap, baseline and Lab 4 seed | Passed on the new disposable database |
| Complete backend | 424 passed, 0 failed; 1 performance opt-in skipped in this run |
| Migration/seed/restore rehearsal | Passed within the backend suite with `LAB4_RECOVERY_CONTAINER=toktickit-db` |
| Separately enabled performance | 1 passed; 10,000 Tickets / 30,000 Actions, 20 warm reads per role |
| Client | 195 passed, 0 failed/skipped |
| Real API/PostgreSQL Chromium | 38 passed, 0 failed/skipped/flaky, 10 files |
| Controlled-API Chromium | 14 passed, 0 failed/skipped/flaky, 2 files |
| Rendered accessibility/reflow | 65 successful scenarios, 7,407 text samples, 1,717 controls, 245 boundaries |
| Server/client no-emit typechecks and builds | Passed |
| Compiled API `npm start` | **Failed**: `MODULE_NOT_FOUND` for `dist/src/index.js` |

Dashboard performance p95 was 5.96 ms Requester, 15.15 ms Staff, and 21.89 ms Administrator; maximum payload was 5,131 bytes. See [measured plans/environment](../../artifacts/lab-04/verification/final-main-performance.json). These are synthetic local smoke results, not a production SLA. [Rendered records](../../artifacts/lab-04/verification/final-main-rendered-accessibility.json) include four widths and zoom-equivalent reflow; this is not formal accessibility certification or native toolbar zoom. Six selected fresh screenshots are under [final-main captures](../../artifacts/lab-04/screenshots/final-main/).

The earlier motion-follow-up and guard-fix verification gaps are now covered by this new main run. Its results do not erase or relabel the historical runs. The overall release is **blocked by compiled startup**, rather than marked all-pass.

## Startup defect and separately tested correction

The main server build uses the general TypeScript config, which includes tests importing the shared E2E guard outside `server/`. The inferred common source root therefore moves compiled application files to `dist/server/src/`. `npm start` still loads `dist/src/index.js`. A clean worktree exposed the problem; an old build directory could leave an obsolete entry and mask it.

Correction implementation: `30d436a` on `codex/lab4-final-main-evidence`, based on the tested main SHA. `tsconfig.build.json` pins `rootDir` to the server directory and includes application/Prisma sources only. The build script selects it; the general config continues to typecheck tests.

A new opt-in regression clears only the ignored server `dist` output, builds the application, runs the actual `npm start` command with an isolated migrated schema and an allocated loopback port, checks `/api/health`, signs in as a synthetic Staff user, and reads its authenticated Dashboard. It failed before the fix with the actual missing-entry error and passed afterward. The first post-fix attempt found a signal-state race in the new test's process cleanup; that harness error was corrected and is recorded separately from the passing result.

After the correction:

- Focused compiled-start regression: **1 passed**.
- Complete backend with `LAB4_PRODUCTION_SMOKE=1` and restore enabled: **425 passed, 0 failed**, 1 separately executed performance opt-in skipped.
- Server no-emit typecheck and production build: passed; compiled entry is `dist/src/index.js`.
- The main-run client/browser/performance results above are not claimed as reruns after this build-only correction. The correction has not yet been verified on a newly merged main SHA.

The startup test uses `NODE_ENV=test` for local HTTP cookies while executing the compiled application. It does not claim production deployment or HTTPS verification.

## Reproduction and environment

Use the [README](../../README.md) setup and disposable-target safeguards. The executed target was `toktickit_lab4_main_test_20261031_53` in the existing **toktickit-db**, PostgreSQL 16.14, with Node.js 22.17.1 on Apple M4 Pro/24 GiB. An isolated worktree at the recorded SHA excluded the unrelated dirty client manifest in the original checkout. Existing dependency directories were reused via untracked worktree symlinks; no fresh `npm ci` execution is claimed. Explicit environment variables selected the test database/uploads; development `.env` was not edited.

Supply synthetic passwords locally and run backend and database-backed browsers sequentially. From `server/`:

```sh
LAB4_RECOVERY_CONTAINER=toktickit-db npm test
LAB4_DASHBOARD_PERF=1 npm test -- --run tests/lab-04/dashboard-performance.test.ts
npx --no-install tsc --noEmit
npm run build
# On the corrected branch, include the compiled-start regression:
LAB4_PRODUCTION_SMOKE=1 LAB4_RECOVERY_CONTAINER=toktickit-db npm test
```

From `client/`, run `npm test`, `npx --no-install tsc --noEmit`, and `npm run build`. From the repository root, run `npm run test:e2e` and `npm run test:e2e:fixtures` with fresh screenshot/audit output locations. Raw reports, traces, synthetic credentials, and temporary configuration remain outside committed evidence.

The user explicitly approved cleanup. The named test database and `/private/tmp/toktickit-lab4-main-test-uploads-20261031-53` were removed after testing. Absence was checked; development `toktickit` remained present and the project container running. Temporary restore schemas/databases were scoped by the test fixtures.

## Remaining release work

The test-on-main step has executed; it is not merely waiting to run. Merge/review the build correction, record the updated actual main SHA, and verify the compiled-start regression plus required release checks there before marking the release all-pass. [Issue #53](https://github.com/Maibokdaimhai/TokTickIT/issues/53) was reopened following the release review and remains open for this correction/final verification and submission. Prepare the PDF last. No PDF or deployment was performed here.
