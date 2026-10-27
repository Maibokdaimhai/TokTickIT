# Lab 4 Review Record - TokTickIT

Status: Changes requested on PR #46; follow-up-completion correction prepared for re-review. No approval is claimed.

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
| Sprint 4 engineering contract and test plan | [#46](https://github.com/Maibokdaimhai/TokTickIT/pull/46) | Kawi-HBLI | [Changes requested](https://github.com/Maibokdaimhai/TokTickIT/pull/46#pullrequestreview-5666239755): completed actions with outstanding follow-up cannot clear the resolution blocker under BR-06/07/12. | Added BR-23 dedicated follow-up completion, retained original work/note and immutable revisions, specified API/UI and completion metadata; added API-19/20 and extended UI-02/E2E-02 through successful Ticket resolution. Checks are contract checks only; feature tests remain Planned. | Re-review pending |

Append separate rows for each real review comment and resolution. Include final-main SHA and release approval only after they exist. The previously merged mobile fix is the base of this draft; retrieve its actual PR/review metadata when assembling final evidence rather than guessing a number.
