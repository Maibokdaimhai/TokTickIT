# AGENT.md: Operational Directives & Working Context

## 1. Project Overview & Architecture
**TokTickIT** (`toktickit`) is a full-stack IT helpdesk and incident ticketing system developed for CPE334 Software Engineering. The codebase is structured as a monorepo containing client, server, and engineering documentation deliverables.

### Monorepo Structure
- `client/`: Single-page frontend application.
  - **Stack**: React 19, TypeScript, Vite, Tailwind CSS / Vanilla CSS tokens, Lucide React.
  - **Testing**: Vitest, React Testing Library, jsdom.
- `server/`: REST API backend.
  - **Stack**: Node.js, Express, TypeScript (`tsx`), Prisma ORM, PostgreSQL, Multer for file uploads.
  - **Testing**: Vitest, Supertest.
- `docs/`: Lab deliverables and engineering specifications.
  - `docs/lab-01/`: Sprint 1 baselines, health checks, and category APIs.
  - `docs/lab-02/`: Sprint 2 deliverables (`specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md`).
  - `docs/superpowers/plans/`: Structured implementation plans.

### Core Architectural Patterns
- **Active Requester Context**: Requester identity is selected via modal, stored in `localStorage` under `toktickit_requester_id`, and validated against `GET /api/requesters/active` upon application launch.
- **Two-Step Ticket Creation Flow (BR-16 / AC-15)**:
  1. `POST /api/tickets`: Validates required fields, checks requester/category/system active statuses, and generates the ticket record.
  2. `POST /api/tickets/:id/attachments`: Uploads files sequentially via `multipart/form-data`.
  3. **Compensation Rollback (Saga)**: If any attachment fails to upload, the client immediately issues `DELETE /api/tickets/:id?requesterId=X` to delete the ticket and remove uploaded files from disk, preserving all user inputs in the form for retry.
- **Concurrency-Safe Sequence Generation**: Ticket identifiers follow `TKT-YYYY-XXXXXX` (e.g., `TKT-2026-000001`). The server enforces sequence locking via PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`) with an optimistic retry fallback to prevent unique constraint collisions (`P2002`).

---

## 2. The Engineering Contract

### Strict TypeScript Compilation Rules
- **Zero JS Emission in Source Folders**: Never compile or output `.js` files in `client/src/`, `client/tests/`, `server/src/`, or `server/tests/`.
- `client/tsconfig.json` MUST keep `"noEmit": true`.
- Never execute bare `tsc` that outputs unmanaged `.js` files alongside `.ts`/`.tsx` files. Always run `npx tsc --noEmit`.

### Defensive Input Validation
- **Integer Validation**: Never rely on loose checks like `typeof id === "number"`. Enforce strict positive integer checks (`Number.isInteger(num) && num > 0`). Non-integer and fractional values (e.g., `1.5`) must return HTTP `400 Bad Request`, not `500 Internal Server Error`.
- **Active Record Checks**: Verify that foreign keys (`requesterId`, `categoryId`, `relatedSystemId`) refer to existing, active records (`isActive: true`).

### Transactional & Concurrency Guarantees
- Generate sequential identifiers inside an explicit database transaction (`prisma.$transaction`).
- Acquire a dedicated PostgreSQL advisory transaction lock on `ticket_number_generation`.
- Wrap creation in an optimistic retry loop (up to 3 attempts) to handle race conditions gracefully.

### Multi-Step Compensation & Cleanup
- Multi-step failures must cleanly roll back database entities and unlink associated physical files from `server/uploads/`.
- On rollback, the client MUST display an error banner while preserving form inputs (`summary`, `description`, `selectedFiles`) to prevent user data loss.

### Evidence-Based Assertions
- Never claim that code works or tests pass without running verification commands and inspecting actual stdout/stderr.

---

## 3. Strict Scope Boundaries

### Feature & UI Scope
- Do not implement unrequested features outside the active issue or lab requirements.
- Strictly adhere to `ui-spec.md` design tokens (Zen Green palette: `#006B3C`, `#0B7A46`, `#EAF6EF`, `#F3F4F6`). Do not install competing UI libraries.
- Limit attachments to documented constraints: max 5 active attachments per ticket, 5 MB file size limit, allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`, `text/plain`.

### File & Directory Boundaries
- Do not modify Prisma migrations out of sequence.
- Do not check in build artifacts (`dist/`, `build/`, `.vite/`, `uploads/*`, `*.log`).
- Do not erase or overwrite historical review records in `docs/lab-01/` or `docs/lab-02/`. All new review responses and prompts must append to existing templates.

---

## 4. Git & Engineering Workflow

### Branch Strategy
- Work on dedicated feature branches (e.g., `feature/lab2-ticket-creation`).
- Keep local branches synchronized with `origin`.

### Conventional Commits
All commits must follow the **Conventional Commits** specification:
- `feat(<scope>): ...` for new user-facing functionality.
- `fix(<scope>): ...` for bug fixes, review corrections, and regression handling.
- `docs(<scope>): ...` for documentation updates (`reviewer.md`, `ai-use.md`, specifications).
- `test(<scope>): ...` for standalone test suites.
- `refactor(<scope>): ...` for code reorganization without behavior change.

### Commit Segregation
- Separate functional fixes/tests from documentation updates whenever possible (e.g., one `fix:` commit for server/client code and tests, followed by a `docs:` commit for `reviewer.md` and `ai-use.md`).
- Ensure `git status --porcelain` is clean before concluding a task.

---

## 5. Development & Testing Commands

### Backend (`server/`)
```bash
# Run unit and integration tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Start backend development server (tsx watch)
npm run dev

# Open Prisma Studio to inspect database records
npx prisma studio

# Run database migrations
npx prisma migrate dev
```

### Frontend (`client/`)
```bash
# Run client unit and component tests (Vitest)
npm test

# Run TypeScript type check (strict noEmit)
npx tsc --noEmit

# Production bundle build
npx vite build

# Run type check and build together
npx tsc --noEmit && npx vite build

# Start frontend development server (Vite)
npm run dev
```

### Git & Verification
```bash
# Check working tree cleanliness
git status --porcelain

# Review recent commit history
git log -n 5 --oneline
```
