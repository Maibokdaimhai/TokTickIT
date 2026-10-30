# Lab 4 — Verification on merged main

## Corrected-main confirmation — 31 October 2026

**All executed release checks passed on actual main `351cfa7833e8a7b5ffb2778df0d12c255e92f66a` after PR #61 merged.** [PR #61](https://github.com/Maibokdaimhai/TokTickIT/pull/61) was [approved by Kawi-HBLI](https://github.com/Maibokdaimhai/TokTickIT/pull/61#pullrequestreview-5716068472). The earlier startup blocker is resolved and was retested on this merged commit, not inferred from branch-only results.

[Sanitized confirmation and source manifest](../../artifacts/lab-04/verification/final-main-confirmed.json), [performance](../../artifacts/lab-04/verification/final-main-confirmed-performance.json), and [rendered audit](../../artifacts/lab-04/verification/final-main-confirmed-rendered.json) identify the exact tested SHA and fingerprint. The final evidence PR changes only documentation/artifacts; it does not change the tested application source.

| Check on corrected main | Executed result |
| --- | --- |
| Migrations, bootstrap, baseline and Lab 4 seed | Passed on the new disposable target |
| Complete backend | **425 passed**, 0 failed; 1 performance opt-in skipped in this run and separately passed |
| Compiled API startup regression | Passed within backend: clean `dist` build, actual `npm start`, health, login, protected Staff Dashboard |
| Actual backup/restore rehearsal | Passed within backend with the project container prerequisite enabled |
| Client | **195 passed**, 0 failed/skipped |
| Real API/PostgreSQL Chromium | **38 passed**, 0 failed/skipped/flaky |
| Controlled-API Chromium | **14 passed**, 0 failed/skipped/flaky |
| Rendered checks | **65 successful scenarios**, 7,407 text samples, 1,717 controls, 245 boundaries |
| Server/client no-emit typechecks and builds | Passed |
| Separately enabled performance | **1 passed**, 10,000 Tickets / 30,000 Actions, 20 warm reads per role |

Performance p95 was **6.73 ms Requester / 13.81 ms Staff / 20.69 ms Administrator**, maximum payload 5,131 bytes. These are local synthetic measurements, not a production SLA. Rendered checks cover four widths and zoom-equivalent reflow, not formal accessibility certification or native toolbar zoom. Compiled smoke uses `NODE_ENV=test` for local HTTP cookies and does not claim deployment or HTTPS verification.

This repeat used only `toktickit_lab4_final_test_20261031_53` in `toktickit-db` (PostgreSQL 16.14), Node.js 22.17.1, explicit environment variables, and temporary links to existing installed dependencies. No fresh npm installation is claimed. The user explicitly approved teardown; that database and `/private/tmp/toktickit-lab4-final-test-uploads-20261031-53` were removed and absence verified. Development `toktickit`, its container, the original checkout's manifest edit, and historical captures were preserved. Six selected fresh captures are in [final-main-confirmed screenshots](../../artifacts/lab-04/screenshots/final-main-confirmed/).

Technical final-main verification and the startup correction are complete. Issue #53 is currently closed on GitHub; this record does not claim the submission PDF has been prepared. After review/merge of this documentation-only evidence PR, prepare the PDF as the final submission step. The following earlier execution/fix records remain historical and are superseded by this confirmation.

## Historical first-main execution and branch correction

Executed on 31 October 2026 (Asia/Bangkok), after [release PR #60](https://github.com/Maibokdaimhai/TokTickIT/pull/60) merged. The [actual approval](https://github.com/Maibokdaimhai/TokTickIT/pull/60#pullrequestreview-5715785065) is by Kawi-HBLI. Tested main SHA: `51d0d7aeef13097376a9e3fd98bcaea670d8f191`. [Sanitized results](../../artifacts/lab-04/verification/final-main.json) and [source manifests](../../artifacts/lab-04/verification/final-main-source-snapshots.json) separate this commit from the correction below.

## Historical results on the first main commit

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

The earlier motion-follow-up and guard-fix verification gaps are now covered by this new main run. Its results do not erase or relabel the historical runs. At this first-main execution, the release was **blocked by compiled startup**, rather than marked all-pass. The corrected-main confirmation above now supersedes that blocker.

## Startup defect and separately tested correction

The main server build uses the general TypeScript config, which includes tests importing the shared E2E guard outside `server/`. The inferred common source root therefore moves compiled application files to `dist/server/src/`. `npm start` still loads `dist/src/index.js`. A clean worktree exposed the problem; an old build directory could leave an obsolete entry and mask it.

Correction implementation: `30d436a` on `codex/lab4-final-main-evidence`, based on the tested main SHA. `tsconfig.build.json` pins `rootDir` to the server directory and includes application/Prisma sources only. The build script selects it; the general config continues to typecheck tests.

A new opt-in regression clears only the ignored server `dist` output, builds the application, runs the actual `npm start` command with an isolated migrated schema and an allocated loopback port, checks `/api/health`, signs in as a synthetic Staff user, and reads its authenticated Dashboard. It failed before the fix with the actual missing-entry error and passed afterward. The first post-fix attempt found a signal-state race in the new test's process cleanup; that harness error was corrected and is recorded separately from the passing result.

After the correction:

- Focused compiled-start regression: **1 passed**.
- Complete backend with `LAB4_PRODUCTION_SMOKE=1` and restore enabled: **425 passed, 0 failed**, 1 separately executed performance opt-in skipped.
- Server no-emit typecheck and production build: passed; compiled entry is `dist/src/index.js`.
- The main-run client/browser/performance results above are not claimed as reruns after this build-only correction. At that branch-only stage the correction had not yet been verified on a newly merged main SHA; the confirmation above now provides that execution.

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

## Historical remaining work (now completed by the confirmation above)

At the first-main stage, the build correction still needed review/merge and updated-main execution. PR #61 and the confirmation above have now completed that technical work. Issue #53 was reopened at the earlier review stage and is now closed on GitHub. PDF preparation remains a subsequent submission task; no PDF or deployment was performed here.
