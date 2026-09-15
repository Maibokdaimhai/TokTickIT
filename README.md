# TokTickIT

IT Service Desk application built with React, Vite, Express, Prisma, and PostgreSQL.

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

Current increment: Issue #28 completes the authentication/authorization cutover for the existing requester workflow. Ticket ownership now comes exclusively from the authenticated session; legacy `requesterId` inputs are ignored, cross-requester lookups return non-disclosing 404 responses, and endpoint role checks are enforced server-side. IT Staff and Administrators may read attachment metadata and download active files for accessible tickets, but cannot use requester-only creation, rollback, upload, or removal routes. Staff queue, ticket operations, and administration screens follow in their own issues.

## Prerequisites
- Node.js (v18+)
- Docker Desktop

## Installation & Setup
 
1. **Install Dependencies:**
   - **Root (Playwright & Dev Tools):**
     ```bash
     npm install
     ```
   - **Server:**
     ```bash
     cd server && npm install
     ```
   - **Client:**
     ```bash
     cd client && npm install
     ```

2. **Start PostgreSQL via Docker Compose:**
   ```bash
   docker compose up -d
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` inside the `server` directory:
   ```bash
   cd server
   cp .env.example .env
   ```

4. **Apply migrations, bootstrap passwords, and seed:**
   Stop the server first. For an existing database, back up PostgreSQL **and its matching uploads directory** before applying the forward migration. Rehearse on a disposable restored copy first; do not use `db push`, `migrate reset`, or recreate the database to upgrade Lab 2.

   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma generate
   # Enter your own local initial password without echoing it:
   read -s LAB3_INITIAL_PASSWORD
   export LAB3_INITIAL_PASSWORD
   npm run prisma:bootstrap
   npm run prisma:seed
   unset LAB3_INITIAL_PASSWORD
   ```

   The initial password requires at least 10 Unicode characters, uppercase/lowercase/digit/symbol, at most 72 UTF-8 bytes, and no NUL. There is no default credential. Do not commit credentials or paste them into review evidence. Bootstrap fills only migrated users with a missing hash, preserves their IDs/timestamps, and enforces the final NOT NULL constraint; startup refuses an unfinished bootstrap. Rerunning bootstrap/seed never resets established passwords or edited fixture data.

   The seed supplies four active and one inactive Requester, three active and one inactive IT Staff user, one Administrator, 24 representative tickets, eight public comments, and four internal notes. Existing Lab 2 personas retain their IDs. Sample active logins include `jennifer.anderson@example.com`, `alex.thompson@example.com`, and `morgan.davis@example.com`; use the local password you supplied and change it on first login. Used databases can retain modified fixtures rather than reproducing pristine counts.

   Local settings load from `server/.env`; explicit environment variables take precedence. `CLIENT_ORIGIN` defaults to `http://localhost:5173` and must match the frontend exactly. Both development URLs must use `localhost` (not a mix of localhost and 127.0.0.1). Unsafe API clients must send that exact `Origin`. Cookies are HttpOnly/SameSite=Lax with an eight-hour absolute lifetime; production additionally requires HTTPS for Secure cookies.

   Recovery: stop the new server, restore the paired pre-migration database/uploads backup and the prior application version. Do not run the old application against the migrated schema. The archived RequesterUser table is retained but has no public API.

## Running the Application

- **Backend Server (`/server`):**
  ```bash
  cd server
  npm run dev
  ```
  Runs at `http://localhost:3000`

- **Frontend Client (`/client`):**
  ```bash
  cd client
  npm run dev
  ```
  Runs at `http://localhost:5173`

## Running Tests

- **Client Component Tests:**
  ```bash
  cd client && npm test
  ```
- **Server API & Unit Tests:**
  ```bash
  cd server && npm test
  ```
  These integration tests modify fixtures. Explicitly set `DATABASE_URL` to a separate disposable PostgreSQL database, then migrate, bootstrap, and seed it as above. The migration suite additionally creates/drops only its own random schema and requires schema-creation permission. Authentication, migration/seed, and existing regression results are recorded in [the Lab 3 test record](docs/lab-03/tests.md). Never run integration tests against ordinary user data.

  To check backend types without emitting JavaScript, run from the repository root:
  ```bash
  ./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
  ```
- **End-to-End Tests (Playwright):**
  ```bash
  # Export DATABASE_URL for the already prepared disposable database first.
  export E2E_ALLOW_DB_WRITE=1
  npm run test:e2e
  npm run test:e2e:auth
  npm run test:e2e:requester
  ```
  The current six Lab 3 browser checks create uniquely named accounts and clean their own ticket/file fixtures. They cover authentication plus a cookie-authenticated copy of the three Lab 2 journeys; historical Lab 2 tests/evidence remain unchanged. Use a temporary Playwright configuration/output directory for evidence collection when preserving repository screenshots. For isolated ports, align the test server `CLIENT_ORIGIN`, client `VITE_API_URL`, Playwright baseURL, `E2E_CLIENT_ORIGIN`, and `E2E_API_ORIGIN`. Do not point browser tests at an unrelated running development server.
