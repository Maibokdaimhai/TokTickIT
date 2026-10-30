# TokTickIT

IT Service Desk application built with React, TypeScript, Vite, Express, Prisma, and PostgreSQL.

Lab 4 adds Actions Taken with revision history and follow-up completion, enforced Ticket resolution, public status history, and role-scoped dashboards with filtered drill-downs. Session-based ownership, Public Comments, private Internal Notes, attachments, and Administrator account safeguards from earlier labs remain in place.

PRs [#45](https://github.com/Maibokdaimhai/TokTickIT/pull/45), [#46](https://github.com/Maibokdaimhai/TokTickIT/pull/46), [#54](https://github.com/Maibokdaimhai/TokTickIT/pull/54), [#55](https://github.com/Maibokdaimhai/TokTickIT/pull/55), [#56](https://github.com/Maibokdaimhai/TokTickIT/pull/56), [#57](https://github.com/Maibokdaimhai/TokTickIT/pull/57), and [#58](https://github.com/Maibokdaimhai/TokTickIT/pull/58) are reviewed and merged into `lab4-staging`. This documentation branch prepares [Issue #53](https://github.com/Maibokdaimhai/TokTickIT/issues/53); release integration and verification on the actual final `main` commit remain pending. The submission PDF is prepared last, after that verification.

## Backend Structure

The backend is organized by responsibility, with reference data, tickets, and attachments using the same request flow:

`routes → controllers → services → Prisma`

| Location under `server/src/` | Responsibility |
| --- | --- |
| `app.ts` | Assemble Express middleware and routers; export the app for tests |
| `index.ts` | Start the HTTP listener |
| `routes/` | Map URL/method pairs to controllers and upload middleware |
| `controllers/` | Read HTTP input, call services, send JSON or stream files |
| `services/` | Apply business rules, ownership checks, database queries and transactions |
| `validators/` | Validate IDs, creation fields, list filters, uploads and removal reasons |
| `middleware/` | Parse multipart uploads and translate asynchronous application errors |
| `errors/` | Define expected application errors and their existing response payloads |
| `storage/` | Define local attachment storage and shared file cleanup |
| `utils/` | Handle ticket numbering and Unicode filenames |
| `prisma.ts` | Provide the lazy Prisma client used by services |

Services take plain values and return data; they do not send HTTP responses. Prisma remains the data-access layer. Authentication follows the same route/controller/service structure, with password/session utilities and shared session, Origin, and role middleware. Business-rule references in extracted legacy code refer to the Lab 2 specification.

## Prerequisites

- Node.js and npm; the recorded Lab 4 verification used Node.js 22.17.1.
- Docker Desktop with Docker Compose. The repository uses PostgreSQL 16 in **`toktickit-db`**, exposed on localhost port 5432.
- Chromium for browser checks: run `npx playwright install chromium` after installing root dependencies.

All commands below start from the repository root unless explicitly stated otherwise. Use separate terminals for the API and client.

## Installation and Development Setup

Install the locked dependencies:

```sh
npm ci
npm --prefix server ci
npm --prefix client ci
```

Start the project's PostgreSQL service and create the local configuration only if it does not already exist:

```sh
docker compose up -d postgres
# First setup only; preserve an existing local .env.
cp -n server/.env.example server/.env
```

Review `server/.env` locally. Its example points to the development database `toktickit` using the local Compose credentials. An exported `DATABASE_URL` overrides this file, so check which target you have selected before migration or seeding.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Explicit PostgreSQL target; development and disposable test targets must be different databases. |
| `PORT` | Development API port, normally `3000`. |
| `CLIENT_ORIGIN` | Exact permitted frontend origin, normally `http://localhost:5173`. |
| `LAB3_INITIAL_PASSWORD` | Locally supplied bootstrap/seed password; no application default password is provided. |
| `UPLOADS_DIR` | Optional attachment root; database-backed browser tests require their own guarded temporary directory. |
| `VITE_API_URL` | Optional frontend API URL; needed when using a different API port. |

The API loads `server/.env`; exported variables take precedence. Use `localhost` consistently for the browser/API pair. Authenticated mutations use the session cookie and require an Origin header matching the configured `CLIENT_ORIGIN`; the implementation does not use a separate CSRF token. Session cookies are HttpOnly/SameSite=Lax; production requires HTTPS for Secure cookies. Keep credentials, session data, backups, and raw failure traces out of submitted evidence.

### Migration and Seed

Stop application writes before upgrading an existing database. Take a verified PostgreSQL backup **and the matching uploads backup**, and retain the matching pre-migration application version. Rehearse upgrades on a disposable restored copy. Apply forward migrations rather than resetting existing data.

From `server/`, using the intended `DATABASE_URL`:

```sh
cd server
npx --no-install prisma migrate deploy
npx --no-install prisma generate
# Enter a local initial password without echoing it.
read -r -s LAB3_INITIAL_PASSWORD
export LAB3_INITIAL_PASSWORD
npm run prisma:bootstrap
npm run prisma:seed
npm run prisma:seed:lab4
unset LAB3_INITIAL_PASSWORD
```

Passwords require at least 10 Unicode characters, uppercase/lowercase/digit/symbol, at most 72 UTF-8 bytes, and no NUL. Bootstrap fills missing migrated password hashes and enforces the final NOT NULL constraint. It and the baseline seed preserve established passwords and edited fixture data. Change an initial password on first login.

The baseline seed supplies four active and one inactive Requester, three active and one inactive Staff user, one Administrator, 24 Tickets, eight Public Comments, and four Internal Notes. Example active accounts include `jennifer.anderson@example.com`, `alex.thompson@example.com`, and `morgan.davis@example.com`. Use the password supplied locally; existing accounts may already have a different password.

The separate Lab 4 seed requires those eligible personas. It adds 16 keyed Tickets and 15 Actions covering zero/one/multiple Actions, all Action statuses, assignment, and follow-up. Reruns preserve existing work and do not reset credentials. Modified databases may differ from pristine fixture counts. Existing Resolved/Closed Tickets receive explicitly estimated legacy resolution timestamps; migrations do not invent Actions or past transition events. Restart the API after schema changes. See the [migration and recovery notes](docs/lab-04/actions-foundation.md).

### Start the Application

```sh
# Terminal 1: API at http://localhost:3000
npm --prefix server run dev
```

```sh
# Terminal 2: client at http://localhost:5173
npm --prefix client run dev
```

Check `http://localhost:3000/api/health`, then sign in through the client. Dashboard is the default role home; Ticket Queue, My Tickets, and User Management remain available according to role.

### Build and Start the Compiled API

```sh
./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
npm --prefix server run build
./client/node_modules/.bin/tsc --noEmit --project client/tsconfig.json
npm --prefix client run build
npm --prefix server start
```

The API start script uses `node dist/src/index.js`, matching the current TypeScript output. Supply the intended database and origin settings before startup. Serve `client/dist` through a frontend host with SPA fallback; `npm --prefix client run preview` is a local preview, not a production hosting configuration.

## Testing Safely

### Prepare a Disposable Database for API/Browser Tests

Backend and real-browser tests write fixtures. Use a **new disposable database in `toktickit-db`**, never the development database `toktickit`. The following example uses a dedicated local name; if it already exists, verify that it belongs to your test run or choose a new name.

```sh
docker exec toktickit-db createdb -U toktickit toktickit_lab4_test_local
# Example local Compose credentials; supply a different URL securely if needed.
export DATABASE_URL='postgresql://toktickit:toktickit@localhost:5432/toktickit_lab4_test_local?schema=public'
export E2E_ALLOW_DB_WRITE=1
export UPLOADS_DIR='/private/tmp/toktickit-lab4-test-uploads-local'
```

Prepare that target using the migration/bootstrap/both-seed sequence above, with synthetic test credentials. The explicit opt-in and a complete `test`, `e2e`, or `disposable` token separated by `_` or `-` are required by the guarded runners. `production_contest` is rejected. Names alone do not establish safety: verify the actual target before enabling writes.

Browser uploads must use a dedicated absolute direct child of `/private/tmp` or `/tmp`, with the `toktickit-` prefix, a disposable token, and a separate `uploads` token. Symlink roots and cleanup escapes are rejected. Audited fixture records remain until whole-disposable-database teardown; cleanup does not disable immutable-history triggers. Delete only the verified run's database/uploads after testing and explicit cleanup authorization.

### Suites and Builds

Run backend and real-browser suites sequentially against the shared disposable target, so session cleanup does not interfere. All these commands are from the repository root:

```sh
npm --prefix server test
npm --prefix client test
./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
./client/node_modules/.bin/tsc --noEmit --project client/tsconfig.json
npm --prefix server run build
npm --prefix client run build
```

Migration tests additionally create and remove their own random schemas. To include the actual restore rehearsal, set `LAB4_RECOVERY_CONTAINER=toktickit-db` for the backend test process; Docker access and a matching database/user inside that container are required. Without that setting, the restore case is skipped. Performance is separately opt-in:

```sh
LAB4_RECOVERY_CONTAINER=toktickit-db npm --prefix server test -- --run tests/lab-04/migration-regression.test.ts
LAB4_DASHBOARD_PERF=1 npm --prefix server test -- --run tests/lab-04/dashboard-performance.test.ts
```

### Browser Checks

Supply distinct local synthetic initial/changed passwords meeting the policy, without committing them:

```sh
read -r -s E2E_INITIAL_PASSWORD
export E2E_INITIAL_PASSWORD
read -r -s E2E_CHANGED_PASSWORD
export E2E_CHANGED_PASSWORD
npm run test:e2e -- --list
npm run test:e2e
unset E2E_INITIAL_PASSWORD E2E_CHANGED_PASSWORD
```

The guarded root runner discovers **38 tests in 10 files** spanning retained authenticated Lab 3 journeys and real Lab 4 Actions, workflow, dashboard, and responsive checks. It starts fresh API/client processes on **3104/5174**, refuses to reuse servers, and defaults to one Chromium worker. The archived Lab 2 selector tests are mapped to their authenticated replacements in [the inventory](e2e/lab-02/README.md).

A separate runner discovers **14 controlled-API browser checks** on port **5178**, starting only the frontend and requiring no database:

```sh
npm run test:e2e:fixtures -- --list
npm run test:e2e:fixtures
```

Screenshots default to the regression evidence directories. To preserve committed captures on a new run, export fresh output directories through `E2E_SCREENSHOTS_DIR` (retained Lab 3), `E2E_LAB4_SCREENSHOTS_DIR` (Lab 4), and `E2E_AUDIT_OUTPUT` (rendered audit JSONL). Failure traces may contain sensitive operational data; inspect locally and sanitize anything selected for submission. Build output, dependencies, `.env`, uploads, logs, and `test-results` are ignored; curated evidence under `artifacts/` is tracked intentionally.

### Recorded Evidence and Limits

The [test record](docs/lab-04/tests.md), [regression runbook](docs/lab-04/regression-and-evidence.md), and [sanitized verification artifacts](artifacts/lab-04/verification/) identify the actual tested snapshots. Recorded regression results include 384 backend tests, 195 client tests, 38 real-browser cases, 14 controlled-browser cases, and 65 rendered scenarios. Performance was separately measured with 10,000 Tickets/30,000 Actions. A later PR #58 guard correction passed 56 focused tests without database operations.

These are historical executions, not a fresh final-main run. The final motion-only follow-up was checked with client/controlled-browser suites after test-DB cleanup; the full database/browser suites were not rerun for that change. PR #58's guard-only checks likewise do not replace a complete release run. Preserve those phase limits when reporting results.

## Demo Walkthrough

Use seeded accounts with known local credentials, preferably in a disposable demonstration database.

1. Sign in as Requester, change the initial password if required, inspect the Dashboard, follow a metric into filtered My Tickets, and create a Ticket with an attachment.
2. Sign in as Staff, open the Queue, claim/assign the Ticket, and move it through permitted statuses. Add a Public Comment and a private Internal Note.
3. Record Actions with an eligible assignee and inspect the performer/revision identities. Exercise completion, cancellation, and follow-up on suitable Actions.
4. Attempt Resolve while a blocker exists. Complete outstanding work/follow-up, review the preserved history, refresh current versions, and perform a permitted Resolve transition with the required resolution information.
5. Return as Requester to inspect public Actions and Ticket status history; Internal Notes remain private. Use dashboard drill-downs and return from Detail to verify filters/page context.
6. Sign in as Administrator to inspect the operational Dashboard and User Management within the approved role permissions. Inspect mobile layout, keyboard navigation, and refresh/retry feedback.

## Recovery

Stop writes and retain the failed/post-migration database for investigation. Restore the verified pre-migration database backup into a separate recovery target together with its matching upload files. Verify record counts, foreign keys, Ticket values, and attachment hashes, then deploy the matching pre-migration application against that restored target before switching traffic. Work created after the backup requires separate reconciliation; this is not a lossless downgrade. Do not drop audit tables, disable history triggers, reset an existing database, or run the old application against the migrated schema. See [the recovery procedure](docs/lab-04/actions-foundation.md#recovery-procedure) and its recorded test limits.

## Lab 4 Documentation and Release

- [Engineering specification and DoD](docs/lab-04/specification.md)
- [API contract](docs/lab-04/api-spec.md) and [UI contract](docs/lab-04/ui-spec.md)
- [Tests and traceability](docs/lab-04/tests.md)
- [Peer-review record](docs/lab-04/reviewer.md) and [AI-use/reflection](docs/lab-04/ai-use.md)

Current sequence: finish and review this documentation PR into `lab4-staging`, review the release into `main`, record the actual final-main SHA and execute the required release checks, then prepare the nine-part submission PDF last. This documentation update does not claim a completed final-main release.
