# Lab 3 REST API Specification - TokTickIT

Status: Draft. Base URL: `/api`. JSON is used except attachment upload/download.

## 1. Authentication Protocol

- Successful login sets `toktickit_session`, an opaque random token, in an `HttpOnly`, `SameSite=Lax`, path `/` cookie. Production also sets `Secure`.
- Generate tokens from 32 cryptographically random bytes encoded as base64url. The database stores only the SHA-256 digest and expiration time; the session has an eight-hour absolute lifetime without sliding renewal. Cookie Max-Age matches expiry, Domain is unset, and missing/expired/revoked sessions clear the cookie. Authentication responses and protected data use Cache-Control: no-store.
- Client requests use `credentials: "include"` and never read the token.
- Unsafe requests (`POST`, `PATCH`, `DELETE`) require an allowed `Origin`; credentialed CORS allows only `CLIENT_ORIGIN`.
- Normal protected endpoints reject missing/expired sessions with `401`. Users requiring a password change receive `403 PASSWORD_CHANGE_REQUIRED` outside the permitted authentication endpoints.
- Reject missing, null, or mismatched Origin on every unsafe route, including login and logout, with 403 ORIGIN_FORBIDDEN. Browser/test clients must send CLIENT_ORIGIN; no wildcard or suffix match. CORS preflights from that exact origin allow GET/POST/PATCH/DELETE and Content-Type without requiring login; origin filtering supplements session/role checks. Local client/server use the same hostname (localhost) so SameSite cookies work across ports.
- Reload the user's current role, isActive, and mustChangePassword on each request; inactive/revoked sessions return 401. Rotate tokens on login/password change, revoke all old sessions on password change/reset, and issue a replacement only for a successful self password change. A failed write must not leave a new session active.

## 2. Response and Error Conventions

Successful list responses contain an array plus `pagination` where pagination is required. Dates are ISO 8601 strings. Password hashes, session digests, login counters, and other secrets are never returned.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Enter a valid email address" }]
  }
}
```

| Status | Meaning |
|---:|---|
| 400 | Invalid syntax/query/state request |
| 401 | Authentication missing, invalid, or expired |
| 403 | Authenticated but role/action forbidden or password change required |
| 404 | Missing resource, including non-disclosing requester ownership failure |
| 409 | Duplicate email or concurrent/state conflict |
| 429 | Login attempt limit reached |
| 500 | Safe unexpected failure |

## 3. Authentication Endpoints

### `POST /auth/login`

Body: `{ "email": string, "password": string }`.

- `200`: `{ "user": SafeUser, "mustChangePassword": boolean }` and session cookie.
- `400`: invalid shape.
- `401`: generic `INVALID_CREDENTIALS` for unknown email or wrong password.
- `403`: ACCOUNT_INACTIVE only after valid password verification; otherwise 401 INVALID_CREDENTIALS. Message: "This account is inactive. Contact your administrator."
- `429`: LOGIN_THROTTLED with integer Retry-After seconds; identical identifier-based behavior for existing/nonexistent emails as BR-08 specifies.

### `POST /auth/logout`

Revokes the current session and clears the cookie. Returns `204`; repeated logout is safe.

### `GET /auth/me`

Returns `{ "user": SafeUser, "mustChangePassword": boolean }` or `401`.

### `POST /auth/change-password`

Body: `{ "currentPassword": string, "newPassword": string, "confirmPassword": string }`.

Validates the current password and password policy, rejects reuse of the current password, clears `mustChangePassword`, revokes other sessions, rotates the current session, and returns `200` with AuthResult. An incorrect current password returns 400 CURRENT_PASSWORD_INVALID with field feedback; invalid new/confirmation values return 400 VALIDATION_ERROR. Failures leave the existing password and sessions unchanged.

## 4. Requester Ticket Compatibility API

Existing ticket route paths are preserved, with ownership derived from req.auth.userId. requesterId is removed from the final client requests; a legacy supplied value is ignored by the backend for the whole Lab 3 increment and can never select an identity. GET /api/requesters is removed (404). GET /api/health remains public and returns the existing Lab 1 shape.

- `GET /categories`
- `GET /related-systems`
- `POST /tickets`
- `GET /tickets`
- `GET /tickets/:id`
- `POST /tickets/:id/attachments`
- `GET /tickets/:id/attachments/:attachmentId`
- `GET /tickets/:id/attachments/:attachmentId/metadata`
- `POST /tickets/:id/attachments/:attachmentId/remove`
- `DELETE /tickets/:id` only for the existing creation-compensation flow

Requester ticket routes require `REQUESTER` unless an endpoint below explicitly supports operational roles. Access to another Requester's protected resource returns non-disclosing `404`.

The two read-only attachment routes are also available to `IT_STAFF` and `ADMINISTRATOR`:

- `GET /tickets/:id/attachments/:attachmentId` streams an active attachment when the actor is the owning Requester, IT Staff, or Administrator. Soft-removed attachments remain non-downloadable for every role.
- `GET /tickets/:id/attachments/:attachmentId/metadata` returns active or soft-removed attachment metadata to the owning Requester, IT Staff, or Administrator. It never returns the server filesystem path.

Requester upload, soft-removal, and compensation routes retain Requester ownership enforcement unless a later explicitly documented staff operation requires otherwise. Attachment lookup must match both `ticketId` and `attachmentId` and must not expose unrelated resources.

### `POST /tickets/:id/problem-appears-resolved`

Requester owner only. Body: `{ "expectedVersion": number, "comment"?: string }`. BR-17 defines permitted statuses and repeat rejection. Records backend user/time and optionally creates a validated Public Comment atomically, increments version, and returns 200 `{ "ticket": TicketDetail }` without Internal Notes. Whitespace-only supplied comments return 400; omitted comment adds no comment. Stale, repeated, and terminal-status indications return 409.

## 5. IT Staff Queue and Ticket Operations

These endpoints permit `IT_STAFF` and `ADMINISTRATOR` according to the proposed specification matrix, pending peer approval.

### `GET /staff/tickets`

Query parameters:

- `search`: ticket number or summary, case-insensitive, trimmed, maximum 150 characters.
- `category`, `requestedPriority`, `itPriority`, `status`: optional exact filters.
- `owner`: positive user ID, `unassigned`, or `me`.
- `sort`: `updatedAt_desc` (default), `createdAt_desc`, `createdAt_asc`, `ticketNumber_asc`, `ticketNumber_desc`, `itPriority_desc`.
- `page`: positive integer, default 1.
- `limit`: 10, 20, or 50; default 10.

Returns queue rows with ticket number, created/updated dates, summary, category, requested/IT priorities, status, owner, and attachment/comment counts plus pagination metadata.

Filters combine with AND; search uses OR across its two fields. Reject arrays, unknown query keys, malformed IDs/enums, and unsupported sort/limit with 400. Empty optional strings mean no filter. Valid but nonexistent category/owner filters yield an empty result. IT Priority sorts URGENT → HIGH → MEDIUM → LOW, then updatedAt descending, then id ascending. Other sorts use id ascending as a stable tie-breaker. page beyond the last page returns an empty list retaining the requested page; totalPages is 0 when totalItems is 0.

### `GET /staff/eligible-owners`

Returns the reassignment choices available to the authenticated IT Staff or Administrator. The response contains only active users whose role is `IT_STAFF` or `ADMINISTRATOR`, sorted by normalized name and then ID:

```json
{
  "owners": [
    { "id": 7, "name": "Michael Brown", "email": "michael.brown@example.com", "role": "IT_STAFF" }
  ]
}
```

Inactive users and Requesters are excluded. The endpoint returns safe identity fields only and is not a substitute for the Administrator-only `/admin/users` endpoint. The owner-update endpoint independently revalidates role and active state inside its transaction, so a stale client option cannot assign an ineligible owner.

### `GET /staff/tickets/:id`

Returns complete ticket data, requester safe profile, owner, attachment metadata with authorized download URLs, Public Comments, and Internal Notes. It never exposes attachment filesystem paths.

### `PATCH /staff/tickets/:id/owner`

Body: `{ "ownerId": number | null, "expectedVersion": number }`. null unassigns; explicit assignment/reassignment sets the supplied eligible owner without implicitly changing status. Invalid/inactive owner returns 400 INVALID_OWNER; stale version returns 409. The service locks/revalidates the target User and ticket during assignment, coordinated with admin deactivation/role changes. Returns 200 `{ "ticket": StaffTicketDetail }`.

### `POST /staff/tickets/:id/claim`

Body: `{ "expectedVersion": number }`. Sets owner to the authenticated user only when currently unassigned; if NEW, sets OPEN in the same transaction. Already assigned or stale tickets return 409. Returns 200 `{ "ticket": StaffTicketDetail }`. This distinct operation makes claim behavior unambiguous and prevents two users from claiming the same ticket.

### `PATCH /staff/tickets/:id/it-priority`

Body: `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" | "URGENT", "expectedVersion": number }`. Returns 200 `{ "ticket": StaffTicketDetail }`, 400 invalid priority, or 409 stale version. Requested Priority cannot be edited.

### `PATCH /staff/tickets/:id/status`

Body: `{ "status": TicketStatus, "expectedStatus": TicketStatus, "expectedVersion": number, "confirmed"?: boolean }`. Enforces the transition/owner rules, requires confirmed=true for RESOLVED/CLOSED/CANCELLED/REOPENED destinations, and returns 200 `{ "ticket": StaffTicketDetail }`. Invalid/no-op transitions or missing confirmations return 400; stale version/status returns 409. Increment version atomically and clear the current requester indication on reopening.

## 6. Public Comments and Internal Notes

### `GET /tickets/:id/public-comments`

Available to the owning Requester, IT Staff, and Administrators. Returns ascending append order with safe author name/role and backend timestamp.

### `POST /tickets/:id/public-comments`

Body: `{ "content": string }`; content is trimmed and must contain 1-2000 Unicode code points. Author and time come from the backend. Appends increment ticket version/updatedAt transactionally without requiring expectedVersion, as BR-29 defines.

### `GET /staff/tickets/:id/internal-notes`

IT Staff and Administrator only. Requesters receive a non-disclosing forbidden response with no note data.

### `POST /staff/tickets/:id/internal-notes`

IT Staff and Administrator only. Body and validation match Public Comments. Notes are append-only.

## 7. Administrator User API

All endpoints require `ADMINISTRATOR`.

### `GET /admin/users`

Optional `search` matches normalized name or email; optional `role` is one valid role. Returns safe fields: `id`, `name`, `email`, `role`, `isActive`, `mustChangePassword`, `createdAt`, and `updatedAt`. Pagination is not required.

Response: 200 `{ "users": AdminUser[] }`, sorted case-insensitively by name then id. search is trimmed, case-insensitive, at most 150 characters; role and search combine with AND. Empty results return users: []. Unknown/array/invalid query values return 400. No pagination, sorting UI, or additional profile management is introduced.

### `POST /admin/users`

Body:

```json
{
  "name": "Alex Thompson",
  "email": "alex.thompson@example.com",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "Local-only1!"
}
```

Requires all five fields shown above and returns 201 `{ "user": AdminUser }` with mustChangePassword=true. Name/email/password limits follow BR-07/27. Duplicate normalized email returns 409 DUPLICATE_EMAIL. The initial password is never echoed; the local administrator communicates it directly to the intended lab user.

### `PATCH /admin/users/:id`

Body may contain `name`, `email`, `role`, and `isActive`. Unknown fields are rejected. The transaction prevents self-deactivation and removal/deactivation of the last active Administrator.

Returns 200 `{ "user": AdminUser }`; 400 invalid/empty body; 404 missing target; 409 DUPLICATE_EMAIL, SELF_DEACTIVATION, or LAST_ACTIVE_ADMIN. Serialize all administrator-count-changing transactions using a shared PostgreSQL advisory transaction lock and recheck the count under the lock. Deactivation or role change revokes sessions; ineligible owners are unassigned atomically per BR-14. Self-demotion is allowed only if another active Administrator remains, and immediately logs out the caller. Historic submissions/comments/notes remain unchanged.

### `POST /admin/users/:id/initial-password`

Body: `{ "initialPassword": string, "confirmPassword": string }`. Sets a new hash, sets `mustChangePassword=true`, revokes all target-user sessions, and returns `204`.

User deletion endpoints do not exist.

## 8. Safe User Shape

```json
{
  "id": 1,
  "name": "Jennifer Anderson",
  "email": "jennifer.anderson@example.com",
  "role": "REQUESTER",
  "isActive": true
}
```

## 9. Validation and Logging

- Positive IDs use strict integer validation.
- Bodies reject invalid enum values and unexpected security-sensitive fields.
- Server logs may record request IDs, status, endpoint, actor ID, and safe error code; never passwords, cookies, token digests, comment/note content, or attachment contents.
- Unexpected Prisma/filesystem errors map to safe `500` responses while retaining server-side diagnostic context.

## 10. Shared Shapes and Endpoint Details

The following TypeScript notation defines JSON contracts (dates serialize to ISO strings). Type names are specification notation, not implemented code.

```ts
type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" |
  "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
type Ref = { id: number; name: string };
type SafeUser = { id: number; name: string; email: string; role: Role; isActive: boolean };
type AdminUser = SafeUser & { mustChangePassword: boolean; createdAt: string; updatedAt: string };
type AuthResult = { user: SafeUser; mustChangePassword: boolean };
type Owner = { id: number; name: string; email: string; role: "IT_STAFF" | "ADMINISTRATOR" };
type Pagination = { page: number; limit: number; totalItems: number; totalPages: number };
type AttachmentMetadata = {
  id: number; ticketId: number; fileName: string; originalName: string;
  mimeType: string; fileSize: number; isRemoved: boolean;
  removalReason: string | null; removedAt: string | null; createdAt: string;
  downloadUrl: string | null;
};
type Entry = {
  id: number; ticketId: number; content: string; createdAt: string;
  author: { id: number; name: string; role: Role };
};
type TicketRow = {
  id: number; ticketNumber: string; summary: string; category: Ref; relatedSystem: Ref;
  requestedPriority: Priority; itPriority: Priority; status: TicketStatus; owner: Owner | null;
  createdAt: string; updatedAt: string; version: number; attachmentCount: number;
  publicCommentCount: number;
};
type TicketDetail = TicketRow & {
  requesterId: number; requester: SafeUser; categoryId: number; relatedSystemId: number;
  description: string; attachments: AttachmentMetadata[]; publicComments: Entry[];
  problemAppearsResolvedAt: string | null; problemAppearsResolvedById: number | null;
};
type StaffTicketDetail = TicketDetail & { internalNotes: Entry[] };
```

Requester responses never contain internalNotes or Internal Note counts. Entry.author.role reflects the author's current role; no role-history model is added. Ticket rows sort consistently, and list endpoints return `{ tickets: TicketRow[], pagination: Pagination }`. Staff detail GET returns a StaffTicketDetail directly; requester detail GET returns a TicketDetail directly. Staff claim/owner/priority/status and requester resolution-indication responses use the `{ ticket: ... }` wrapper with their role-appropriate detail shape. New communication GETs return `{ comments: Entry[] }` or `{ notes: Entry[] }`, ordered by createdAt ascending then id; POSTs return 201 `{ comment: Entry }` or `{ note: Entry }`. Auth login/me/change-password all return AuthResult. No content-edit/delete endpoints exist; unsupported methods return safe 404.

| Retained endpoint | Contract in Lab 3 |
|---|---|
| GET /health | Public; 200 `{ status: "ok", service: "TokTickIT API" }`; liveness only, no secret/DB diagnostics |
| GET /categories, /related-systems | Full active session of any role; 200 Ref[] for active records ordered by id |
| POST /tickets | Requester; required categoryId/relatedSystemId, summary, description, requestedPriority; reject inactive references; 201 TicketDetail with session requester, NEW status, null owner, copied IT Priority and generated annual ticket number |
| GET /tickets | Requester; existing Lab 2 search/category/priority/status/sort/page/limit names; priority means Requested Priority; default createdAt_desc/page 1/limit 10, limit 1-50; existing four sort modes; expanded status enum; same filter/tie/empty-page validation principles as queue |
| GET /tickets/:id | Requester owner; 200 TicketDetail; no notes |
| POST /tickets/:id/attachments | Requester owner; multipart single file field, legacy requesterId ignored; 201 AttachmentMetadata; 400 invalid type/size/count; atomically enforce maximum five active files; remove partial files on failure |
| GET /tickets/:id/attachments/:attachmentId | Owning Requester or Staff/Admin; 200 file stream with MIME and Unicode-safe Content-Disposition inline; 403 ATTACHMENT_REMOVED for authorized actors, 404 absent/mismatched/missing storage; validate access before removal/file checks |
| GET .../:attachmentId/metadata | Same read roles; 200 AttachmentMetadata even when removed; no filePath; downloadUrl null when removed |
| POST .../:attachmentId/remove | Requester owner; JSON removalReason; 200 full AttachmentMetadata with backend time, 400 invalid/repeated removal; preserve disk file and audit metadata |
| DELETE /tickets/:id | Requester owner; 200 `{ status: "ok", message: "Draft ticket rolled back successfully" }`; only BR-30 eligibility; 409 when staff work exists; failure must identify recoverable retained ticket without exposing storage paths |

Download URLs are relative `/api/tickets/:id/attachments/:attachmentId`, contain no credentials or requester IDs, and rely on the cookie. The client resolves them against the API origin, including development port 3000. User-facing safe metadata never exposes seed keys or storage paths.

All protected endpoints apply session → password-change gate → role → ownership/resource validation, with Origin validation before unsafe work. Invalid IDs return 400 after role checks; inaccessible Requester resources return the same 404 body as absent resources. Staff-only note/queue/owner routes return 403 to Requesters before querying the resource. Every route may return safe 500; never serialize raw exceptions. Version values are nonnegative integers. Password fields use BR-07, email/name BR-27, and note/comment BR-28. JSON body limit is 64 KiB; oversize JSON returns 413 with the standard error envelope. Safe errors include an error code and message, with field details only for validation. Any unlisted path returns 404.
