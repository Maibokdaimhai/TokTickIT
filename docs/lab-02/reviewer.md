# Lab 2 — Peer Review Record

**Author:** Thanawat Suntarawattana — 67070501022 — GitHub: [@Maibokdaimhai](https://github.com/Maibokdaimhai)  
**Peer reviewer:** Tanadet Nuchaikaew — 67070501081 — GitHub: [@Kawi-HBLI](https://github.com/Kawi-HBLI)  
**Partner I reviewed:** Songwit Rueangsawat — 67070501060 — GitHub: [@R1NNE0](https://github.com/R1NNE0)

---

## Pull Requests I Authored (Reviewed by Partner)

| PR # | Feature Branch | Summary | Reviewer Verdict |
| :--- | :--- | :--- | :--- |
| #16  | `feature/lab2-spec-and-tests` | Add Sprint 2 engineering specification, tests plan, UI spec, and API spec in `docs/lab-02/`. | Approved |
| #17  | `feature/lab2-requester-context` | Expand Prisma schema, seed active/inactive requesters, add `GET /api/requesters`, and build Requester Selector UI. | Approved |
| #18  | `feature/lab2-ticket-creation` | Build `POST /api/tickets` with ticket number generator `TKT-YYYY-XXXXXX`, Create Ticket form, and field validation. | |
|      | `feature/lab2-my-tickets` | Implement My Tickets backend query (search, filter, sort, page) and responsive desktop table / mobile cards UI. | |
|      | `feature/lab2-ticket-detail` | Build read-only Ticket Detail view, attachment upload, active download stream, and soft removal with reason. | |

---

### PR #1: `docs: add Sprint 2 engineering specification and test plan`
- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/16
- **Reviewer Comment I Received(1):**
  ```
  Requesting changes before approval. The required six documentation files are present, but several parts of the engineering contract still need correction:

    1. tests.md marks all planned tests and final results as Pass/100% Pass although the referenced Lab 2 tests and implementation do not exist yet. Please change these to Planned/Not Run and Pending.
    2. Resolve the Ticket Number contradiction between non-sequential and sequential generation, and define the Create Ticket + initial attachment failure/compensation behavior.
    3. Complete the API contract for Ticket Detail, ticket-list errors, attachment metadata/upload/remove errors, requesterId location, and use one consistent ownership status.
    4. Add or correct AC/test coverage for sorting, empty/no-results, accessibility, and fix the incorrect mappings for API-04, UI-02, and AC-15.

    reviewer.md and the remaining ai-use.md entries can continue to be updated progressively during the sprint.
  ```
- **How I responded(1):**
    ```
    Thank you for the detailed and thorough review! I completely agree with your feedback. I have updated the engineering contract documents in `docs/lab-02/` to address all four points:

    1. **`tests.md` Status Fix:** Reset all planned test statuses from `Pass` to `Planned` and updated Section 6 (Final Results) to `Pending (Not Run)` until implementation tests are executed.
    2. **Ticket Numbering & Compensation Strategy (`specification.md`):** 
      - Resolved the Ticket Number format to a consistent annual sequential sequence (`TKT-YYYY-XXXXXX`, e.g., `TKT-2026-000001`).
      - Added **BR-16** specifying atomic creation for tickets with initial attachments (automatic rollback/compensation deletion of ticket and files if upload fails).
    3. **API Contract Completeness (`api-spec.md`):**
      - Explicitly specified `requesterId` location (`?requesterId=X` for GET, JSON body/form-data for POST).
      - Standardized on **HTTP 403 Forbidden** for all unowned ticket and attachment access attempts.
      - Added full schemas for `GET /api/tickets/:id`, 4xx/5xx error responses for all endpoints, and `GET /api/tickets/:id/attachments/:attachmentId/metadata`.
    4. **Acceptance Criteria & Test Mappings:**
      - Corrected mappings for `API-04` (mapped to AC-09, AC-10, BR-12), `UI-02` (mapped to AC-04, BR-11), and `AC-15` (mapped to UI-07, API-03).
      - Added **AC-16** (Sorting), **AC-17** (Empty List vs. No-Results), and **AC-18** (UI Accessibility with focus rings, ARIA labels, and color-independent status badges).
      - Added corresponding test IDs (`API-10`, `UI-07`, `UI-08`, `UI-09`) to `tests.md`.

    All updates have been committed and pushed to `feature/lab2-spec-and-tests`. Please take another look when you have a moment!
    ```

- **Reviewer Comment I Received(2):**
    ```
    Thanks for the update. The test-status changes, ticket-number rule, API schemas, and AC/test mappings are addressed.

    The BR-16 atomic attachment flow is still unclear. The specification says ticket creation with initial attachments must be atomic, but POST /api/tickets is documented as JSON without attachments, while file upload is a separate multipart request. Please clarify whether creation should be a single multipart request or a two-step flow, and document the failure/rollback behavior accordingly. A planned rollback test should also be added.
    ```

- **How I responded(2):**
    ```
    Thank you for pointing out the workflow distinction! That is a great catch. I have clarified the **two-step ticket creation flow** and documented the explicit compensation rollback behavior across `specification.md`, `api-spec.md`, and `tests.md`:

    1. **Two-Step Creation Flow & BR-16 (`specification.md`):** 
      - Clarified that ticket creation with initial attachments is a **two-step REST workflow**: (Step 1) `POST /api/tickets` with JSON payload creates the ticket record; (Step 2) `POST /api/tickets/:id/attachments` uploads each initial file via `multipart/form-data`.
      - Documented the **Compensation Rollback Strategy**: If any attachment upload fails during Step 2, the client executes an automated compensation call (`DELETE /api/tickets/:id?requesterId=X`). The backend deletes the draft ticket record from PostgreSQL and cleans up any saved transient files on disk, returning a safe error banner while preserving form data in the UI.
    2. **Compensation Endpoint (`api-spec.md`):** 
      - Documented section **3.11 `DELETE /api/tickets/:id`** for hard-deleting draft tickets and associated files during compensation rollback.
    3. **Planned Rollback Test (`tests.md`):** 
      - Added planned test **`API-11`** (`DELETE /api/tickets/:id` Rollback Test) mapped to `BR-16` and `AC-15`.

    The changes have been pushed to `feature/lab2-spec-and-tests`. Please take another look!
    ```

- **Reviewer Comment I Received(3):**
    ```
    Approved.

    Reviewed the updated Lab 2 Spec-DD documentation. The engineering requirements are now sufficiently complete and consistent:

    - `specification.md` covers the sprint scope, FR-01–FR-12, BR-01–BR-16, AC-01–AC-18, data models, API summary, UI requirements, and DoD.
    - The ticket number rule is consistently defined as annual sequential `TKT-YYYY-XXXXXX`.
    - The two-step ticket creation and attachment compensation rollback flow is documented, including the rollback endpoint and planned API-11 test.
    - `api-spec.md` documents the required requester, category, related-system, ticket, detail, attachment upload/download/metadata/removal, and rollback endpoints with validation, ownership rules, status codes, and error schemas.
    - `tests.md` now uses Planned/Pending statuses, provides AC traceability, and includes coverage for sorting, empty/no-results states, accessibility, and rollback behavior.
    - `ui-spec.md` defines the Zen Green design system, responsive layouts, loading/error/empty states, attachment states, and accessibility requirements.
    - The PR remains documentation-only as expected for this Spec-DD phase; implementation and test execution are correctly deferred to the following increments.

    No blocking issues remain. Approved.
    ```

- **How I responded(3):**
    ```
    Thank you หลายเด้อ
    ```

### PR #2: `feat: Development Requester Context & Database Seed`
- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/17
- **Reviewer Comment I Received(1):**
  ```
  Thanks for the implementation. I verified that the client tests (5/5), server tests (4/4), TypeScript checks, and client build pass. Migration and repeated seeding also work correctly.

  However, manual testing revealed the following issues:

  1. Stale selection after API failure
    Select another requester, click Cancel, then reopen the selector while the API is unavailable. Continue remains enabled and applies the previously cancelled selection, even though the dropdown is hidden by the error state.
    Please disable confirmation during errors and reset stale selection state when reopening.

  2. Previously selected requester becomes inactive
    The saved requester is restored without checking whether they are still active. When reopening the selector, the dropdown can display another requester while retaining the old selected ID, causing Continue to do nothing.
    Please validate the restored requester and ensure the selected ID matches an available option.

  3. Test data remains after API tests
    The requester API tests insert active/inactive test users but only disconnect afterward. The active test user remains visible in the application.
    Please isolate the test database or safely clean up test-owned records.

  Please add regression tests for the first two scenarios, including Cancel, failed reload, and inactive saved selection.

  Requesting changes before approval.
  ```
- **How I responded(1):**
    ```
    Thank you for the thorough code review and manual testing feedback! I have resolved all three issues and added automated regression tests in commit `340dd05`.
    ### Summary of Fixes:
    1. **Stale Selection Reset & Disabled State on API Failure**:
      - Updated `RequesterSelectorModal.tsx` to reset the draft selection state whenever the modal opens.
      - On API fetch failure, `selectedId` is cleared and `requesters` is set to an empty array.
      - Updated the **Continue** button logic to be strictly disabled (`disabled={loading || !!error || requesters.length === 0 || !selectedId}`) so unconfirmed or cancelled selections cannot be submitted during errors.
    2. **Inactive Saved Requester Handling**:
      - Added validation against fetched active requesters. If the saved user ID in `localStorage` is no longer active (or missing from `/api/requesters`), the dropdown automatically defaults to the first available active user (`data[0]`) so React state and dropdown options remain synchronized.
    3. **API Test DB Data Isolation**:
      - Updated `server/tests/lab-02/requesters.api.test.ts` to include cleanup in the `afterAll` hook (`prisma.requesterUser.deleteMany()`), ensuring test emails (`test.active@example.com` and `test.inactive@example.com`) are removed and do not bleed into the dev UI.
    4. **Automated Regression Tests**:
      - Added unit test coverage in `RequesterSelector.test.tsx` verifying:
        - The **Continue** button is disabled on API error.
        - Stale draft selection is reset upon reopening after a cancel + failed reload.
        - Saved inactive requesters automatically fallback to the first active user.
    ```
- **Reviewer Comment I Received(2):**
    ```
    Thanks for the update. The stale-selection/API-error issue and test-data cleanup are fixed.

    One part of the inactive-requester issue remains: on page reload, RequesterContext still restores the cached requester without validating whether they are active. The new fallback only runs when the selector is manually opened.

    Please validate the saved requester against the active-requester list during startup. If they are no longer active, clear the saved selection and open the selector automatically.

    Please also add a regression test for this startup scenario without manually clicking “Open Selector”.
    ```
- **How I responded(2):**
    ```
    Thank you for catching that startup edge case! I have updated `RequesterContext` to validate cached requesters on startup and added the requested startup regression test in commit `e1639df`.
    ### Summary of Follow-up Fixes:
    1. **Startup Inactive Requester Validation**:
      - `RequesterProvider` now asynchronously validates any cached `localStorage` requester against `fetchRequesters()` during startup `useEffect`.
      - If the saved user is inactive or missing from the active list, `localStorage` is cleared, `selectedRequester` is reset to `null`, and `isSelectorOpen` is set to `true` to display the selector modal immediately on load.
    2. **Startup Regression Test**:
      - Added `validates saved requester on startup and automatically opens modal if saved user is inactive` in `RequesterSelector.test.tsx`. It pre-populates an inactive cached user and verifies that the modal automatically opens on startup and clears the invalid cached state without manual user interaction.
    All 8 client tests and 4 server tests pass cleanly with 0 TypeScript errors. Ready for re-review!
    ```
- **Reviewer Comment I Received(3):**
    ```
    Approved.
    Verified the latest update. Cached requesters are now validated on startup, and inactive or missing requesters are cleared with the selector opening automatically. The startup regression test covers this without manual interaction.
    All previously requested fixes are addressed. Client tests (8/8), server tests (4/4), TypeScript checks, and the client build pass. Ready to merge.
    ```

---

### PR #3: `feat: Create Ticket API, Form, and Validation`
- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/18
- **Reviewer Comment I Received(1):**
  ```
  Thanks for the implementation. The client tests and TypeScript checks pass, but I found a few issues that should be addressed before approval:
  1. Initial attachments are not uploaded. Files can be selected and displayed in the form, but handleSubmit only creates the ticket. The selected files are never sent to an attachment endpoint, and compensation rollback is never triggered if an upload fails. This does not yet satisfy the documented BR-16/AC-15 workflow.
  2. Ticket-number generation is not concurrency-safe. Two simultaneous requests can generate the same next ticket number, causing one request to fail because ticketNumber is unique.
  3. Numeric IDs should be validated as integers. Values such as categoryId: 1.5 currently pass the initial validation and may result in a 500 response instead of 400.
  Please add regression tests for attachment upload/rollback, parallel ticket creation, and fractional IDs.
  Requesting changes before approval.
  ```
- **How I responded(1):**
  ```
  Thank you for the detailed review and for identifying these edge cases! I have addressed all points, added security protections against XSS and SQL injection, and implemented the requested regression tests:

  1. **Initial Attachment Upload & Compensation Rollback (BR-16 / AC-15):**
    - Implemented the full two-step creation flow in `CreateTicketForm.tsx`: Step 1 creates the draft ticket (`POST /api/tickets`), and Step 2 sequentially uploads selected files (`POST /api/tickets/:id/attachments`).
    - Implemented `POST /api/tickets/:id/attachments` with MIME validation (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), 5 MB file size limit, max 5 active attachments limit, and disk storage under `server/uploads/`.
    - If any attachment upload fails, the client immediately executes automated compensation rollback (`DELETE /api/tickets/:id?requesterId=X`). The backend purges the draft ticket and unlinks any written files on disk, while preserving user-entered form values in the UI with a descriptive error callout.

  2. **Concurrency-Safe Ticket Number Generation:**
    - Wrapped ticket creation in a transaction using PostgreSQL advisory transaction locking (`SELECT pg_advisory_xact_lock(hashtext('ticket_number_generation'))`), serializing sequence allocation across parallel requests.
    - Added an optimistic retry loop (up to 5 attempts) catching `P2002` unique constraint violations on `ticketNumber` with jittered backoff.
    - Added regression test `safely handles parallel ticket creation requests without duplicate ticketNumber collisions` executing 5 concurrent requests via `Promise.all` and verifying unique sequential numbers without collisions.

  3. **Strict Integer Validation for Numeric IDs:**
    - Implemented `isValidIntegerId()` helper enforcing `Number.isInteger() && val > 0` for `categoryId`, `relatedSystemId`, `requesterId`, and route parameters. Fractional inputs like `categoryId: 1.5` now return HTTP 400 Bad Request with field validation details instead of crashing with 500.
    - Added regression test `rejects fractional numeric IDs (e.g. categoryId: 1.5) with 400 Bad Request instead of 500`.

  4. **Security & Injection Hardening (XSS and SQL Injection):**
    - Database queries strictly use Prisma's parameterized queries and integer validation bounds, preventing SQL injection.
    - XSS is prevented by relying on React's automatic string interpolation, sanitizing upload filenames to prevent directory traversal, and setting standard HTTP security headers (`X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `X-Frame-Options: DENY`).

  5. **Automated Regression Tests & Verification:**
    - Added client unit tests in `CreateTicket.test.tsx` verifying sequential attachment uploads and compensation rollback on upload failure.
    - Added server tests in `create-ticket.api.test.ts` covering parallel creation, fractional IDs, attachment upload & file cleanup on rollback.
    - Client tests (14/14), server tests (14/14), TypeScript typechecks, and client production build all pass cleanly.
  ```
- **Reviewer Comment I Received(2):**
  ```
  Thanks for the update. The attachment upload flow, concurrent ticket creation, and fractional-ID validation are addressed. Client tests (14/14), server tests (14/14), TypeScript checks, and the client build pass.
  One issue remains: when both attachment upload and compensation rollback fail, the rollback error is silently ignored, but the UI still says “The draft ticket was rolled back.” The ticket may still exist, so retrying submission could create duplicates.
  Please distinguish successful rollback from failed cleanup, retain the draft ticket ID for recovery, and add a regression test where both upload and rollback fail.
  Requesting changes for this remaining issue.
  ```
- **How I responded(2):**
  ```
  Thank you for catching this dual-failure cleanup edge case! I have addressed the issue by distinguishing failed cleanups, retaining draft ticket recovery state, and adding the requested regression test:

  1. **Distinguish Successful Rollback vs. Failed Cleanup:**
    - In `CreateTicketForm.tsx`, the compensation rollback `catch` block now captures `rollbackErr` rather than silently ignoring it.
    - If rollback succeeds: The UI displays `Attachment upload failed: <detail>. The draft ticket was rolled back.`
    - If rollback fails: The UI explicitly states `Attachment upload failed: <detail>. Compensation rollback also failed: <detail>. Draft ticket #<id> (<ticketNumber>) may still exist. Retrying submission directly could create duplicates; please retain this draft ticket ID for recovery.` It no longer falsely claims the draft ticket was rolled back.

  2. **Retain Draft Ticket ID for Recovery:**
    - Added `retainedDraftTicket` state (`{ id, ticketNumber }`) to the form.
    - When cleanup fails, a dedicated recovery banner (`data-testid="retained-draft-recovery"`) is rendered prominently above the form, displaying the retained Draft Ticket ID and Ticket Number for administrative or manual recovery, while warning against blind resubmission.
    - User-entered form values (`summary`, `description`, `selectedFiles`) remain fully preserved.

  3. **Automated Regression Test:**
    - Added unit test in `CreateTicket.test.tsx`: `BR-16 / AC-15: distinguishes failed cleanup when both upload and rollback fail, retaining draft ticket ID`.
    - Verifies that when both `uploadAttachment` and `deleteTicketRollback` reject:
      - The UI does NOT say "The draft ticket was rolled back."
      - The failed cleanup error and rollback error message are shown.
      - The retained draft ticket ID and ticket number are rendered in the recovery banner.
      - Form fields remain preserved.

  All 15 client tests, 14 server tests, TypeScript checks (`tsc --noEmit`), and client Vite production build pass cleanly. Ready for re-review!

---

### PR #4: `feat: My Tickets List, Search, Filters, and Pagination`
- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/19
- **Reviewer Comment I Received(1):**
  ```
  Thanks for the implementation. Client tests (21/21), server tests (20/20), TypeScript checks, and the client build pass.

  However, additional component tests confirmed two issues:

  1. **Stale responses after switching requesters:** A delayed response for Requester A can overwrite Requester B’s list after switching identities. Please cancel outdated requests or ignore responses that no longer belong to the latest request. This should also cover search/filter changes.

  2. **Pagination is not reset on requester change:** Switching from page 2 of Requester A to Requester B still requests page 2. If B has only one page, the UI incorrectly shows an empty state with no pagination controls. Please reset to page 1 when the requester changes.

  Please add regression tests for out-of-order responses and requester switching from a later page.

  Requesting changes before approval.
  ```
- **How I responded(1):**
  ```
  Thank you for the thorough review and for catching these two asynchronous lifecycle and state reset edge cases! I have addressed both issues and added the requested automated regression tests:

  1. **Cancellation & Out-of-Order Response Protection:**
    - Updated `fetchMyTickets` in `client/src/api.ts` to accept and pass an optional `signal?: AbortSignal` down to native `fetch()`.
    - In `client/src/components/MyTicketsPage.tsx`, wrapped ticket fetching in an `useEffect` equipped with an `AbortController` and `isCancelled` flag.
    - Whenever `selectedRequester?.id`, `debouncedSearch`, `categoryId`, `priority`, `status`, `sort`, or `page` changes, the previous in-flight request is immediately aborted via `controller.abort()` and flagged with `isCancelled = true`.
    - Any delayed response from an earlier request is safely discarded and will never overwrite the latest active requester or filter state.

  2. **Pagination Reset on Requester Identity Change:**
    - In `MyTicketsPage.tsx`, added a `prevRequesterIdRef` reference tracking the active requester.
    - When `selectedRequester.id` changes, if `page !== 1`, the component immediately calls `setPage(1)` and suppresses fetching with the old page number for the new requester.
    - This ensures switching to a new requester always requests `page: 1` and never erroneously triggers an empty state due to an out-of-range page index.

  3. **Automated Regression Tests:**
    - In `client/tests/lab-02/MyTickets.test.tsx`:
      - Added `REGRESSION: ignores stale out-of-order responses when switching requesters or filters`: Simulates a slow pending promise for Requester A that resolves after Requester B's data has already loaded, verifying that Requester A's delayed response does not overwrite Requester B's tickets.
      - Added `REGRESSION: resets page to 1 when switching requesters from a later page`: Simulates navigating to page 2 for Requester A and switching to Requester B (who has only 1 page), verifying that `page: 1` is requested and rendered, and `page: 2` is never called for Requester B.

  All 23 client tests (4 test suites), 20 server tests (5 test suites), TypeScript checks (`tsc --noEmit`), and Vite production build pass cleanly with 0 errors. Ready for re-review!
  ```

---

## Pull Requests I Reviewed for My Partner

### PR: `docs: setup sprint 2 specifications, test plan, and review templates (Issue #1)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/19
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification

    I have reviewed the engineering specification and test plan deliverables for this issue in Lab 2.

    ### Verification Results
    - [x] **`specification.md` Sections:** Covers all 11 required sections from Appendix A (Goal, Stakeholder Interpretation, Scope, FRs, BRs, UI Summary, Database Design, API Summary, ACs, DoD, Assumptions).
    - [x] **Acceptance Criteria Format:** `AC-01` through `AC-10` strictly follow the Given-When-Then format.
    - [x] **`api-spec.md` Completeness:** Specifies full REST contracts for active requesters, categories, related systems, ticket management, file upload, streaming download, and soft removal.
    - [x] **`ui-spec.md` Design Tokens & Breakpoints:** Enforces Zen Green tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`, `#F3F4F6`), button/form states, desktop/tablet/mobile layout rules, and screenshot artifact paths.
    - [x] **`tests.md` Traceability:** Maps 21 planned test scenarios (`API-01..14`, `UI-01..06`, `E2E-01`) directly to target test files and satisfies full `AC-01..10` traceability.
    - [x] **Documentation Templates:** `reviewer.md` and `ai-use.md` follow standard structure.

    ### Verdict
    **Approved!** Excellent detail and clear traceability between requirements, API endpoints, UI tokens, and test files. Ready for implementation in Sprint Next Issue.

    I forgot to tell you about issue that you linked. I think you linked in wrong with the another one on pull request description. It links to #1 instead of #12.
    ```
- **Partner's response:**
    ```
    Thanks for the review and for pointing that out!

    GitHub automatically hyperlinks `#1` to the very first item in the repository (which happened to be PR #1 from Lab 1). In this context, it was intended to reference **Issue #1** of Lab 2 on our project board rather than the old pull request.

    I appreciate you catching that detail! Everything is clear now, and this PR is ready to be merged into `lab2-staging`.
    ```

### PR: `feat(db): setup lab 2 prisma schema and idempotent seed data (#2)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/20
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification

    I have reviewed the database schema migrations and idempotent seed scripts for **Lab 2 (Issue #2)**.

    ### Verification Results
    - [x] **Prisma Models & Enums:** `RequesterUser`, `Category`, `RelatedSystem`, `Ticket`, and `Attachment` strictly conform to `docs/lab-02/specification.md` Section 7. Enums `Priority` and `TicketStatus` are correctly declared.
    - [x] **Performance Query Indexes:** Composite indexes `(requesterId, createdAt DESC)` and `(requesterId, currentStatus)` are defined on `Ticket` to ensure fast requester-scoped filtering.
    - [x] **Soft Removal Support:** `Attachment` model contains `isRemoved`, `removedAt`, and `removalReason` fields with `onDelete: Cascade`.
    - [x] **Migration SQL:** Migration script `20260830193542_init_lab2_schema` generates schema DDL cleanly.
    - [x] **Idempotent Seed Script (`server/prisma/seed.ts`):** 
      - Seeds 4 Categories and 7 Related Systems using `upsert`.
      - Seeds 4 Active Requesters + 1 Inactive Requester (`isActive: false`).
      - Seeds 5 realistic sample Tickets across various statuses and priorities.
      - Seeds 2 sample attachments (1 active PDF, 1 soft-removed PNG with removal reason).
      - Can be executed multiple consecutive times without duplicate key errors.

    ### Verdict
    **Approved!** The database schema and seed script meet all technical specifications and idempotency requirements. Ready to merge into `lab2-staging`.
    ```
- **Partner's response:**
    ```
    Thank you for the thorough review and verification! 

    I appreciate you checking the Prisma models, composite indexes, soft-removal fields, and verifying the seed script's idempotency. 

    Everything is in order and this PR is ready to be merged into `lab2-staging`.
    ```

### PR: `feat(auth): implement development requester context and persona selection screen (#3)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/21
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification
    I have reviewed the Development Requester context, persona switcher UI, and backend authentication middleware.

    ### Verification Results
    - [x] **Active Requesters API (`GET /api/requesters/active`):** Returns only active requesters (`isActive: true`) ordered alphabetically by name (`orderBy: { name: 'asc' }`).
    - [x] **Authentication Middleware (`requireRequester`):** Enforces header presence, checks numeric format, and returns `HTTP 403 Forbidden` if the requester is non-existent or inactive.
    - [x] **State & Persistence (`RequesterContext`):** `localStorage` synchronizes `toktickit_selected_requester_id` cleanly. `authFetch()` automatically injects the `x-requester-id` header into outgoing API calls.
    - [x] **Zen Green UI Implementation:** `Header` displays active avatar initials with "Switch" CTA. `RequesterSelector` includes the mandatory Lab 3 disclaimer callout banner, spinner loading state, and retry action.
    - [x] **Automated Tests:** Verified locally — all 9 server API/middleware tests and all 11 client UI component tests pass with 100% assertions green.

    ### Verdict
    **Approved!** Excellent implementation of the simulated identity context, middleware validation, and Zen Green UI layout. Ready to merge into `lab2-staging`.
    ```
- **Partner's response:**
    ```
    Thanks for the thorough review and verification!
    I appreciate you validating both the backend identity boundary (`requireRequester` middleware, sorted active requesters) and the frontend `RequesterContext` state persistence via `localStorage`.
    The branch is clean and ready for you to merge into `lab2-staging`. Once merged, I will update my local records and the project board before proceeding to Issue #4!
    ```


