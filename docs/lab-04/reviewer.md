# Lab 4 Review Record - TokTickIT

Status: PR #46 merged after the follow-up-completion correction; Issue #48 implementation is prepared for its own feature PR/review. No unrecorded reviewer approval is claimed.

## Workflow

Review feature PRs into lab4-staging, then release integration into main. Conventional commit scopes should describe the actual change. Keep implementation and documentation commits distinct where practical. Record actual reviewer identity and feedback; do not manufacture review comments, links or approvals. PR #46 targets lab4-staging and closes specification Issue #47 when integrated through the default branch. Requested corrections are committed to the same feature branch.

## Draft decisions to review before implementation

- Action assignment/performer distinction and PLANNED/IN_PROGRESS/COMPLETED/CANCELLED status matrix.
- Terminal immutability, public revision history and Requester visibility of all action fields.
- Resolution gate, follow-up treatment, legacy resolved Tickets and re-resolution behavior.
- Seven Bangkok calendar-date dashboard window and explicitly estimated legacy resolution timestamps.
- Transaction lock order, durable create retry keys, admin eligibility races and restore-based recovery.
- Exact dashboard drill-down filter extensions and complete test discovery.

## Review ledger

| Scope | PR | Reviewer identity | Feedback | Response / evidence | Approval |
|---|---|---|---|---|---|
| Sprint 4 engineering contract and test plan | [#46](https://github.com/Maibokdaimhai/TokTickIT/pull/46) | Kawi-HBLI | [Changes requested](https://github.com/Maibokdaimhai/TokTickIT/pull/46#pullrequestreview-5666239755): completed actions with outstanding follow-up cannot clear the resolution blocker under BR-06/07/12. | Added BR-23 dedicated follow-up completion, retained original work/note and immutable revisions, specified API/UI and completion metadata; added API-19/20 and extended UI-02/E2E-02 through successful Ticket resolution. Checks are contract checks only; feature tests remain Planned. | Correction pushed as 0d90d1a; PR #46 subsequently merged |

Append separate rows for each real review comment and resolution. Include final-main SHA and release approval only after they exist. The previously merged mobile fix is the base of this draft; retrieve its actual PR/review metadata when assembling final evidence rather than guessing a number.

## Issue #48 implementation awaiting review

Branch: feature/lab4-actions-foundation; implementation commit 0432b19. Feature PR publication is authorized; code review is pending. Review scope: migration/backfill and restore, retry serialization, User/Ticket lock ordering, actor/assignee eligibility, public safe projections, immutable history, BR-23 completion and compensation guard. Verification: 317 backend tests, Prisma validation, TypeScript and server build passed locally; see tests.md Section 8. Ticket gate/UI/dashboard integration remains assigned to subsequent Issues.

PR #54 subsequently merged the Issue #48 foundation into lab4-staging. Reviewer identities and any actual feedback must be added from the real review record rather than inferred from the merge.

## Issue #49 implementation awaiting review

Branch: feature/lab4-actions-ui, based on ce32e77; implementation commit 47451ec. Publication authorized; no PR/approval claimed. Review shared Staff/Requester action views, explicit status/follow-up completion, create UUID reuse, draft/version reconciliation, selected-item/history pagination, dirty navigation and safe focus/wrapping. Verification: 138 client tests and 8 controlled-API Chromium UI checks passed; TypeScript and build passed. See tests.md Section 9; no database-backed browser E2E claim is made.

## Issue #50 implementation awaiting review

The user reported PR #55 merged. Current branch `feature/lab4-ticket-workflow` starts from staging `f8238e9`; implementation commit `ac9ff59e394cca428bb227f4dcda0516ffdacffb`. Publication and PR creation authorized; reviewer approval remains pending. Review resolution locking/gates, active owner races, atomic immutable transition events, metadata/legacy behavior, safe public history and actionable UI feedback. Verification: 343 backend, 149 client, 3 real-backend Chromium and 8 fixture Chromium checks passed; both typechecks/builds passed. See tests.md Section 10 and ticket-workflow.md. Dashboard and release verification remain pending.

## Issue #51 implementation awaiting review

PR #56 is confirmed merged into `lab4-staging` at `90c4c01f3e92f62c06759174647055ec92ae2b0c`. New branch `feature/lab4-dashboards` implements Issue #51 in commit `d98de9ef06bc78a8daaf748f223addd2d5cff2ad`; the user authorized pushing and PR creation. Reviewer approval remains pending. Review snapshot/count/window semantics, exact filtered destinations, own-assignee versus performer identity, role/password gates, URL state and protected stale-read handling. Verification: 373 backend, 173 client, 1 opt-in performance, 3 real dashboard browser, 3 real workflow regression and 8 fixture browser tests passed. One performance test is intentionally skipped in the default backend run and separately executed. See tests.md Section 11.

## PR #57 requested changes

PR: [#57](https://github.com/Maibokdaimhai/TokTickIT/pull/57). Feedback was supplied by the user in this chat; no separate GitHub reviewer identity or approval is inferred.

| Feedback | Local correction | Evidence | State |
|---|---|---|---|
| Failed dashboard refresh clears prior metrics/as-of; retain a stale snapshot with Retry while clearing authorization/session failures. | Keep the last successful scoped snapshot through ordinary failure/pending retry; success replaces it, 401/403 removes protected data. | Dashboard component tests, both-role controlled browser scenarios and stale mobile captures; tests.md Section 12. | Fixed in `06aa3e0`; publication authorized; review pending |
| Detail reload loses prior list filters/page before its Back button is used. | Store validated, user/role-scoped return context on that Detail history entry; restore after reload. | Both-role App tests, real Detail reload browser checks, context validation tests. | Fixed in `06aa3e0`; publication authorized; review pending |
| A routing test failed once in a parallel run and passed on rerun/one worker. | Removed a stale pre-remount mock-call wait; await a fresh session/view and deliberately defer session restoration. | Full parallel and single-worker suites each 191 passed; 10 consecutive routing-file runs each 12 passed. Exact reported failure not independently identified. | Timing hazard corrected in `06aa3e0`; publication authorized; review pending |

## PR #57 additional Action-save feedback

User follow-up: opening filtered Staff page 2, saving an Action, then reloading Detail and using Back still lost the list context because the actionId URL update replaced history state with null. Local correction preserves the existing state in the shared Action save handler. App/Actions integration and controlled-browser regressions reproduce the full sequence; both were red before and green after. Verification: 192 client tests, 5 controlled browser scenarios, client typecheck/build passed. See tests.md Section 13 and action-list-context.json. Correction committed as `414f3f18c62c2b1fc343758e151c6d4cea5f9bcb`; the user authorized pushing it to PR #57. Reviewer approval remains pending.

## Issue #52 local regression/evidence awaiting review

PR #57 merge was verified at `5d13a769f8444ae7757074f26b450a686e3f6393`. Branch `test/lab4-regression-and-evidence`, implementation commit `003787cc964dec10b74991de1f7b724dd96ab227`. Review expanded discovery and the explicit authenticated Lab 2 replacement inventory, fail-closed DB/upload cleanup, audited fixture retention, rendered contrast/labels/44px pagination and long-name layout fixes, keyboard table access, zoom-equivalent scope and reduced-motion configuration/CSS. Verification: 384 backend (one opt-in skipped), 1 separately passed performance test, 195 client, 38 real and 14 controlled browser cases. Rendered matrix: 65 successful scenarios. The final motion-only follow-up was verified after DB cleanup through controlled browsers/client checks; DB browsers were not rerun for that final CSS/options change. Source snapshots and limits are explicit in regression.json. Test DB/uploads were deleted only after user authorization; development data preserved. Publication/PR creation authorized by the user; reviewer approval remains pending; final-main/release remains Issue #53.
