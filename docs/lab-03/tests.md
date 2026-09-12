# Lab 3 Test Plan and Traceability - TokTickIT

Status: Planned before implementation. Final results must be updated only from the final `main` branch.

## 1. Strategy

- Unit tests cover password/session helpers, validation, authorization, and status-transition decisions.
- API/integration tests cover database behavior, authentication, authorization, ownership, transactions, and safe errors.
- Component tests cover user interactions, role navigation, feedback, and responsive rendering rules.
- Migration/regression tests prove existing Lab 2 data and behavior remain valid.
- Playwright E2E tests cover complete authentication, staff, administration, and requester journeys.
- Visual inspection records desktop, tablet, and mobile evidence for every major screen.

## 2. Planned Automated Tests

| ID | Type | AC | Scenario and expected result | Planned file | Status |
|---|---|---|---|---|---|
| API-01 | API | AC-01, AC-02 | Valid login succeeds; wrong password and unknown email share a safe response | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | AC-03 | Inactive account cannot authenticate | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | AC-04 | Initial-password session is restricted until valid password change | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | AC-05 | Logout revokes cookie access; expired/revoked session is unauthorized | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | AC-22 | Role middleware rejects direct cross-role API access | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-06 | API | AC-07 | Requester identity comes from session; supplied foreign requester ID cannot cross ownership | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-07 | API | AC-09 | Staff queue search/filter/sort/pagination and invalid query behavior | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-08 | API | AC-10 | Claim/reassign accepts eligible owners and rejects invalid, inactive, and stale updates | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-09 | API | AC-11 | IT Priority initializes correctly and only permitted roles can update it | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-10 | API | AC-12 | Status transition matrix permits valid and rejects invalid/stale transitions | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API | AC-13 | Public Comment validates content and records backend author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-12 | API | AC-14 | Requester Internal Note requests return forbidden with no note data | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-13 | API | AC-15 | Requester resolution indication is audited without formal status change | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-14 | API | AC-16, AC-17 | Administrator list/search/filter/create/edit and duplicate/invalid input | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-15 | API | AC-18 | Initial-password reset revokes sessions and forces next-login change | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-16 | API | AC-19 | Self-deactivation and final-active-administrator removal are blocked transactionally | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| UI-01 | Component | AC-01, AC-02, AC-03 | Login validation, busy state, safe errors, success routing | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | Component | AC-04 | Mandatory Change Password validation, checklist, busy/error/success | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | Component | AC-05, AC-06 | Role navigation and logout remove protected access | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| UI-04 | Component | AC-09, AC-20 | Queue results, queries, pagination, empty/no-results/failure, mobile cards | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-05 | Component | AC-10, AC-11, AC-12 | Claim/reassign, priority/status controls, confirmation and conflict feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-06 | Component | AC-13, AC-14 | Public/private visual distinction, validation, and role restrictions | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | Component | AC-16-AC-19 | User list/search/filter/create/edit/reset and safety feedback | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-08 | Component | AC-07, AC-15 | Authenticated requester detail comments and resolution indication | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| MIG-01 | Integration | AC-21 | Migration preserves ticket/attachment counts and requester ownership | `server/tests/lab-03/migration-regression.test.ts` | Planned |
| REG-01 | Regression | AC-08 | Complete Lab 1/Lab 2 server and client suites remain green | Existing `server/tests/lab-01..02` and `client/tests/lab-01..02` | Planned |
| E2E-01 | E2E | AC-01-AC-06 | Login, initial-password change, role shell, logout, blocked direct access | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-09-AC-15 | Staff queue/detail, assignment, priority/status, comments/notes, requester indication | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-16-AC-19 | Administrator creates/edits/deactivates/resets and safety rules hold | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-04 | E2E | AC-07, AC-08 | Authenticated requester completes Lab 2 creation/list/detail/attachment journey | `e2e/lab-03/requester-regression.spec.ts` | Planned |

## 3. Security Boundaries

Tests must include missing, malformed, expired, and revoked cookies; password-change-restricted sessions; cross-role calls; cross-requester ticket and attachment access; forbidden Internal Notes; forged requester IDs; invalid Origin on unsafe requests; login throttling; duplicate email races; and session revocation after deactivation/password reset.

Tests must assert that responses never include password hashes, raw session values, Internal Note content for Requesters, or another Requester's protected data.

## 4. Password Boundaries

Cover 9/10/72/73-character passwords, each missing character class, confirmation mismatch, incorrect current password, reuse, whitespace handling, initial-password enforcement, and successful session rotation.

## 5. Migration and Regression Evidence

Before migration, record counts and stable identifiers for users/requesters, tickets, attachments, and ticket ownership. After migration, assert:

- Every legacy Requester maps to one `REQUESTER` User.
- Every ticket maps to the same logical requester.
- Ticket and attachment counts and ticket numbers are unchanged.
- IT Priority equals Requested Priority for migrated tickets.
- Seed reruns do not create duplicates.
- Existing attachment files and soft-removal metadata remain accessible under authenticated ownership rules.

## 6. Responsive, Accessibility, and Visual Matrix

Inspect Login, Change Password, Requester Detail, Staff Queue, Staff Detail, and User Management at representative desktop (1440x900), tablet (820x1180), and mobile (390x844) viewports.

Verify keyboard order, visible focus, labels/descriptions, modal focus and Escape behavior, status conveyed by text, 44px touch targets, adjacent validation, readable tables/cards, and absence of clipping, overlap, or horizontal overflow.

## 7. Baseline and Final Commands

```bash
cd server && npm test
cd server && npm run build
cd client && npm test
cd client && npm run build
npm run test:e2e
```

Sprint-start baseline on 2026-09-12:

- Client: 6 files and 29 tests passed.
- Client production build: passed.
- Server TypeScript build: passed.
- Server tests: environment-blocked because PostgreSQL was not running and the restricted runner denied local socket listening; no passing claim is made. Re-run with PostgreSQL and normal local networking before implementation.

Final results, timestamps, commit SHA, and exact pass counts must be recorded here only after execution from final `main`.

## 8. Acceptance-Criterion Traceability

Every AC in `specification.md` is mapped above. A PR cannot mark an AC complete until its mapped automated test passes and any required responsive/visual evidence is captured. Failures remain visible in this document until corrected; planned tests are never retroactively invented from implementation.
