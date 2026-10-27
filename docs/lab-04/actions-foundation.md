# Issue #48 - Actions Taken Foundation

Implementation commit `0432b19` on `feature/lab4-actions-foundation`, based on staging `ecf4c47` after PR #46. No deployment or development-database migration is performed by this work.

## Implemented boundary

- Layered controller/service/validator/routes for action create, list, single read, edit, public revisions and BR-23 follow-up completion.
- Backend actor/ownership checks, eligible independent assignee, plain-text/date validation and frozen/terminal work rules.
- Atomic Ticket/action versions and revision writes; ordered User -> Ticket -> action locks coordinated with Administrator changes.
- Actor-scoped UUID create replay identity, exact semantic retry comparison and no duplicate creation on concurrent retry.
- New forward migration `20261027090000_lab4_actions_foundation`, UTC instant fields, restrictive foreign keys, indexes, immutable revision/event triggers and all-or-none follow-up completion evidence.
- Draft compensation rejects Tickets containing Actions or transition events.
- Additive Lab 4 fixture seed; baseline Lab 3 seed command remains unchanged.

The schema includes resolution metadata, transition-event storage and the migration history-start marker needed by later Issues. Ticket resolution-gate enforcement, transition event production/read API and resolution timestamp updates are intentionally delivered under Issue #50. Dashboards and their list-filter extensions belong to #51; UI belongs to #49. Do not present this foundation branch as the complete Lab 4 product or release it independently to final main.

## Applying the migration

Before changing a non-disposable database, stop application writes and take a verified backup of that database and its attachment storage. Keep the matching pre-migration application version available. Supply DATABASE_URL securely for the intended target; never paste it into review evidence.

From `server/`:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

Restart the application after schema changes so Prisma/PostgreSQL prepared statements do not retain the old Ticket column shape. Do not run reset or destructive push against an existing database. Existing Ticket IDs/values/relationships and attachments remain intact; only existing RESOLVED/CLOSED Tickets receive the documented estimated resolution timestamp from their UTC updatedAt. No Action or historical transition is invented.

Revision snapshots are JSONB objects generated exclusively by the backend, containing the contract's scalar fields and original actor/assignee IDs. Safe response formatters explicitly exclude retry keys, canonical request payloads, seed keys, password hashes and storage paths. Immutable triggers reject revision/event UPDATE and DELETE, while new revisions are appended normally.

## Fixtures

Run the existing Lab 3 seed first with its locally supplied initial password, then:

```sh
npm run prisma:seed:lab4
```

The new seed requires eligible Lab 3 Requesters, Staff and Administrator personas. It creates 16 separately keyed Tickets covering all eight statuses and four priorities, with assigned/unassigned ownership and zero/one/multiple Actions (15 total). All four Action statuses and pending follow-up are represented. Each initial Action has one revision. Reruns use stable fixture keys and do not overwrite existing work. It does not fabricate transition events or change existing user credentials/roles. Use a fresh disposable database for pristine demonstration fixtures if personas have been intentionally changed.

## Automated verification

New DB tests refuse to run without DATABASE_URL naming a disposable PostgreSQL database and E2E_ALLOW_DB_WRITE=1. Each suite creates its own UUID schema and only removes that schema. Supply these values in the process environment before running from `server/`:

```sh
npm test -- tests/lab-04
npm test
npx tsc --noEmit
npm run build
```

The recovery test additionally requires LAB4_RECOVERY_CONTAINER naming the dedicated test PostgreSQL container, with pg_dump/pg_restore and the same configured test user/database. Without it, that one recovery test is explicitly skipped; it must not be reported as passed. In this rehearsal a separate localhost-only PostgreSQL 17 container was provisioned, all suites ran with recovery enabled, and the pre-migration schema backup was restored into a second randomly named disposable database. Original records/relationships and a legacy status/version write were checked there; attachment bytes/checksum were preserved independently. This is a SQL/data recovery rehearsal, not a claim that an old production application deployment was exercised.

Migration regression for Lab 3 now pins its own named migration rather than assuming the latest migration is Lab 3. It still verifies email-collision aborts, bootstrap, data preservation and seed behavior, then applies subsequent additive migrations before using the current generated Prisma client.

Actual run results and a fingerprint of the tested server sources (verified before committing as `0432b19`) are recorded in [tests.md](tests.md) and [verification summary](../../artifacts/lab-04/verification/actions-foundation.json). Browser/UI tests are not part of this backend foundation verification. The planned API-19 resolution-through-success and API-20 resolution race checks remain incomplete until Issue #50 adds the gate; their foundation follow-up, concurrency and rollback portions are covered now.

## Recovery procedure

If the forward migration fails, its explicit transaction rolls back schema/data changes. Investigate the migration failure without resetting existing data; reconcile failed migration metadata using the reviewed Prisma recovery process before retrying.

For restore-based recovery, stop writes, restore the verified pre-migration database backup into a separate recovery target, verify original counts/FKs/Ticket values and attachment bytes, and redeploy the matching pre-migration application against that restored target. Switch the application only after those checks. Preserve the failed/post-migration database for investigation. This is not a lossless downgrade after Lab 4 writes: work recorded after the backup must be reconciled separately. Never drop action/revision tables as an ad hoc rollback.
