# Lab 2 REST API Specification — TokTickIT Backend API

## 1. Overview & Base URL

- **Base URL:** `/api`
- **Format:** `application/json` (except multipart file upload endpoint `multipart/form-data`)
- **Common Response Headers:** `Content-Type: application/json`

---

## 2. Standardized Error Response Schema

All HTTP 4xx and 5xx API responses follow a consistent, safe JSON error format:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed for ticket creation.",
    "details": [
      {
        "field": "summary",
        "message": "Summary must be at least 5 characters long."
      }
    ]
  }
}
```

---

## 3. API Endpoints

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

---

### 3.2 `GET /api/categories`
- **Description:** Retrieve active ticket categories.
- **Success Response (200 OK):**
```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

---

### 3.3 `GET /api/related-systems`
- **Description:** Retrieve active related systems.
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

---

### 3.4 `POST /api/tickets`
- **Description:** Create a new ticket for the active requester.
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
  - `requesterId`: Required, must exist and `isActive === true`.
  - `categoryId`: Required integer, must exist in DB.
  - `relatedSystemId`: Required integer, must exist in DB.
  - `requestedPriority`: Required enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  - `summary`: Required string, length 5–150 characters.
  - `description`: Required string, length 10–3000 characters.
- **Success Response (201 Created):**
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000101",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "status": "NEW",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idling after last update.",
  "createdAt": "2026-08-29T23:00:00.000Z",
  "updatedAt": "2026-08-29T23:00:00.000Z"
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure.
  - `400 Bad Request`: Requester ID inactive or missing.

---

### 3.5 `GET /api/tickets`
- **Description:** Retrieve paginated list of tickets owned by the specified requester.
- **Query Parameters:**
  - `requesterId` (required, int): Filter tickets by requester ID.
  - `search` (optional, string): Search in `summary` and `ticketNumber`.
  - `category` (optional, int): Filter by category ID.
  - `priority` (optional, string): Filter by requested priority.
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
      "ticketNumber": "TKT-2026-000101",
      "createdAt": "2026-08-29T23:00:00.000Z",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "itPriority": null,
      "status": "NEW",
      "updatedAt": "2026-08-29T23:00:00.000Z",
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

---

### 3.6 `GET /api/tickets/:id`
- **Description:** Retrieve detailed information for a single ticket owned by the requester.
- **Query Parameters:** `requesterId` (required, int).
- **Success Response (200 OK):** Includes full ticket details, category, related system, requester info, and attachment array.
- **Error Responses:**
  - `403 Forbidden` / `404 Not Found`: If `requesterId` does not match ticket owner.

---

### 3.7 `POST /api/tickets/:id/attachments`
- **Description:** Upload a permitted supporting attachment to an owned ticket.
- **Content-Type:** `multipart/form-data` (field name `file`).
- **Query / Form Body:** `requesterId` (required, int).
- **Validation Rules:**
  - File format: JPG, JPEG, PNG, WEBP, PDF.
  - Max file size: $5\text{ MB}$ ($5,242,880\text{ bytes}$).
  - Max active attachments per ticket: 5.
- **Success Response (201 Created):**
```json
{
  "id": 15,
  "ticketId": 101,
  "fileName": "1724972400000-screenshot.png",
  "originalName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 245000,
  "isRemoved": false,
  "removalReason": null,
  "removedAt": null,
  "createdAt": "2026-08-29T23:10:00.000Z"
}
```

---

### 3.8 `GET /api/tickets/:id/attachments/:attachmentId`
- **Description:** Stream / download an active attachment.
- **Query Parameters:** `requesterId` (required, int).
- **Success Response (200 OK):** File binary stream response with correct `Content-Type`.
- **Error Response (404 Not Found / 403 Forbidden):** If attachment is soft-removed (`isRemoved === true`) or owned by another user.

---

### 3.9 `POST /api/tickets/:id/attachments/:attachmentId/remove`
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
  "removedAt": "2026-08-29T23:15:00.000Z"
}
```
