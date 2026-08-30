# Lab 2 REST API Specification — TokTickIT Backend API

## 1. Overview & Protocol Rules

- **Base URL:** `/api`
- **Format:** `application/json` (except file upload endpoint `POST /api/tickets/:id/attachments` which uses `multipart/form-data`)
- **Requester Identity Location:** For Lab 2 simulated login, `requesterId` is passed as a query parameter (`?requesterId=X`) for all `GET` endpoints, and in the request body (`{ "requesterId": X }`) or form-data for `POST` endpoints.
- **Ownership Access Control Policy:** All ticket and attachment endpoints enforce strict requester ownership matching (`ticket.requesterId === requesterId`). Unauthorized requests MUST return **HTTP 403 Forbidden** with a standardized JSON error message.

---

## 2. Standardized Error Response Schema

All HTTP 4xx and 5xx API responses follow a consistent JSON error format:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied: ticket is owned by another requester",
    "details": null
  }
}
```

### Standard Error Codes:
- `INVALID_INPUT` (HTTP 400 Bad Request): Missing required fields, out-of-range lengths, or unsupported file formats/sizes.
- `FORBIDDEN` (HTTP 403 Forbidden): Requester ID missing, inactive requester, or attempting to access/modify another user's ticket/attachment.
- `NOT_FOUND` (HTTP 404 Not Found): Ticket or attachment ID does not exist in the database.
- `ATTACHMENT_LIMIT_EXCEEDED` (HTTP 400 Bad Request): Ticket already has 5 active attachments.
- `INTERNAL_SERVER_ERROR` (HTTP 500 Internal Server Error): Unexpected database or file storage failure.

---

## 3. Endpoints Specification

### 3.1 `GET /api/requesters`
- **Description:** Retrieve active Development Requesters for simulated login selection.
- **Query Parameters:** None.
- **Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@example.com",
    "department": "Engineering"
  },
  {
    "id": 2,
    "name": "Michael Brown",
    "email": "michael.brown@example.com",
    "department": "Marketing"
  }
]
```
- **Error Responses:**
  - `500 Internal Server Error`: Failed to fetch requesters.

---

### 3.2 `GET /api/categories`
- **Description:** Retrieve active ticket categories.
- **Query Parameters:** None.
- **Success Response (200 OK):**
```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```
- **Error Responses:**
  - `500 Internal Server Error`: Failed to fetch categories.

---

### 3.3 `GET /api/related-systems`
- **Description:** Retrieve active related systems.
- **Query Parameters:** None.
- **Success Response (200 OK):**
```json
[
  { "id": 1, "name": "Email" },
  { "id": 2, "name": "Campus Wi-Fi" },
  { "id": 3, "name": "VPN" },
  { "id": 4, "name": "LEB2 App" },
  { "id": 5, "name": "Grade Submission App" },
  { "id": 6, "name": "Printer" },
  { "id": 7, "name": "Corporate Laptop" }
]
```
- **Error Responses:**
  - `500 Internal Server Error`: Failed to fetch related systems.

---

### 3.4 `POST /api/tickets`
- **Description:** Create a new ticket for the active requester. Operates as an atomic transaction (rolls back ticket creation if initial attachment save fails).
- **Request Body:**
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "requestedPriority": "MEDIUM",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idling after last update."
}
```
- **Validation Rules:**
  - `requesterId`: Required integer, must exist and `isActive === true`.
  - `categoryId`: Required integer, must exist in DB.
  - `relatedSystemId`: Required integer, must exist in DB.
  - `requestedPriority`: Required enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  - `summary`: Required string, trimmed length 5–150 characters.
  - `description`: Required string, trimmed length 10–3000 characters.
- **Success Response (201 Created):**
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000001",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "status": "NEW",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idling after last update.",
  "createdAt": "2026-08-30T10:00:00.000Z",
  "updatedAt": "2026-08-30T10:00:00.000Z"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (e.g. summary too short) or invalid foreign key.
  - `403 Forbidden`: Requester ID is inactive or missing.
  - `500 Internal Server Error`: Transaction / file storage failure (atomic rollback executed).

---

### 3.5 `GET /api/tickets`
- **Description:** Retrieve paginated list of tickets owned by the specified requester.
- **Query Parameters:**
  - `requesterId` (required, int): Filter tickets by requester ID.
  - `search` (optional, string): Case-insensitive search on `summary` and `ticketNumber`.
  - `category` (optional, int): Filter by category ID.
  - `priority` (optional, string): Filter by requested priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  - `status` (optional, string): Filter by status (`NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`).
  - `sort` (optional, string): `createdAt_desc` (default), `createdAt_asc`, `ticketNumber_asc`, `ticketNumber_desc`.
  - `page` (optional, int, default 1).
  - `limit` (optional, int, default 10, max 50).
- **Success Response (200 OK):**
```json
{
  "tickets": [
    {
      "id": 101,
      "ticketNumber": "TKT-2026-000001",
      "createdAt": "2026-08-30T10:00:00.000Z",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "itPriority": null,
      "status": "NEW",
      "updatedAt": "2026-08-30T10:00:00.000Z",
      "attachmentCount": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```
- **Error Responses:**
  - `400 Bad Request`: Invalid page, limit, or sort parameter format.
  - `403 Forbidden`: Requester ID missing or corresponds to an inactive user.
  - `500 Internal Server Error`: Failed to query ticket list.

---

### 3.6 `GET /api/tickets/:id`
- **Description:** Retrieve detailed information for a single ticket owned by the requester.
- **Query Parameters:** `requesterId` (required, int).
- **Success Response (200 OK):**
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000001",
  "requesterId": 1,
  "requester": { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" },
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "status": "NEW",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idling after last update.",
  "createdAt": "2026-08-30T10:00:00.000Z",
  "updatedAt": "2026-08-30T10:00:00.000Z",
  "attachments": [
    {
      "id": 15,
      "originalName": "screenshot.png",
      "fileSize": 245000,
      "mimeType": "image/png",
      "isRemoved": false,
      "removalReason": null,
      "createdAt": "2026-08-30T10:05:00.000Z"
    }
  ]
}
```
- **Error Responses:**
  - `400 Bad Request`: Ticket ID parameter is not a valid integer.
  - `403 Forbidden`: Ticket exists but belongs to a different requester (`requesterId` mismatch).
  - `404 Not Found`: Ticket ID does not exist in database.
  - `500 Internal Server Error`: Failed to retrieve ticket details.

---

### 3.7 `POST /api/tickets/:id/attachments`
- **Description:** Upload a permitted supporting attachment to an owned ticket.
- **Content-Type:** `multipart/form-data` (form fields: `file` [binary], `requesterId` [int]).
- **Validation Rules:**
  - File MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
  - Max file size: $5\text{ MB}$ ($5,242,880\text{ bytes}$).
  - Max active attachments per ticket: 5 (`isRemoved === false`).
- **Success Response (201 Created):**
```json
{
  "id": 15,
  "ticketId": 101,
  "fileName": "1725012345000-screenshot.png",
  "originalName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 245000,
  "isRemoved": false,
  "removalReason": null,
  "removedAt": null,
  "createdAt": "2026-08-30T10:05:00.000Z"
}
```
- **Error Responses:**
  - `400 Bad Request`: Invalid file format, size $>5\text{MB}$, or active attachment limit (5) reached (`ATTACHMENT_LIMIT_EXCEEDED`).
  - `403 Forbidden`: Ticket belongs to another requester.
  - `404 Not Found`: Ticket ID does not exist.
  - `500 Internal Server Error`: Storage write failure.

---

### 3.8 `GET /api/tickets/:id/attachments/:attachmentId`
- **Description:** Stream / download an active attachment.
- **Query Parameters:** `requesterId` (required, int).
- **Success Response (200 OK):** File binary stream response with original file header (`Content-Disposition: inline; filename="screenshot.png"`).
- **Error Responses:**
  - `403 Forbidden`: Ticket/attachment belongs to another requester OR attachment has been soft-removed (`isRemoved === true`).
  - `404 Not Found`: Ticket or attachment ID does not exist.
  - `500 Internal Server Error`: Failed to stream file.

---

### 3.9 `GET /api/tickets/:id/attachments/:attachmentId/metadata`
- **Description:** Retrieve attachment JSON metadata (works for both active and soft-removed attachments).
- **Query Parameters:** `requesterId` (required, int).
- **Success Response (200 OK):**
```json
{
  "id": 15,
  "ticketId": 101,
  "originalName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 245000,
  "isRemoved": true,
  "removalReason": "Uploaded wrong file",
  "removedAt": "2026-08-30T10:10:00.000Z",
  "createdAt": "2026-08-30T10:05:00.000Z"
}
```
- **Error Responses:**
  - `403 Forbidden`: Ticket belongs to another requester.
  - `404 Not Found`: Attachment ID does not exist.

---

### 3.10 `POST /api/tickets/:id/attachments/:attachmentId/remove`
- **Description:** Soft-remove an attachment from an owned ticket.
- **Request Body:**
```json
{
  "requesterId": 1,
  "removalReason": "Uploaded incorrect log file by mistake"
}
```
- **Validation Rules:** `removalReason` is required (string, min 3 chars).
- **Success Response (200 OK):**
```json
{
  "id": 15,
  "ticketId": 101,
  "originalName": "screenshot.png",
  "isRemoved": true,
  "removalReason": "Uploaded incorrect log file by mistake",
  "removedAt": "2026-08-30T10:10:00.000Z"
}
```
- **Error Responses:**
  - `400 Bad Request`: `removalReason` missing or less than 3 characters.
  - `403 Forbidden`: Ticket belongs to another requester or attachment is already soft-removed.
  - `404 Not Found`: Attachment ID does not exist.
  - `500 Internal Server Error`: Failed to execute soft removal.
