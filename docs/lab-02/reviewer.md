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
| #18  | `feature/lab2-ticket-creation` | Build `POST /api/tickets` with ticket number generator `TKT-YYYY-XXXXXX`, Create Ticket form, and field validation. | Approved |
| #19  | `feature/lab2-my-tickets` | Implement My Tickets backend query (search, filter, sort, page) and responsive desktop table / mobile cards UI. | Approved |
| #20  | `feature/lab2-ticket-detail-and-attachments` | Build read-only Ticket Detail view, attachment upload, active download stream, and soft removal with reason. | Approved |
| #22  | `test/lab2-e2e-and-evidence` | Playwright E2E suite, 13 visual inspection screenshots, and test matrix completion. | Approved |

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
- **Reviewer Comment I Received(2):**
  ```
  Approved.
  Verified the latest update. Stale responses are now discarded, and pagination resets to page 1 when switching requesters. Regression tests cover both scenarios and pass.
  Client tests (23/23), server tests (20/20), TypeScript checks, and the client build pass.
  All requested review changes are addressed. Ready to merge.
  ```
- **How I responded(2):**
  ```
  ( ^^)b
  ```
---

### PR #5: `feat: Ticket Detail Screen & Soft Attachment Lifecycle`
- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/20
- **Reviewer Comment I Received(1):**
  ```
  Thanks for the implementation. Client tests (29/29), server tests (34/34), TypeScript checks, and the client build pass.
  One issue remains: an attachment uploaded with a UTF-8 filename such as หลักฐาน.pdf is saved successfully with HTTP 201, but downloading it returns HTTP 500. The download endpoint inserts the Unicode filename directly into the Content-Disposition header.
  Please use a Unicode-compatible header formatter, or provide an ASCII fallback with an encoded filename* parameter. Add a regression test confirming that a Thai-named file uploads and downloads successfully.
  Requesting changes before approval.
  ```
- **How I responded(1):**
  ```
  I have addressed the Unicode filename download issue and added the requested automated regression test:

  1. Unicode-Compatible Content-Disposition Header (RFC 6266 / RFC 5987):
     - Implemented formatContentDisposition helper in server/src/app.ts:
       * Generates an ASCII fallback for the standard filename="..." parameter by replacing non-ASCII characters with safe underscores.
       * Generates an RFC 5987 encoded filename*=UTF-8''<percent-encoded> parameter so modern browsers and HTTP clients restore the original UTF-8/Thai filename.
       * Prevents Node.js HTTP header parser from throwing ERR_INVALID_CHAR on non-ISO-8859-1 codepoints.

  2. UTF-8 Filename Decoding on Multipart Upload:
     - Implemented decodeFilename in server/src/app.ts to decode multipart file originalname values that Busboy/Multer parses as Latin-1, ensuring original Thai filenames (e.g. หลักฐาน.pdf) are preserved accurately in the database and sanitized on disk.

  3. Automated Regression Test:
     - In server/tests/lab-02/attachments.api.test.ts:
       * Added "streams active attachment with UTF-8 / Thai filename using RFC 6266 and RFC 5987 Content-Disposition without 500 errors".
       * Uploads an attachment with Thai filename หลักฐาน.pdf (verifying HTTP 201 and originalName preserved).
       * Downloads the attachment via GET /api/tickets/:id/attachments/:attachmentId (verifying HTTP 200, Content-Type, Content-Disposition header containing inline and encoded filename*=UTF-8''...).

  All 35 server tests (7 test suites), 29 client tests (5 test suites), TypeScript checks (tsc), and Vite production build pass cleanly.
  ```
- **Reviewer Comment I Received(2):**
  ```
  Approved
  ```
- **How I responded(2):**
  ```
  Merge เลย :D
  ```

### PR #6: `test(lab-02): E2E test verification and visual screenshot evidence collection`
- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/22
- **Reviewer Comment I Received(1):**
  ```
  Approved.
  I have tested and verified the full test suite and documentation deliverables locally:
  1. **Playwright E2E Suite (`requester-ticket-flow.spec.ts`):**
    - `E2E-01`: End-to-end requester creation workflow with attachment upload, sequential ticket number verification, and My Tickets listing passed cleanly.
    - `E2E-02`: Search filtering, pagination under volume, and empty state verification passed.
    - `E2E-03`: Read-only ticket detail inspection, attachment upload, and soft-removal with reason audit passed.
    - All 3 E2E test scenarios passed (100% assertions green).
  2. **Visual Screenshot Evidence (`artifacts/lab-02/screenshots/`):**
    - All 13 required screenshot artifacts captured and verified across `create-ticket/` (5), `my-tickets/` (4), and `ticket-detail/` (4).
  3. **Unit, API, and Component Tests:**
    - Server Vitest: 35/35 passed across 7 test suites.
    - Client Vitest: 29/29 passed across 6 test suites.
    - TypeScript checks (`tsc --noEmit`) and Vite production build passed with 0 errors.
  4. **Documentation:**
    - `docs/lab-02/tests.md` visual checklist and final results summary are complete and accurate.
    - Traceability matrix is fully satisfied.
  Ready to merge
  ```
- **How I responded(1):**
  ```
  Thank you so much! Ready to merge!!! :D
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

### PR: `feat(ticket): implement create ticket form with file upload and idempotency (#4)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/22
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification — Issue #4

    I have reviewed the ticket creation workflow, attachment handling, concurrency-safe ticket numbering, and idempotency protection for **Lab 2 (Issue #4)**.

    ### Verification Results
    - [x] **Prisma Schema & Idempotency Key:** Added `idempotencyKey` field to `Ticket` model with `@@unique([requesterId, idempotencyKey])`. Re-submitting duplicate requests with identical key returns existing ticket without duplicating records.
    - [x] **Ticket Numbering & Validation (`POST /api/tickets`):** Generates sequential `TKT-YYYY-XXXXXX` ticket numbers. Enforces `x-requester-id` context, input trimming, non-empty text validation, and valid Category/Related System relation checks.
    - [x] **Attachment Upload Constraints (`POST /api/tickets/:id/attachments`):** Multer middleware restricts uploads to <= 5MB each, allowed formats (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), and max 5 active files per ticket. Saved under `uploads/lab-02/`.
    - [x] **Create Ticket UI Component (`CreateTicket.tsx`):**
      - Dropdown selectors with empty prompts and red asterisk indicators.
      - Attachment dropzone with file preview, size validation, and item remove CTA before submit.
      - Submit button busy state with animated spinner preventing duplicate submissions.
      - Preserves entered form values upon network/server failures (AC-10 / BR-11).
      - Dirty form confirmation prompt when attempting to leave with unsaved changes.
      - Confirmation card displaying generated `ticketNumber` upon creation.
    - [x] **Automated Tests & Scenario Audit:** Verified locally — all 19 server integration tests and 21 client UI component tests pass cleanly. Audited all edge-case scenarios (input trimming, size limits, format restrictions, double submit, and server error preservation).

    ### Verdict
    **Approved!** Robust implementation of ticket creation, file uploads, idempotency protection, and Zen Green UX. Ready to merge into `lab2-staging`.
    ```
- **Partner's response:**
    ```
    Thanks for the thorough review and verification!

    I appreciate you checking the entire ticket creation pipeline—from the database idempotency constraint (`@@unique([requesterId, idempotencyKey])`) and concurrency-safe numbering, to the Zen Green form safeguards and attachment restrictions.

    The branch is clean, verified, and ready for you to merge into `lab2-staging`. Once merged, I will sync my local branch and update our project board before proceeding to Issue #5 (My Tickets)!
    ```

### PR: `feat(ticket): implement my tickets list with search, filter, and pagination (#5)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/23
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification — Issue #5

    I have reviewed the requester-scoped ticket listing interface, search keyword filtering, multi-criteria filtering, deterministic pagination, and responsive layout for **Lab 2 (Issue #5)**.

    ### Verification Results
    - [x] **Requester Data Isolation (`GET /api/tickets`):** Strictly enforces `x-requester-id` context. Requesters can only access their own tickets (`requesterId == activeRequester.id`).
    - [x] **Full-Text Search & Multi-Field Filtering:** Supports case-insensitive keyword search across `ticketNumber`, `summary`, and `description`, alongside `categoryId`, `requestedPriority`, and `currentStatus` filters.
    - [x] **Deterministic Sorting & Pagination:** Defaults to `createdAt DESC` with secondary tie-breaker `{ id: sortOrder }`. Delivers pagination envelope with total count, totalPages metadata, and active attachment count per ticket.
    - [x] **Responsive Zen Green UI (`MyTickets.tsx`):**
      - Desktop/Tablet (≥768px): Full 8-column data table with sortable headers and status/priority badges.
      - Mobile (<768px): Touch-friendly card-based list representation.
      - Distinct empty state (*"No tickets submitted yet"*) vs no-results state (*"No tickets match your filters"*).
      - Boundary-safe pagination toolbar.
    - [x] **Automated Tests:** Verified locally — all 25 server integration tests and 27 client UI component tests pass with 100% green assertions.

    ### Verdict
    **Approved!** Excellent implementation of ticket listing, searching, filtering, pagination, and responsive mobile/desktop design. Ready to merge into `lab2-staging`.

    ```
- **Partner's response:**
    ```
    Thanks for the thorough review and verification!

    I appreciate you validating the requester data isolation, deterministic secondary sorting (`{ id: sortOrder }`), responsive desktop/mobile layouts, and the distinction between empty states.

    The branch is clean and ready for you to merge into `lab2-staging`. Once merged, I will sync my local branch and update our project records before moving on to Issue #6 (Ticket Detail View)!
    ```

### PR: `feat(ticket): implement ticket detail view, attachments download, and soft removal (#6)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/24
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification — Issue #6

    I have reviewed the Ticket Detail inspection view, binary attachment streaming/download, and attachment soft-removal workflow for **Lab 2 (Issue #6)**.

    ### Verification Results
    - [x] **Ticket Detail Inspection (`GET /api/tickets/:id`):** Returns full ticket attributes and relations with strict requester ownership enforcement. Attempts to access another requester's ticket return `HTTP 403 Forbidden`.
    - [x] **Binary Attachment Streaming (`GET /api/attachments/:id/download`):** Streams active files with original filename disposition (`Content-Disposition`). Downloads of unowned or soft-removed attachments return `HTTP 403 Forbidden`.
    - [x] **Soft-Removal Auditability (`DELETE /api/attachments/:id`):** Sets `isRemoved = true`, logs `removedAt` timestamp, and requires non-empty `removalReason`. Retains physical files on disk for compliance auditing.
    - [x] **Ticket Detail & Removal Modal UI (`TicketDetail.tsx`):**
      - Read-only panels for metadata, summary, and description.
      - Active attachments list with Download and Remove actions.
      - Soft-removed attachments list displaying `Removed` badge, removal reason callout, and disabled download button.
      - Confirmation modal requiring non-empty removal reason before executing soft deletion.
    - [x] **Automated Tests:** Verified locally — all 35 server integration tests and 32 client UI component tests pass with 100% green assertions.

    ### Verdict
    **Approved!** Excellent implementation of ticket detail inspection, binary attachment streaming, soft-removal auditing, and cross-requester protection. Ready to merge into `lab2-staging`.
    ```
- **Partner's response:**
    ```
    Thanks for the thorough review and verification!

    I appreciate you validating the requester ownership boundaries, the binary download streaming headers, the physical retention of soft-deleted files, and the removal reason confirmation dialog.

    The branch is clean, verified, and ready for you to merge into `lab2-staging`. Once merged, I will sync my local branch and update our project records before we proceed to Issue #7 (E2E and release integration)!
    ```

### PR: `feat: complete e2e integration tests, release verification, and lab 2 documentation (#7)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/25
- **My comment:** 
    ```
    ## Peer Review Checklist & Verification — Issue #7

    I have reviewed the End-to-End Testing, Release Verification, and Final Documentation Integration for **Lab 2 (Issue #7)**.

    ### Verification Results
    - [x] **Automated E2E Integration Suite (`e2e-flow.test.ts`):** 14 test scenarios covering the entire Requester MVP lifecycle (persona discovery, ticket creation with auto-numbering `TKT-YYYY-XXXXXX`, idempotency replay, attachment upload, search/filtering, detail inspection, binary streaming, soft-removal auditing, and cross-requester isolation).
    - [x] **Defensive API Hardening:** Enforces 32-bit integer overflow checks (`MAX_INT = 2147483647`), returns `HTTP 409 Conflict` on repeated attachment removal, injects `X-Content-Type-Options: nosniff`, and applies RFC 6266 UTF-8 header encoding.
    - [x] **Production Builds:** Both backend (`tsc`) and frontend (`vite build`) compiled cleanly with 0 errors.
    - [x] **Finalized Documentation:**
      - `docs/lab-02/tests.md`: Finalized 81/81 passed tests with 100% green status in Section 6.
      - `docs/lab-02/reviewer.md`: Synchronized peer review records across all sprint issues.
      - `docs/lab-02/ai-use.md`: Complete prompt log table and engineering reflection.
    - [x] **Automated Test Coverage:** Verified locally — 49 server tests (8 suites) and 32 client tests (7 suites) pass with 100% green assertions.

    ### Verdict
    **Approved!** Exceptional delivery of E2E test coverage, defensive API hardening, clean production builds, and sprint documentation. Ready to merge into `lab2-staging` and cut the release PR to `main`!
    ```
- **Partner's response:**
    ```
    Thanks for the detailed review and thorough verification!

    I really appreciate you validating the 14 E2E flow scenarios, the defensive API hardening guards (`MAX_INT`, 409 Conflict, `nosniff`, RFC 6266), the 100% green test assertions across all 81 tests, and the complete `docs/lab-02/` documentation suite.

    The branch is fully verified and ready for you to merge into `lab2-staging`. Once merged, we can proceed to cut the final release PR into `main` to wrap up Lab 2!
    ```