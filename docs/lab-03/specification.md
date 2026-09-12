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
- **FR-09:** IT Staff can open any queue ticket, claim it, or reassign it to an eligible active owner.
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
- **BR-03:** Requester ownership comes exclusively from the authenticated session; client-supplied requester IDs are ignored during compatibility migration and then removed from the API.
- **BR-04:** Public Comments are visible to the owning Requester, IT Staff, and Administrators. Internal Notes are visible only to IT Staff and Administrators.
- **BR-05:** A Requester may indicate that a problem appears resolved but cannot set `RESOLVED` or `CLOSED` directly.
- **BR-06:** Emails are trimmed and lower-cased for lookup and uniqueness. Login failure uses one generic message for unknown email or invalid password.
- **BR-07:** Passwords are hashed with bcrypt cost 12 and never returned, logged, or stored in plaintext. Passwords must contain 10-72 characters, including at least one uppercase letter, lowercase letter, digit, and symbol.
- **BR-08:** Five consecutive failed logins within 15 minutes lock login attempts for that account for 15 minutes. A successful login resets the counters. Responses remain generic.
- **BR-09:** Authentication uses a cryptographically random opaque session token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only a SHA-256 token digest is stored server-side. Sessions expire after eight hours.
- **BR-10:** Logout revokes the current server-side session and clears the cookie. Password changes and administrator password resets revoke all sessions for that user.
- **BR-11:** Unsafe cookie-authenticated requests require an allowed `Origin` header. CORS permits only the configured client origin with credentials.
- **BR-12:** Inactive users cannot log in; deactivation revokes all of their sessions.
- **BR-13:** Every user has exactly one valid role.
- **BR-14:** A ticket has exactly one submitting Requester and zero or one primary owner. An owner must be an active IT Staff or Administrator.
- **BR-15:** IT Priority initially copies Requested Priority. Requested Priority remains immutable; IT Priority may be changed only by IT Staff or Administrators.
- **BR-16:** Public Comments and Internal Notes are append-only, server-authored, server-timestamped, safely rendered as text, and contain 1-2000 trimmed characters.
- **BR-17:** A Problem Appears Resolved indication records requester identity and backend time without formally changing the ticket to `RESOLVED` or `CLOSED`; it is cleared when the ticket is reopened.
- **BR-18:** Existing Lab 2 attachment limits, MIME validation, file-size validation, soft removal, audit reason, and compensation cleanup remain effective.
- **BR-19:** Administrator email changes cannot create a duplicate normalized email.
- **BR-20:** Administrators cannot deactivate their own account.
- **BR-21:** The final active Administrator cannot be deactivated or changed to another role.
- **BR-22:** Users are deactivated rather than deleted.
- **BR-23:** Setting an initial password sets `mustChangePassword=true` and revokes existing sessions.
- **BR-24:** Assignment, priority, status, comment, note, activation, and password-reset operations validate current state inside a database transaction where concurrent changes could violate a rule.
- **BR-25:** Forbidden requester lookups return a non-disclosing not-found response when revealing resource existence would leak another requester's data.

### Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Manage own tickets/attachments | Yes | No | No |
| Read shared staff queue and any ticket | No | Yes | Yes |
| Claim/reassign, set IT Priority/status | No | Yes | Yes |
| Read/post Public Comments | Own tickets | Yes | Yes |
| Read/post Internal Notes | No | Yes | Yes |
| Indicate problem appears resolved | Own tickets | No | No |
| Manage users | No | No | Yes |

Administrators are permitted to perform ticket operations by this approved matrix because the required data model allows Administrator ticket owners. Their primary navigation remains User Management; ticket-operation links are secondary to preserve conceptual separation.

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

Claiming an unassigned `NEW` ticket automatically sets it to `OPEN`. Reassignment alone does not change status. Status updates use the current status as a concurrency precondition and return `409 CONFLICT` if it changed meanwhile.

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

- `User`: `id`, `name`, normalized unique `email`, `passwordHash`, `role`, `isActive`, `mustChangePassword`, failed-login counters/timestamps, created/updated timestamps.
- `Session`: token digest, `userId`, expiration and creation timestamps; cascade-delete with User.
- `Ticket`: requester relation migrated to `User`; nullable `ownerId`; non-null `itPriority`; expanded status; requester-resolution indication fields.
- `PublicComment`: ticket, author, content, created timestamp.
- `InternalNote`: ticket, author, content, created timestamp.

Indexes cover normalized email, session token digest/expiry, ticket requester/owner/status/priority/update time, and comment/note ticket plus creation time.

### Migration strategy

1. Add `UserRole`, expanded status values, `User`, `Session`, comment/note tables, and nullable Lab 3 ticket fields.
2. Copy each `RequesterUser` into `User` while preserving a deterministic old-to-new ID mapping and assigning `REQUESTER`.
3. Backfill every ticket's new requester foreign key through that mapping and copy Requested Priority into IT Priority.
4. Validate that ticket and attachment counts and ownership mappings match before adding non-null constraints.
5. Seed documented local-only initial credentials and `mustChangePassword=true`.
6. Remove the legacy requester selector endpoint/state after regression tests pass; retain/drop the legacy table only in a later migration after verification.

No migration resets the database or deletes existing Ticket or Attachment rows.

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

## 10. Product Definition of Done

- [ ] Specification, API specification, UI specification, and test plan were approved before main implementation PRs completed.
- [ ] All schema changes use reviewed forward migrations with documented rollback/recovery considerations.
- [ ] No existing Ticket or Attachment data is discarded and migration assertions pass.
- [ ] Passwords and raw session tokens never appear in source, logs, responses, or database plaintext.
- [ ] Every protected endpoint has authentication, authorization, validation, and safe-error tests.
- [ ] All Lab 2 and Lab 3 server/client tests and production builds pass from final `main`.
- [ ] Authentication, staff workflow, administration, and requester regression E2E suites pass from final `main`.
- [ ] Major screens have readable desktop, tablet, and mobile screenshot evidence.
- [ ] All acceptance criteria map to passing planned tests in `tests.md`.
- [ ] GitHub Issues are Done; feature PRs were peer-reviewed into `lab3-staging`; final integration PR was reviewed into `main`.
- [ ] README, reviewer record, AI-use reflection, and the nine-part submission PDF are complete with working links.

## 11. Assumptions and Decisions

- Opaque database-backed sessions are preferred over JWTs because logout, deactivation, and password reset require immediate revocation.
- bcrypt cost 12 is appropriate for this course stack; the work factor will be performance-tested locally.
- Login rate limiting is account-scoped for Lab 3; infrastructure-wide abuse protection is a deployment concern.
- Administrator ticket access is explicitly permitted by the matrix to satisfy Administrator ownership and Internal Note requirements.
- Problem Appears Resolved is a separately audited indication, not a direct status transition.
- Backend architecture will be incrementally separated into routes, controllers, services, middleware, and validators while Prisma remains the data-access layer.
