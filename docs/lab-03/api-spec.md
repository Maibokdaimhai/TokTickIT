# Lab 3 REST API Specification - TokTickIT

Status: Draft. Base URL: `/api`. JSON is used except attachment upload/download.

## 1. Authentication Protocol

- Successful login sets `toktickit_session`, an opaque random token, in an `HttpOnly`, `SameSite=Lax`, path `/` cookie. Production also sets `Secure`.
- The database stores only the SHA-256 digest and expiration time; the session lifetime is eight hours.
- Client requests use `credentials: "include"` and never read the token.
- Unsafe requests (`POST`, `PATCH`, `DELETE`) require an allowed `Origin`; credentialed CORS allows only `CLIENT_ORIGIN`.
- Normal protected endpoints reject missing/expired sessions with `401`. Users requiring a password change receive `403 PASSWORD_CHANGE_REQUIRED` outside the permitted authentication endpoints.

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
- `403`: `ACCOUNT_INACTIVE` with safe wording.
- `429`: temporary login-attempt lock.

### `POST /auth/logout`

Revokes the current session and clears the cookie. Returns `204`; repeated logout is safe.

### `GET /auth/me`

Returns `{ "user": SafeUser, "mustChangePassword": boolean }` or `401`.

### `POST /auth/change-password`

Body: `{ "currentPassword": string, "newPassword": string, "confirmPassword": string }`.

Validates the current password and password policy, rejects reuse of the current password, clears `mustChangePassword`, revokes other sessions, rotates the current session, and returns `200` with safe user data.

## 4. Requester Ticket Compatibility API

All existing Lab 2 routes remain initially available, but ownership is derived from `req.auth.userId`. A supplied `requesterId` is ignored during the migration window and removed from the final client calls.

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

### `POST /tickets/:id/problem-appears-resolved`

Requester owner only. Body may contain `{ "comment": string? }`. Records backend user/time and optionally creates a Public Comment atomically. Returns the indication and current ticket status; it never sets `RESOLVED` or `CLOSED`.

## 5. IT Staff Queue and Ticket Operations

These endpoints permit `IT_STAFF` and `ADMINISTRATOR` according to the approved matrix.

### `GET /staff/tickets`

Query parameters:

- `search`: ticket number or summary, case-insensitive, trimmed.
- `category`, `requestedPriority`, `itPriority`, `status`: optional exact filters.
- `owner`: positive user ID, `unassigned`, or `me`.
- `sort`: `updatedAt_desc` (default), `createdAt_desc`, `createdAt_asc`, `ticketNumber_asc`, `ticketNumber_desc`, `itPriority_desc`.
- `page`: positive integer, default 1.
- `limit`: 10, 20, or 50; default 10.

Returns queue rows with ticket number, created/updated dates, summary, category, requested/IT priorities, status, owner, and attachment/comment counts plus pagination metadata.

### `GET /staff/tickets/:id`

Returns complete ticket data, requester safe profile, owner, attachments, Public Comments, and Internal Notes.

### `PATCH /staff/tickets/:id/owner`

Body: `{ "ownerId": number | null, "expectedUpdatedAt": string }`. `ownerId=null` unassigns; claim uses the authenticated user's ID. Owner must be active IT Staff or Administrator. Returns `409` when the ticket changed concurrently.

### `PATCH /staff/tickets/:id/it-priority`

Body: `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" | "URGENT", "expectedUpdatedAt": string }`.

### `PATCH /staff/tickets/:id/status`

Body: `{ "status": TicketStatus, "expectedStatus": TicketStatus }`. Enforces the specification transition matrix and returns `409` on stale state.

## 6. Public Comments and Internal Notes

### `GET /tickets/:id/public-comments`

Available to the owning Requester, IT Staff, and Administrators. Returns ascending append order with safe author name/role and backend timestamp.

### `POST /tickets/:id/public-comments`

Body: `{ "content": string }`; content is trimmed and must contain 1-2000 characters. Author and time come from the backend.

### `GET /staff/tickets/:id/internal-notes`

IT Staff and Administrator only. Requesters receive a non-disclosing forbidden response with no note data.

### `POST /staff/tickets/:id/internal-notes`

IT Staff and Administrator only. Body and validation match Public Comments. Notes are append-only.

## 7. Administrator User API

All endpoints require `ADMINISTRATOR`.

### `GET /admin/users`

Optional `search` matches normalized name or email; optional `role` is one valid role. Returns safe fields: `id`, `name`, `email`, `role`, `isActive`, `mustChangePassword`, `createdAt`, and `updatedAt`. Pagination is not required.

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

Creates one user with `mustChangePassword=true`. Duplicate normalized email returns `409 DUPLICATE_EMAIL`.

### `PATCH /admin/users/:id`

Body may contain `name`, `email`, `role`, and `isActive`. Unknown fields are rejected. The transaction prevents self-deactivation and removal/deactivation of the last active Administrator.

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
