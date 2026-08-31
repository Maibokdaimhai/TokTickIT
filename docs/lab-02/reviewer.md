# Lab 2 — Peer Review Record

**Author:** Thanawat Suntarawattana — 67070501022 — GitHub: [@Maibokdaimhai](https://github.com/Maibokdaimhai)  
**Peer reviewer:** Tanadet Nuchaikaew — 67070501081 — GitHub: [@Kawi-HBLI](https://github.com/Kawi-HBLI)  
**Partner I reviewed:** Songwit Rueangsawat — 67070501060 — GitHub: [@R1NNE0](https://github.com/R1NNE0)

---

## Pull Requests I Authored (Reviewed by Partner)

| PR # | Feature Branch | Summary | Reviewer Verdict |
| :--- | :--- | :--- | :--- |
|      | `feature/lab2-spec-and-tests` | Add Sprint 2 engineering specification, tests plan, UI spec, and API spec in `docs/lab-02/`. | Approved |
|      | `feature/lab2-requester-context` | Expand Prisma schema, seed active/inactive requesters, add `GET /api/requesters`, and build Requester Selector UI. | |
|      | `feature/lab2-ticket-creation` | Build `POST /api/tickets` with ticket number generator `TKT-YYYY-XXXXXX`, Create Ticket form, and field validation. | |
|      | `feature/lab2-my-tickets` | Implement My Tickets backend query (search, filter, sort, page) and responsive desktop table / mobile cards UI. | |
|      | `feature/lab2-ticket-detail` | Build read-only Ticket Detail view, attachment upload, active download stream, and soft removal with reason. | |

---

### PR #: `docs: add Sprint 2 engineering specification and test plan`
- **PR Link:** 
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

