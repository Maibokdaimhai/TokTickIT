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

Services take plain values and return data; they do not import Express or send responses. Prisma remains the data-access layer. Issue #26 preserves the Lab 2 API, requester selector, attachment rules, response formats, and schema. Lab 3 authentication and authorization follow in Issues #27 and #28. Business-rule references in extracted legacy code refer to the Lab 2 specification.

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

4. **Sync Database Schema & Seed Data:**
   ```bash
   cd server
   npx prisma db push
   npm run prisma:seed
   ```

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
  These integration tests modify fixtures. Set `DATABASE_URL` to a separate disposable PostgreSQL database, apply the existing migrations with `npx prisma migrate deploy`, and run `npm run prisma:seed` there before testing. The refactor compatibility and service tests are in `server/tests/lab-03/`; detailed Issue #26 results are in [the Lab 3 test record](docs/lab-03/tests.md#11-issue-26-backend-refactor-verification).

  To check backend types without emitting JavaScript, run from the repository root:
  ```bash
  ./server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
  ```
- **End-to-End Tests (Playwright):**
  ```bash
  npm run test:e2e
  # or
  npx playwright test
  ```
 
