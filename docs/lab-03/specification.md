# Lab 3 Sprint Engineering Specification - TokTickIT

Status: Draft for team and peer-review approval before implementation.

## 1. Sprint Goal

Deliver secure email-and-password authentication, server-enforced role authorization, an operational IT Staff ticket workflow, and minimalist Administrator user management while preserving every completed Lab 2 requester, ticket, and attachment capability and all existing data.

## 2. Stakeholder Request

Replace the development requester selector with authenticated users. Requesters continue managing only their own tickets. IT Staff receive a shared queue and controlled ticket operations. Administrators manage accounts. Authorization is enforced by the API, and every new screen extends the existing responsive Zen Green design.

## 3. Scope

### Included

- Login, logout, current-user retrieval, and mandatory first-login password change.
- Exactly one role per user: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- Backend authentication, role checks, ownership checks, and safe errors.
- Migration of `RequesterUser` into `User` without losing ticket or attachment data.
- Authenticated continuation of all Lab 2 requester workflows.
- IT Staff queue, ticket ownership, IT Priority, status workflow, Public Comments, and Internal Notes.
- Requester Public Comments and Problem Appears Resolved indication.
- Administrator user list, search, optional role filter, create/edit, activation, and initial-password reset.
- Unit, API/integration, component, security, migration/regression, responsive, and E2E evidence.

### Excluded

- Self-registration, email invitations or reset mail, MFA, SSO, social login, and production deployment.
- Multiple roles, user deletion, bulk operations, import/export, departments, profile photos, role history, and account-history screens.
- Actions Taken, SLA/escalation rules, notifications, dashboards/KPIs, and multi-tenancy.
- Editing or deleting comments or notes.

## 4. Functional Requirements

- **FR-01:** An active user can authenticate with a normalized email address and valid password.
- **FR-02:** A user authenticated with an initial password must change it before accessing normal application APIs or screens.
- **FR-03:** An authenticated user can retrieve their safe profile and can log out.
- **FR-04:** Navigation and screens reflect the authenticated user's role; the API independently authorizes every operation.
- **FR-05:** A Requester can create, list, search, filter, sort, paginate, and view only their own tickets using server-derived identity.
- **FR-06:** A Requester can use permitted attachment operations on only their own tickets.
- **FR-07:** A Requester can append Public Comments and indicate that the problem appears resolved.
- **FR-08:** IT Staff can retrieve a paginated shared queue with search, filters, and sorting.
- **FR-09:** IT Staff can retrieve the eligible active-owner list, open any queue ticket, claim it, or reassign it to an eligible active owner.
- **FR-10:** IT Staff can set IT Priority and execute only permitted status transitions.
- **FR-11:** Requesters and ticket-operating roles can append and retrieve Public Comments.
- **FR-12:** IT Staff and Administrators can append and retrieve Internal Notes; Requesters can never retrieve their content.
- **FR-13:** Administrators can list users, search by name/email, and optionally filter by role.
- **FR-14:** Administrators can create one-role users with an initial password.
- **FR-15:** Administrators can edit a user's name, email, role, and activation state.
- **FR-16:** Administrators can set a new initial password that forces a password change at next login.
- **FR-17:** All meaningful loading, validation, success, empty/no-results, forbidden, not-found, conflict, and safe-failure states are presented accessibly and responsively.

## 5. Business Rules

- **BR-01:** Only an active user with valid credentials may authenticate.
- **BR-02:** A user with `mustChangePassword=true` may access only authentication, logout, current-user, and change-password operations until a valid new password is saved.
- **BR-03:** Requester ownership comes exclusively from the authenticated session. Remove requesterId from final client requests; the backend ignores any legacy supplied value throughout Lab 3, never using it to select identity.
- **BR-04:** Public Comments are visible to the owning Requester, IT Staff, and Administrators. Internal Notes are visible only to IT Staff and Administrators.
- **BR-05:** A Requester may indicate that a problem appears resolved but cannot set `RESOLVED` or `CLOSED` directly.
- **BR-06:** Emails are trimmed and lower-cased for lookup and uniqueness. Login failure uses one generic message for unknown email or invalid password.
- **BR-07:** Passwords are hashed with bcrypt cost 12 and a fresh salt and never returned, logged, or stored in plaintext. Require at least 10 Unicode code points and at most 72 UTF-8 bytes, including an ASCII uppercase letter, lowercase letter, digit, and non-whitespace symbol. Never trim, normalize, or silently truncate passwords; reject NUL. Confirmation must match exactly. A new password cannot equal the current password. Apply this policy to creation, initial-password reset, and self-service changes. The byte limit prevents bcrypt truncation; complexity is a course-level design choice, not a worksheet-mandated policy.
- **BR-08:** Five failed logins for a normalized email within a fixed 15-minute window throttle that identifier for 15 minutes, including nonexistent emails. Store only a digest of the identifier in a bounded, expiring throttle table. Reset counters on successful login or window expiry; do not extend lock expiry with every denied request. Throttling returns the same 429 body and Retry-After behavior for known and unknown identifiers; no account-unlocking UI is included. Use a dummy hash comparison for unknown accounts. Account-inactive feedback is returned only after password verification; otherwise the credential failure remains generic.
- **BR-09:** Authentication uses a cryptographically random opaque session token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only a SHA-256 token digest is stored server-side. Sessions expire after eight hours.
- **BR-10:** Logout revokes the current server-side session and clears the cookie. Password changes revoke all old sessions and issue one new session to the caller; administrator resets revoke all target-user sessions without issuing a replacement. Authentication middleware reads current active/role/password-change state on every request. Role changes revoke sessions too.
- **BR-11:** Unsafe cookie-authenticated requests require an allowed `Origin` header. CORS permits only the configured client origin with credentials.
- **BR-12:** Inactive users cannot log in; deactivation revokes all of their sessions.
- **BR-13:** Every user has exactly one valid role.
- **BR-14:** A ticket records exactly one submitting user (a Requester when submitted) and zero or one primary owner. An owner must be an active IT Staff or Administrator. Deactivation or a role change to Requester atomically unassigns the target user's owned tickets and increments their versions; it never deletes submissions or comments. Historical requester/author relationships remain valid after account role changes. Submitted tickets are accessible through requester routes only when the user currently has the Requester role.
- **BR-15:** IT Priority initially copies Requested Priority. Requested Priority remains immutable; IT Priority may be changed only by IT Staff or Administrators.
- **BR-16:** Public Comments and Internal Notes are append-only, server-authored, server-timestamped, safely rendered as text, and contain 1-2000 trimmed characters.
- **BR-17:** The owning Requester can indicate Problem Appears Resolved once per resolution cycle in NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, or REOPENED. It records requester identity and backend time without changing status. Repeated indications and indications on RESOLVED/CLOSED/CANCELLED return 409. Reopening clears the current indication. An optional comment is appended atomically; comments remain as history.
- **BR-18:** Existing Lab 2 attachment limits, MIME validation, file-size validation, soft removal, audit reason, and compensation cleanup remain effective.
- **BR-19:** Administrator email changes cannot create a duplicate normalized email.
- **BR-20:** Administrators cannot deactivate their own account.
- **BR-21:** The final active Administrator cannot be deactivated or changed to another role.
- **BR-22:** Users are deactivated rather than deleted.
- **BR-23:** Setting an initial password sets `mustChangePassword=true` and revokes existing sessions.
- **BR-24:** Assignment, priority, status, comment, note, activation, and password-reset operations validate current state inside a database transaction where concurrent changes could violate a rule.
- **BR-25:** Forbidden requester lookups return a non-disclosing not-found response when revealing resource existence would leak another requester's data.
- **BR-26:** The idempotent development seed contains at least four active and one inactive Requester, three active and one inactive IT Staff user, and one active Administrator. It also creates representative assigned and unassigned Tickets distributed across Requesters, statuses, Requested/IT Priorities, plus safe example Public Comments and Internal Notes.
- **BR-27:** Names contain 1-100 trimmed code points; emails have a valid email shape and at most 254 characters. IDs must be positive safe integers within PostgreSQL Int range. Boolean values must be JSON booleans. Reject empty PATCH bodies and unknown fields except the explicitly ignored legacy requesterId. Apply Lab 2 summary (5-150), description (10-3000), attachment (five active, 5 MiB each; JPEG/PNG/WebP/PDF), and removal-reason (minimum three trimmed characters) rules.
- **BR-28:** Comment/note length is 1-2000 trimmed Unicode code points, allowing useful incident detail while bounding storage/display. All roles may append permitted communication on all statuses. Escape content as text; do not execute HTML or Markdown. Editing/deletion APIs are absent. Backend author/time fields cannot be supplied by clients.
- **BR-29:** Claim, owner, priority, status, and resolution-indication mutations compare an integer version and increment it atomically. Comment/note appends and attachment changes increment the ticket version and updatedAt in their transaction but do not require a client version: independent appends must not overwrite each other. All ticket mutations coordinate on the ticket row, including compensation eligibility checks. Invalid transitions/no-op transitions return 400; stale versions and claim races return 409. Only the winning concurrent claim succeeds. Any eligible staff member may operate a ticket, regardless of its current owner. No Actions Taken prerequisite is added in Lab 3.
- **BR-30:** Initial-attachment compensation may delete only the caller's ticket while NEW, unassigned, and without comments, notes, or resolution indication. Otherwise return 409 and retain the ticket. This prevents a delayed rollback from deleting staff work. Storage cleanup failure is reported and recoverable; failed creation/upload preserves user form input and identifies any retained ticket.

### Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Manage own tickets/attachments | Yes | No | No |
| View/download attachments on accessible tickets | Own tickets | Yes | Yes |
| Read shared staff queue and any ticket | No | Yes | Yes |
| Claim/reassign, set IT Priority/status | No | Yes | Yes |
| Read/post Public Comments | Own tickets | Yes | Yes |
| Read/post Internal Notes | No | Yes | Yes |
| Indicate problem appears resolved | Own tickets | No | No |
| Manage users | No | No | Yes |
| Retrieve eligible owner choices | No | Yes | Yes |
| Read active categories/related systems | Yes | Yes | Yes |
| Current user, password change, logout | Yes | Yes | Yes |

Unauthenticated access is limited to health and login (plus idempotent logout). Password-change-restricted sessions may use only me/change-password/logout. All other endpoints require a full active session. Staff/Admin attachment access is read-only; upload/removal/rollback remain Requester-only. Internal Note role checks run before resource lookup. The proposal deliberately grants Administrator ticket permissions; it remains pending peer approval, not an already approved exception.

Administrators are proposed to have ticket permissions to support the allowed Administrator owner role. Their default destination is User Management, with a separate Ticket Queue navigation entry. This is a team design choice; the worksheet does not require every Administrator to act as IT Staff.

### Status Transition Matrix

| Current | Permitted next status | Permitted role | Confirmation |
|---|---|---|---|
| `NEW` | `OPEN`, `CANCELLED` | IT Staff, Administrator | Cancel requires confirmation |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Resolve/cancel requires confirmation |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Resolve/cancel requires confirmation |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Resolve/cancel requires confirmation |
| `RESOLVED` | `CLOSED`, `REOPENED` | IT Staff, Administrator | Both require confirmation |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Resolve/cancel requires confirmation |
| `CLOSED` | `REOPENED` | IT Staff, Administrator | Required |
| `CANCELLED` | `REOPENED` | IT Staff, Administrator | Required |

Claiming an unassigned NEW ticket sets it to OPEN atomically. Explicit reassignment alone does not change status. Staff claim/owner/priority/status mutations require expectedVersion; status requests additionally require expectedStatus. RESOLVED/CLOSED/CANCELLED/REOPENED destinations require confirmed=true as well as UI confirmation. Invalid or unchanged transitions return 400; a stale version/status returns 409. Entering IN_PROGRESS, WAITING_FOR_REQUESTER, or RESOLVED requires an eligible assigned owner. Unassignment remains allowed afterward so deactivated owners never retain assignment; reassign before the next transition requiring an owner.

## 6. UI Specification Summary

- Unauthenticated users see Login only; initial-password users see Change Password only.
- The authenticated shell displays name, role, password action, logout, and role-permitted navigation.
- Requester screens retain Lab 2 behavior without identity selection and add Public Comments and Problem Appears Resolved.
- Staff Queue uses a focused desktop table and stacked mobile cards; Staff Detail clearly separates editable operations from immutable request information.
- Public Comments use the normal green communication treatment; Internal Notes use a distinct amber/private treatment with explicit labels.
- User Management uses one responsive list-and-form screen without advanced administration features.
- See `docs/lab-03/ui-spec.md` for modes, controls, feedback, and breakpoints.

## 7. Data Changes

### Models and fields

- `User`: `id`, `name`, normalized unique `email`, `passwordHash`, `role`, `isActive`, `mustChangePassword`, created/updated timestamps.
- `Session`: token digest, `userId`, expiration and creation timestamps; cascade-delete with User.
- `LoginAttempt`: unique email digest, failure count, window start and lock-expiry timestamps, for known and unknown identifiers.
- `Ticket`: requester relation migrated to `User`; nullable `ownerId`; non-null `itPriority`; expanded status; integer `version`; requester-resolution indication fields.
- `PublicComment`: ticket, author, content, created timestamp.
- `InternalNote`: ticket, author, content, created timestamp.

Indexes cover normalized email, session token digest/expiry, ticket requester/owner/status/priority/update time, and comment/note ticket plus creation time.

| Model | Field types, defaults, and constraints |
|---|---|
| User | id Int primary key/autoincrement; name VarChar(100); email VarChar(254) unique after normalization; passwordHash VarChar(60); role UserRole; isActive Boolean default true; mustChangePassword Boolean default true; createdAt DateTime default now; updatedAt DateTime updated automatically; seedKey String nullable unique for stable fixture identity |
| Session | id Int primary key; tokenDigest Char(64) unique; userId Int FK; createdAt DateTime default now; expiresAt DateTime required; index userId and expiresAt |
| LoginAttempt | emailDigest Char(64) primary key; failureCount Int default 0; windowStartedAt DateTime; lockedUntil DateTime nullable; expiry indexes and cleanup of expired rows |
| Ticket additions | ownerId Int nullable FK; itPriority Priority required; version Int default 0; problemAppearsResolvedAt DateTime nullable; problemAppearsResolvedById Int nullable FK; indication fields both null or both set; seedKey String nullable unique |
| PublicComment / InternalNote | id Int primary key/autoincrement; ticketId Int FK; authorId Int FK; content Text validated to 2000 code points; createdAt DateTime default now; seedKey String nullable unique for deterministic fixtures; index (ticketId, createdAt, id) |

UserRole values are REQUESTER, IT_STAFF, ADMINISTRATOR. TicketStatus values are exactly those in the transition matrix; Priority stays LOW/MEDIUM/HIGH/URGENT. Ticket requester and author FKs restrict user deletion. Owner and indication-user relations preserve referential integrity; account deactivation does not delete users. Comments/notes restrict deletion of tickets containing them, consistent with BR-30; Attachment retains its existing cascade relation. Categories/Related Systems and their active flags remain intact. Legacy department values are retained in the archived requester table for migration recovery, with no new department-management UI.

### Migration strategy

1. Stop writes; back up PostgreSQL and server/uploads together, and record counts, ticket numbers, requester mapping, existing priorities, and file checksums. Rehearse on an isolated copy before touching the development database.
2. Preflight normalized email collisions; abort with an actionable report rather than merging people. Add new enums, tables, and nullable fields using forward Prisma migrations; keep historical migrations unchanged.
3. Copy each RequesterUser to User with the same id, name, normalized email, activation state, and timestamps; assign REQUESTER. Advance the User sequence beyond the highest migrated ID. Existing Ticket.requesterId values remain unchanged when its FK is retargeted to User.
4. Fill only null IT Priorities from Requested Priority; preserve any existing non-null IT Priority. Preserve existing statuses and ticket numbers, set ownerId=null and version=0, and leave indication fields null. Verify counts/mappings before adding required constraints.
5. Run an explicit local bootstrap command to supply missing password hashes for every migrated user from a local-only LAB3_INITIAL_PASSWORD, with mustChangePassword=true. No plaintext/default password is embedded in migration SQL. The service remains stopped until all hashes are populated; then enforce non-null passwordHash. Seed new staff/admin users afterward. Record the local credential handoff procedure in README: operator provides the initial credential directly for lab use; no email service.
6. Remove GET /api/requesters and the development selector. Delete the actual legacy localStorage key toktickit_selected_requester_id on startup. Preserve the archived RequesterUser table during Lab 3, inaccessible from the application; do not drop it as part of this sprint.

Migration failures roll back transactional steps and stop startup. Recovery restores the paired database/upload backup and the prior app version; never run migrate reset or drop existing data. Initial-password bootstrap is create-only: rerunning it cannot replace an established password. End-state verification checks no orphaned FKs, preserved files, no plaintext credentials, valid sequences, and successful forced-password-change login for a migrated active user. Inactive migrated users remain unable to log in.

No migration resets the database or deletes existing Ticket or Attachment rows.

### Required seed data

- At least four active Requester accounts and one inactive Requester account.
- At least three active IT Staff accounts and one inactive IT Staff account.
- At least one active Administrator account.
- Realistic Tickets spread across multiple Requesters, every required status, all priority values, and both assigned and unassigned ownership.
- Safe representative Public Comments authored by Requesters and operational roles.
- Safe representative Internal Notes authored by IT Staff or Administrators only.
- Documented local-development initial credentials with no real personal password or secret.

On a fresh lab database, use five fixture Requesters (four active), four fixture IT Staff (three active), and one active Administrator. Reuse the four existing active Lab 2 personas and one inactive persona where available. Create 24 tickets with stable fixture keys across the four active Requesters, three for each of the eight statuses, with all four Requested and IT Priorities, at least one differing Requested/IT Priority pair, and assigned plus unassigned examples. Create at least eight Public Comments and four Internal Notes across multiple tickets and authors. This volume supports default ten-row queue pagination. Use server/prisma/seed.ts, local-only env-supplied initial credentials, unique normalized fixture emails, and a nullable unique Ticket.seedKey so reruns identify the same tickets. Upsert fixture comments/notes by seedKey; never identify them by mutable summary or content alone.

Fixture coverage counts apply on a fresh/test database. Reruns in a used development database must preserve intentionally changed passwords, activation, roles, tickets, priorities, and communications, even when the original sample distribution has changed. Recreate pristine fixture coverage only in a disposable test database. Seed work is part of #27; ticket workflow fixtures needed by #29 must be available before that queue issue begins.

The seed uses stable unique keys and create-only upserts so repeated execution neither duplicates nor resets records. User fixtures are keyed by User.seedKey, not editable email: first-time adoption of a known legacy persona assigns its key without resetting its fields; subsequent runs use that key even after an email change. Unexpected email/key collisions abort with an actionable report, never merge people. Automated seed verification asserts minimum role/status/priority/ownership coverage, safe comment/note authorship and visibility prerequisites, password hashes rather than plaintext, and identical unique-record counts after a second seed run. These fixture counts are team-selected coverage beyond the worksheet's account minimums, not additional worksheet mandates.

## 8. API Contract Summary

The API uses JSON, credentialed cookies, consistent `{ error: { code, message, details? } }` errors, and server-derived identity. Exact endpoints and schemas are in `docs/lab-03/api-spec.md`.

## 9. Acceptance Criteria

- **AC-01:** Valid active credentials establish a session and return safe user identity and role.
- **AC-02:** Invalid credentials and unknown emails receive the same safe failure response.
- **AC-03:** Inactive accounts cannot authenticate.
- **AC-04:** Initial-password users cannot access normal application features until changing the password successfully.
- **AC-05:** Logout revokes access, including direct API access with the former cookie.
- **AC-06:** Navigation contains only destinations permitted for the authenticated role.
- **AC-07:** A Requester's ticket/attachment APIs derive identity from the session and never expose another Requester's resources.
- **AC-08:** All Lab 2 requester ticket and attachment regression tests pass after migration.
- **AC-09:** Staff Queue supports approved search, filters, sorting, pagination, and responsive result presentation.
- **AC-10:** Eligible staff can claim or reassign a ticket; invalid/inactive owners and concurrent conflicts are rejected.
- **AC-11:** Requested Priority is preserved while authorized users can update IT Priority.
- **AC-12:** Only transitions in the approved status matrix succeed.
- **AC-13:** Public Comments are appended with backend author/time and are visible to all permitted participants.
- **AC-14:** Requesters cannot retrieve or create Internal Notes; no note content leaks in the error.
- **AC-15:** Requesters can record Problem Appears Resolved without formally resolving or closing the ticket.
- **AC-16:** Administrators can list/search/filter, create, and edit one-role users.
- **AC-17:** Duplicate emails and invalid user data produce safe validation/conflict feedback.
- **AC-18:** Administrator initial-password reset revokes sessions and forces password change at next login.
- **AC-19:** Self-deactivation and removal/deactivation of the last active Administrator are prevented.
- **AC-20:** Major Lab 3 screens pass desktop, tablet, mobile, accessibility, and Zen Green visual checks.
- **AC-21:** Migration preserves existing tickets, attachments, requester ownership, and ticket numbering continuity.
- **AC-22:** Direct unauthorized API calls are rejected even when frontend controls are bypassed.
- **AC-23:** The idempotent seed satisfies all required account counts and representative Ticket, Public Comment, and Internal Note coverage without storing plaintext passwords.
- **AC-24:** IT Staff and Administrators can retrieve metadata and download active attachments for tickets they may access; Requester ownership and removed-attachment download restrictions remain enforced.
- **AC-25:** Password byte boundaries, session rotation/expiry, throttling, Origin checks, and role/deactivation revocation behave as specified without exposing secrets.
- **AC-26:** Deactivation or role change preserves historical records, unassigns ineligible owners, and remains safe during concurrent assignment and last-administrator changes.
- **AC-27:** The completed submission contains the nine required evidence parts, actual final-main results, peer review records, and an authentic AI-use reflection.

## 10. Product Definition of Done

- [ ] Specification, API specification, UI specification, and test plan were approved before main implementation PRs completed.
- [ ] All schema changes use reviewed forward migrations with documented rollback/recovery considerations.
- [ ] No existing Ticket or Attachment data is discarded and migration assertions pass.
- [ ] SEED-01 verifies exact minimum accounts, representative data, and reruns that preserve user changes.
- [ ] Real passwords, hashes, and raw session tokens never appear in source, logs, or JSON responses. Store only password hashes/token digests; transmit the session token only through the protected cookie mechanism. Example credentials are clearly non-production.
- [ ] Every protected endpoint has authentication, authorization, validation, and safe-error tests.
- [ ] All Lab 2 and Lab 3 server/client tests and production builds pass from final `main`.
- [ ] Authentication, staff workflow, administration, and requester regression E2E suites pass from final `main`.
- [ ] Major screens have readable desktop, tablet, and mobile screenshot evidence.
- [ ] All acceptance criteria map to passing planned tests in `tests.md`.
- [ ] GitHub Issues are Done; feature PRs were peer-reviewed into `lab3-staging`; final integration PR was reviewed into `main`.
- [ ] README, reviewer record, AI-use reflection, and the nine-part submission PDF are complete with working links.
- [ ] No implementation test/file, reviewer approval, issue completion, or screenshot is claimed before it exists. GitHub page actions and PR submission/merging are performed by the user.

## 11. Assumptions and Decisions

- Opaque database-backed sessions are preferred over JWTs because logout, deactivation, and password reset require immediate revocation.
- bcrypt cost 12 is appropriate for this course stack; the work factor will be performance-tested locally.
- Login throttling is normalized-identifier scoped (including unknown identities) for Lab 3; expired throttle rows are cleaned up.
- Administrator ticket access is explicitly permitted by the matrix to satisfy Administrator ownership and Internal Note requirements.
- Problem Appears Resolved is a separately audited indication, not a direct status transition.
- Backend architecture will be incrementally separated into routes, controllers, services, middleware, and validators while Prisma remains the data-access layer.

Security references: bcrypt's limit is 72 **bytes**, not characters ([bcrypt documentation](https://www.npmjs.com/package/bcrypt?activeTab=code)). Generic credential failures and timing precautions follow the [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). The worksheet's inactive-account feedback is shown only after valid password verification; password complexity, expiry, and throttle values above remain explicit lab design decisions.

## 12. Sprint Delivery Issue Map

| Issue | Scope | Planned branch |
|---|---|---|
| [#25](https://github.com/Maibokdaimhai/TokTickIT/issues/25) | Sprint 3 engineering contract and test plan | `feature/lab3-spec-and-tests` |
| [#26](https://github.com/Maibokdaimhai/TokTickIT/issues/26) | Behavior-preserving layered backend refactor | `refactor/lab3-backend-layers` |
| [#27](https://github.com/Maibokdaimhai/TokTickIT/issues/27) | User migration and secure authentication | `feature/lab3-authentication` |
| [#28](https://github.com/Maibokdaimhai/TokTickIT/issues/28) | Authenticated Requester ownership and role authorization | `feature/lab3-authorization-requester` |
| [#29](https://github.com/Maibokdaimhai/TokTickIT/issues/29) | IT Staff Ticket Queue | `feature/lab3-staff-queue` |
| [#30](https://github.com/Maibokdaimhai/TokTickIT/issues/30) | Staff ticket operations, comments, and Internal Notes | `feature/lab3-staff-ticket-operations` |
| [#31](https://github.com/Maibokdaimhai/TokTickIT/issues/31) | Minimalist Administrator user management | `feature/lab3-admin-users` |
| [#32](https://github.com/Maibokdaimhai/TokTickIT/issues/32) | E2E workflows and responsive screenshot evidence | `test/lab3-e2e-and-evidence` |
| [#33](https://github.com/Maibokdaimhai/TokTickIT/issues/33) | Final evidence and Sprint 3 release integration | `docs/lab3-final-documentation` |

Each feature branch starts from the latest reviewed `lab3-staging`. Its PR targets `lab3-staging`; only the final reviewed integration PR targets `main`.

Dependencies: #25 → #26 → #27 → #28 → #29 → #30; #31 follows #28; #32 follows #30 and #31; #33 follows #32. The schema and representative seed needed by the queue land in #27 (including owner, version, statuses, priorities, and communication tables); #30 implements operations against that schema. The #27/#28 changes are integrated as a coordinated authentication cutover: interim branches must not claim that all legacy APIs are secured until #28 completes.

Use the existing Kanban statuses; do not invent a new board workflow. Put the issue in progress during work, in the existing review status for peer review, and Done after its criteria and reviewed staging merge. Record red → green tests during implementation, review comments/responses/approval, and final main verification. User performs GitHub browser actions; agent prepares code, commits when authorized, and copy-ready PR descriptions. Draft contract changes do not count as peer approval.

## 13. Worksheet Coverage and Submission Evidence

| Worksheet sections | Contract/evidence location |
|---|---|
| 1-3 Increment, outcomes, stakeholder | Specification §§1-4; planned implementation tests |
| 4.1-4.4 Scope, roles, business rules | Specification §§3-5; API authorization inventory |
| 4.5 Ownership, priority, statuses | BR-14/15/29; transition matrix; API staff operations |
| 4.6 Comments and notes | BR-16/28; API §6; UI §§5/7 |
| 5.1-5.3 Models, migration, seed | Specification §7; MIG-01 and SEED-01 |
| 6.1-6.3 Authentication, safe errors, queries | API §§1-10; security and query tests |
| 7-8.7 Shell, screens, modes, accessibility | UI specification and style/responsive test matrix |
| 9-10 Spec DD, Test DD, TDD | Four planning files, AC mappings, red/green evidence |
| 11-13 Git workflow, files, DoD | Specification §§10/12; reviewer.md; ai-use.md |
| 14 Submission | Table below; final-main evidence in tests.md |

Submit exactly one concise PDF with working links and readable screenshots. The final main branch is the source of truth. The headings must be exactly Answer Part 1 through Answer Part 9, in this order:

| Heading | Points | Evidence required |
|---|---:|---|
| Answer Part 1 | 10 | Feature → lab3-staging → main history; all issues Done; rendered reviewer.md with identity, PR links, comments/responses/approvals; README/.gitignore; directory structure |
| Answer Part 2 | 5 | Linked/rendered specification, FR/BR/AC, authorization, migration, DoD; commit evidence of specification preceding main implementation PR completion |
| Answer Part 3 | 10 | Linked/rendered tests.md; planned tests, AC mapping, actual files/status; complete passing unit/API/UI/security/regression/E2E output from main |
| Answer Part 4 | 5 | Rendered ai-use.md naming the LLM, 6-10 actual selected prompts, and user's My Reflection on specification/coding-agent use |
| Answer Part 5 | 5 | Valid/invalid/inactive login, busy/failure feedback, mandatory password change, name/role, logout and blocked direct access |
| Answer Part 6 | 5 | Realistic queue, search/filters/sort/pagination, ownership, badges, detail, empty/no-results/failure and responsive views |
| Answer Part 7 | 10 | Claim/reassign, IT Priority/status, comments/notes, attachments, requester indication, validation/failures, direct API restrictions |
| Answer Part 8 | 5 | User list/search/filter/create/edit/reset, forced change, duplicate/input validation, self/last-admin protections, forbidden access and responsive failure feedback |
| Answer Part 9 | 5 | Rendered ui-spec.md; desktop/tablet/mobile major screens; completed focus/clipping/overlap/overflow/design checklist |

Total: 60 points. Submission evidence is collected progressively; final output/approval/reflection entries remain pending until performed.
