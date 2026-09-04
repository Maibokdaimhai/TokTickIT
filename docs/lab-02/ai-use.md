# Lab 2 — AI Pair Programming Log and Reflection

**AI Model Used:** Gemini 3.6 Flash (High) / Antigravity Agentic Assistant

---

## 1. Selected Key Prompts Table

| Prompt # | Topic / Intent | Prompt Excerpt | Outcome / Applied Value |
| :-: | :--- | :--- | :--- |
| **1** | **Sprint Requirements Analysis** | *"Read the Lab 2 worksheet PDF and inspect the current repository to analyze all sprint requirements and technical deliverables."* | Analyzed the PDF handout and current codebase; synthesized a 5-issue sprint plan covering Spec DD, DB seeding, Ticket Creation, My Tickets, and Attachments. |
| **2** | **Prisma Client Debugging & Test Refactoring** | *"Explain what this problem is and help me fix it: Property 'requesterUser' does not exist on type 'PrismaClient'..."* | Diagnosed stale Prisma Client TypeScript definitions, regenerated `@prisma/client`, and refactored client unit tests (`App.test.tsx`) to match the Lab 2 Requester Context UI layout. |
| **3** | **PR Review Remediation & Concurrency/Security Hardening** | *"Requested change: Initial attachments are not uploaded and rollback is not triggered (BR-16/AC-15), ticket-number generation is not concurrency-safe, and numeric IDs must be validated as integers. Please add regression tests and ensure XSS/SQL injection protection."* | Formulated a two-step upload flow with automated compensation rollback (`DELETE /api/tickets/:id`), implemented PostgreSQL transaction-level advisory locking (`pg_advisory_xact_lock`) with optimistic retries for collision-free numbering, added strict integer ID validation (`isValidIntegerId`), hardened against injection (XSS/SQLi), and authored automated regression tests. |
| **4** | **Async Race Conditions & Pagination Lifecycle Fixes** | *"Reviewer said: Stale responses after switching requesters can overwrite lists (cancel outdated requests or ignore stale responses); pagination is not reset on requester change (switching from page 2 requests page 2 on new user). Please add regression tests."* | Diagnosed React asynchronous race condition and lifecycle state retention. Added `AbortController` cancellation and stale response discard (`isCancelled`) to `fetchMyTickets` and `MyTicketsPage`, tracked active requester via `prevRequesterIdRef` to reset page to 1 on identity change, and added comprehensive regression tests in `MyTickets.test.tsx`. |
| **5** | **Ticket Detail View & Attachment Soft Removal Lifecycle** | *"Implement Issue #5: read-only Ticket Detail Screen, attachment download/upload, soft removal with mandatory reasons, ownership checks, and complete automated test coverage according to docs/lab-02."* | Designed and implemented `GET /api/tickets/:id`, active attachment streaming, download blocking on soft-removed files (HTTP 403), and `POST /api/tickets/:id/attachments/:id/remove` with validation ($\ge 3$ chars). Built `TicketDetailPage` with Zen Green read-only fields, active/removed attachment cards, soft-removal modal, and integrated ticket selection into `MyTicketsPage` and `App.tsx`. Authored comprehensive Vitest test suites achieving 100% test pass rate across 63 tests. |
| **6** | **Zen Green UI Refactoring & Micro-UX Polish** | *"Improve UI in container of filter: add labels on top of dropdowns ('Categories', 'Priority', 'Status'), move Clear Filters next to Create Ticket, redesign the header with a custom logo, fix Sort By breaking into a new line on desktop, and remove emoji spam across filter controls."* | Transformed the filter bar into a clean 5-column CSS grid (`.filters-grid`), crafted a custom brand SVG logo and favicon, established clear typographic hierarchy with uppercase muted labels above fields, eliminated visual clutter and emoji spam, and verified responsive wrapping across desktop, tablet, and mobile viewports. |

---

## 2. My Reflection

Throughout Sprint 2, pair programming with an AI agent transformed how I approached building a full-stack ticketing system. Starting with Spec-Driven Development (Spec DD) was a game changer: defining strict contracts in `specification.md`, `api-spec.md`, and `tests.md` before writing code gave both me and the AI a clear roadmap. The AI was particularly effective at accelerating backend and test development—helping me implement PostgreSQL transaction advisory locks (`pg_advisory_xact_lock`) for sequential ticket numbering, structuring the two-step attachment upload with compensation rollback, and writing comprehensive Vitest/Supertest integration suites.

However, I quickly learned that AI cannot replace developer critical thinking, especially during peer code reviews and UI design. When my reviewer caught subtle edge cases—such as dual-failure rollbacks and race conditions where delayed responses from a previous requester overwrote the active dashboard—I had to carefully guide the AI to implement `AbortController` cancellation, `isCancelled` checks, and automatic pagination resets to page 1. Similarly on the frontend, the AI initially produced cluttered layouts with emoji spam; I had to actively step in to enforce clean Zen Green design standards, create a unified 5-column CSS grid for filters, and build custom brand SVGs.

Ultimately, this lab shifted my role from someone who just writes repetitive code to someone acting as a system architect and code reviewer. The AI gave me speed, but my own judgment in validating edge cases, organizing component lifecycles, and demanding automated test evidence is what allowed us to achieve 63 passing tests across 12 suites with zero TypeScript errors.



