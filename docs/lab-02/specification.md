# Lab 2 Sprint Engineering Specification — TokTickIT Requester Ticketing MVP

## 1. Sprint Goal
Deliver a responsive Requester-facing IT support ticketing experience using a temporary Development Requester selection context to simulate multi-user ownership before full authentication is introduced in Lab 3. By the end of Sprint 2, a Requester can select their identity, create IT support tickets with permitted attachments, receive a system-generated unique Ticket Number, search/filter/sort/paginate their owned tickets in "My Tickets", view read-only Ticket Details, and manage attachments including soft removal with mandatory removal reasons—all following the Zen Green design system.

## 2. Stakeholder Request Interpretation
The IT department needs a user-friendly Requester portal to receive support requests. The system must allow users to report IT issues by selecting a category and related system, indicating requested priority, providing summary and detailed description, and attaching supporting evidence (JPG, PNG, WEBP, PDF up to 5 MB). After submission, the backend must assign a unique Ticket Number. Users must be able to track their tickets through a searchable, filterable list ("My Tickets"), view ticket details in read-only mode, upload additional attachments, and soft-remove existing attachments with a mandatory reason. To simulate multi-user behavior prior to real authentication, a temporary Development Requester selection screen serves as a "user login" test context. Strict ownership isolation must prevent one requester from viewing or accessing another requester's tickets or attachments.

## 3. Scope

### Included Scope
- **Development Requester Selection:** Simulated user login context for Lab 2 testing; allows selecting an active seeded requester identity.
- **Create Ticket Workflow:** Frontend creation form, backend validation, auto-generated unique Ticket Number (`TKT-YYYY-XXXXXX`), reference data loading (Categories, Related Systems), initial attachment dropzone.
- **My Tickets Screen:** Requester-owned paginated ticket list with search, category/priority/status filters, column sorting, empty state, no-results state, and mobile card view.
- **Requester Ticket Detail Screen:** Read-only ticket information view and attachment manager.
- **Attachment Lifecycle:** Upload active attachments (JPG/PNG/WEBP/PDF $\le 5\text{MB}$, max 5 active), download active attachments, soft-remove attachment with a mandatory removal reason (retains metadata, blocks download).
- **Zen Green Design System:** Standardized visual theme tokens, form input states, field-level error messages, responsive breakpoints, accessible controls.

### Excluded Scope (Deferred to Lab 3 / Future Sprints)
- Real authentication, passwords, session tokens, JWTs, password hashing, user registration.
- IT Staff workflow (IT Staff dashboard, claiming/reassigning tickets, IT Priority updates, ticket resolution/closing).
- Collaboration features (Public Comments, Internal Notes, Actions Taken).
- Status changes beyond initial `NEW` status after creation.

---

## 4. Functional Requirements (FR)

- **FR-01 (Requester Selector):** The system MUST allow testing users to select an active Development Requester identity from PostgreSQL to establish the active session context.
- **FR-02 (Requester Display):** The application header MUST display the currently selected Development Requester name and provide a "Change Requester" action to switch identities.
- **FR-03 (Create Ticket Form):** The system MUST provide a Create Ticket form containing Ticket Number (read-only), Ticket Date (read-only), Requester Name (read-only), Category dropdown, Related System dropdown, Requested Priority dropdown (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), Ticket Summary input, Description multiline textarea, and Attachment dropzone.
- **FR-04 (Ticket Number Generation):** Upon valid submission, the backend MUST generate a unique, sequential official Ticket Number in format `TKT-YYYY-XXXXXX` (e.g. `TKT-2026-000001`).
- **FR-05 (Default Ticket Status):** All newly created tickets MUST begin with Current Status set to `NEW`.
- **FR-06 (Form Validation):** The system MUST validate required fields on both frontend and backend. Validation error messages MUST appear directly below the affected fields.
- **FR-07 (Data Retention on Error):** If ticket submission fails (validation or server error), the system MUST preserve user-entered form values and render a clear error message.
- **FR-08 (My Tickets List):** The system MUST display a paginated list of tickets owned exclusively by the currently selected Development Requester.
- **FR-09 (Search & Filtering):** The My Tickets screen MUST support case-insensitive text search (on summary and ticket number), filtering by Category, Requested Priority, and Status, and a "Clear Filters" button.
- **FR-10 (Sorting & Pagination):** The ticket list MUST support sorting by creation date and ticket number (asc/desc), and pagination with page numbers and item count display.
- **FR-11 (Ticket Detail View):** The system MUST present owned ticket details in a read-only screen.
- **FR-12 (Attachment Upload & Soft Removal):** The system MUST permit uploading supporting evidence (JPG, PNG, WEBP, PDF up to 5 MB per file, max 5 active per ticket) and soft-removing owned attachments with a mandatory removal reason.

---

## 5. Business Rules (BR)

- **BR-01 (Ticket Number Format):** Official Ticket Numbers are generated exclusively by the backend upon successful creation and MUST follow the format `TKT-YYYY-XXXXXX` (where `YYYY` is the current year and `XXXXXX` is a 6-digit zero-padded sequential sequence number incremented per year, e.g. `TKT-2026-000001`, `TKT-2026-000002`).
- **BR-02 (Initial Status):** Every newly created ticket MUST be assigned an initial status of `NEW`.
- **BR-03 (Testing Context Disclaimer):** The Development Requester selector is strictly a temporary testing mechanism for Lab 2 and MUST NOT be treated as secure authentication or session authorization.
- **BR-04 (Active Requesters Only):** The Development Requester selector MUST load only active requesters (`isActive = true`). Inactive requesters MUST NOT appear in the selection list.
- **BR-05 (Ownership Isolation & Consistent HTTP Status):** Requesters can ONLY view, search, open, upload attachments to, or soft-remove attachments from tickets they own (`requesterId === selectedRequester.id`). Direct requests to access or modify another requester's ticket or attachment MUST be rejected consistently with **HTTP 403 Forbidden** (`{ "error": { "code": "FORBIDDEN", "message": "Access denied: ticket is owned by another requester" } }`).
- **BR-06 (Allowed File Formats):** Attachment file uploads MUST be restricted to MIME types `image/jpeg`, `image/png`, `image/webp`, and `application/pdf` (file extensions `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`).
- **BR-07 (File Size Limit):** Individual attachment file size MUST NOT exceed 5 megabytes ($5\text{ MB} = 5,242,880\text{ bytes}$).
- **BR-08 (Active Attachment Limit):** A single ticket MUST NOT have more than 5 active (`isRemoved = false`) attachments at any given time.
- **BR-09 (Soft Removal Rules):** Attachment removal MUST be implemented as soft removal (`isRemoved = true`, `removedAt = timestamp`). Soft-removed attachments MUST remain visible as metadata in the attachment list marked as "Removed", but file downloading or previewing MUST be permanently blocked (HTTP 403 Forbidden).
- **BR-10 (Mandatory Removal Reason):** Soft removal of an attachment MUST require a non-empty removal reason string (minimum 3 characters).
- **BR-11 (Field Validation Constraints):**
  - `summary`: Required, string, trimmed length between 5 and 150 characters.
  - `description`: Required, string, trimmed length between 10 and 3000 characters.
  - `categoryId`: Required integer, must exist in database.
  - `relatedSystemId`: Required integer, must exist in database.
  - `requestedPriority`: Required enum (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **BR-12 (Query Defaults & Sorting):** The default ticket list query MUST return `page=1`, `limit=10`, sorted by `createdAt` descending. Supported sort fields are `createdAt` (`asc`/`desc`) and `ticketNumber` (`asc`/`desc`).
- **BR-13 (Inactive User Exclusion):** If a user ID corresponds to an inactive requester (`isActive = false`), ticket creation or ticket list fetching for that ID MUST fail with HTTP 403 Forbidden.
- **BR-14 (Safe Error Handling):** Backend API errors MUST return standardized JSON error objects without revealing internal system stack traces or sensitive database details.
- **BR-15 (Transition to Lab 3):** All requester ownership checks MUST use `requesterId` foreign key references so that Lab 3 can seamlessly integrate real authentication tokens.
- **BR-16 (Two-Step Ticket Creation & Compensation Rollback Strategy):** Creating a ticket with initial supporting evidence follows a **two-step REST workflow**:
  1. **Step 1 (Ticket Creation):** Client sends `POST /api/tickets` with JSON payload (`summary`, `description`, `categoryId`, `relatedSystemId`, `requestedPriority`, `requesterId`). The backend creates the ticket record in status `NEW` and returns `201 Created` with the assigned Ticket Number.
  2. **Step 2 (Initial Attachment Uploads):** For each user-selected initial attachment, the client sends `POST /api/tickets/:id/attachments` with `multipart/form-data`.
  3. **Compensation Rollback:** If any attachment upload fails during Step 2 (due to network error, file validation failure, or disk storage write error), the client MUST execute an automated compensation rollback by calling `DELETE /api/tickets/:id?requesterId=X`. The backend will delete the draft ticket record from PostgreSQL and clean up any partially saved files from disk, returning a clear error banner to the user while preserving user-entered form values in the UI. No orphaned ticket without its required attachments will remain in the system.

---

## 6. UI Specification Summary

The interface strictly adheres to the **Zen Green Design Language**:
- **Palette:** `#006B3C` (Primary Green - Header & Primary Actions), `#0B7A46` (Secondary Green - Active tabs, hover states), `#EAF6EF` (Pale Green - Highlights, pale section cards), `#F5F7F6` (Quiet Page Background), `#1A2E26` (Charcoal Text).
- **Controls:** Labels placed above fields; required fields display a red asterisk (`*`); validation error messages appear immediately below affected controls; busy buttons render a spinner and enter a disabled state during processing.
- **Accessibility & Focus:** Visible outline focus rings (`2px #0B7A46`), screen reader accessible labels (`aria-label`) on icon-only controls, tooltips, and non-color-alone status indicators.
- **Responsive Layout:**
  - Desktop ($\ge 992\text{px}$): Multi-column centered form layout (max-width $1200\text{px}$), full desktop data table for My Tickets.
  - Tablet ($768\text{px} - 991\text{px}$): 2-column grid layout where practical.
  - Mobile ($< 768\text{px}$): Single-column vertical stack, touch-friendly buttons ($\ge 44\text{px}$ touch targets), card-based ticket list.
- **Reference:** Full details documented in [`ui-spec.md`](file:///Users/meng/dev/MyUniversity/CPE334-SoftwareEngineer/toktickit/docs/lab-02/ui-spec.md).

---

## 7. Data Changes (Prisma Schema)

### Models & Enums

#### `RequesterUser`
- `id` (Int, `@id @default(autoincrement())`)
- `name` (String)
- `email` (String, `@unique`)
- `department` (String)
- `isActive` (Boolean, `@default(true)`)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)
- Relations: `tickets Ticket[]`

#### `Category`
- `id` (Int, `@id @default(autoincrement())`)
- `name` (String, `@unique`)
- `isActive` (Boolean, `@default(true)`)
- `createdAt` (DateTime, `@default(now())`)
- Relations: `tickets Ticket[]`

#### `RelatedSystem`
- `id` (Int, `@id @default(autoincrement())`)
- `name` (String, `@unique`)
- `isActive` (Boolean, `@default(true)`)
- `createdAt` (DateTime, `@default(now())`)
- Relations: `tickets Ticket[]`

#### `Ticket`
- `id` (Int, `@id @default(autoincrement())`)
- `ticketNumber` (String, `@unique`)
- `requesterId` (Int, FK to `RequesterUser`)
- `categoryId` (Int, FK to `Category`)
- `relatedSystemId` (Int, FK to `RelatedSystem`)
- `summary` (String)
- `description` (String, `@db.Text`)
- `requestedPriority` (PriorityEnum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- `itPriority` (PriorityEnum, optional)
- `status` (StatusEnum: `NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `@default(NEW)`)
- `createdAt` (DateTime, `@default(now())`)
- `updatedAt` (DateTime, `@updatedAt`)
- Indexes: `@@index([requesterId])`, `@@index([status])`, `@@index([createdAt])`
- Relations: `requester RequesterUser`, `category Category`, `relatedSystem RelatedSystem`, `attachments Attachment[]`

#### `Attachment`
- `id` (Int, `@id @default(autoincrement())`)
- `ticketId` (Int, FK to `Ticket`)
- `fileName` (String)
- `originalName` (String)
- `mimeType` (String)
- `fileSize` (Int)
- `filePath` (String)
- `isRemoved` (Boolean, `@default(false)`)
- `removalReason` (String, optional)
- `removedAt` (DateTime, optional)
- `createdAt` (DateTime, `@default(now())`)
- Indexes: `@@index([ticketId])`
- Relations: `ticket Ticket`

---

## 8. API Contract Summary

The REST API exposes the following endpoints (detailed in [`api-spec.md`](file:///Users/meng/dev/MyUniversity/CPE334-SoftwareEngineer/toktickit/docs/lab-02/api-spec.md)):
- `GET /api/requesters`: Returns active Development Requesters.
- `GET /api/categories`: Returns active Categories.
- `GET /api/related-systems`: Returns active Related Systems.
- `POST /api/tickets`: Creates a new ticket for the active requester.
- `GET /api/tickets`: Returns paginated list of tickets owned by `requesterId` with search, filter, sort.
- `GET /api/tickets/:id`: Returns single ticket detail owned by `requesterId` (HTTP 403 if unowned).
- `POST /api/tickets/:id/attachments`: Uploads an attachment to an owned ticket.
- `GET /api/tickets/:id/attachments/:attachmentId`: Downloads an active attachment.
- `GET /api/tickets/:id/attachments/:attachmentId/metadata`: Retrieves attachment metadata.
- `POST /api/tickets/:id/attachments/:attachmentId/remove`: Soft-removes an attachment with reason.

---

## 9. Acceptance Criteria (AC)

- **AC-01 (Ticket Creation Success):** Given valid form input (category, related system, priority, summary, description), when the Requester submits the Create Ticket form, then a new ticket is saved in the database, assigned status `NEW`, and the generated official Ticket Number `TKT-YYYY-XXXXXX` is displayed.
- **AC-02 (Requester Selection Prompt):** Given no Development Requester is selected, when the user attempts to access My Tickets or Create Ticket, then the Requester Selection modal is automatically displayed.
- **AC-03 (Cross-Requester Ticket Isolation):** Given Requester B is selected, when a request is made to access a ticket belonging to Requester A, then the system returns HTTP 403 Forbidden and does not expose Requester A's ticket data.
- **AC-04 (Form Validation Placement & Retention):** Given invalid input (empty summary, summary $<5$ chars, or empty description), when the form is submitted, then the backend/frontend validation blocks submission, renders field-level red error text directly below affected inputs, and retains all user-entered field values.
- **AC-05 (Valid Attachment Upload):** Given a valid attachment file (PDF/PNG/JPG/WEBP, $\le 5\text{MB}$), when uploaded to an owned ticket with $<5$ active attachments, then the file is uploaded, linked to the ticket, and shown in the active attachment list.
- **AC-06 (Invalid Attachment Rejection):** Given an unsupported file format (e.g. `.exe`, `.zip`) or a file exceeding 5 MB, when upload is attempted, then the upload is rejected with a clear user error message and no database record is created.
- **AC-07 (Soft Removal with Reason):** Given an active attachment on an owned ticket, when the user requests removal and provides a valid removal reason, then `isRemoved` is set to `true`, `removedAt` is recorded, the file is displayed as "Removed", and subsequent download requests return HTTP 403 Forbidden.
- **AC-08 (Soft Removal Reason Required):** Given an active attachment, when the user attempts soft removal without entering a removal reason, then removal is blocked with a validation message.
- **AC-09 (My Tickets Search & Filter):** Given a list of tickets, when the user types a matching keyword into the search bar or selects a category/priority filter, then only matching tickets owned by the current requester are rendered.
- **AC-10 (My Tickets Pagination):** Given more than 10 tickets owned by a requester, when the user navigates between pages, then the correct page subset is loaded with accurate total item counts.
- **AC-11 (Requester Context Switch):** Given Requester A is selected and viewing My Tickets, when the user switches context to Requester B, then Requester A's tickets disappear and Requester B's ticket list is loaded.
- **AC-12 (Inactive Requester Exclusion):** Given seeded inactive requesters, when the Requester Selection modal opens, then inactive requesters do not appear in the dropdown.
- **AC-13 (Busy Submit State):** Given a valid ticket submission, while the API call is processing, then the Submit button enters a disabled state with a busy spinner.
- **AC-14 (Responsive Viewports):** Given any viewport size (Desktop $\ge 992\text{px}$, Tablet $768-991\text{px}$, Mobile $< 768\text{px}$), when browsing Create Ticket, My Tickets, or Ticket Detail, then all form inputs, table/cards, and attachment controls remain accessible without horizontal page overflow or text clipping.
- **AC-15 (API Error Handling):** Given an offline backend or database failure, when an API request is made, then a user-friendly error callout is rendered without crashing the application.
- **AC-16 (Ticket List Sorting):** Given a ticket list, when the user changes the sort dropdown (e.g. `createdAt` asc/desc, `ticketNumber` asc/desc), then the list items re-order accordingly.
- **AC-17 (Empty Ticket List State):** Given a selected requester with 0 tickets created, when opening My Tickets, then a friendly empty-state illustration and "Create Ticket" action are rendered (distinct from filtered no-results).
- **AC-18 (UI Accessibility & Focus):** Given keyboard navigation, when tabbing through form inputs and buttons, visible outline focus indicators are displayed, and icon controls contain accessible `aria-label` tags.

---

## 10. Product Definition of Done (DoD)

The Lab 2 software increment is complete only when:
- [ ] All approved scope features (Requester Context, Create Ticket, My Tickets, Ticket Detail, Attachment upload/download/soft-remove) are fully implemented.
- [ ] Database schema is updated, migrated via Prisma, and populated with idempotent seed data.
- [ ] All 18 Acceptance Criteria (AC-01 through AC-18) are satisfied and verified by automated tests.
- [ ] All automated unit, API, UI, responsive, and Playwright E2E tests pass cleanly on the `main` branch.
- [ ] Zen Green Design System standards and responsive layout rules are satisfied across Desktop, Tablet, and Mobile viewports.
- [ ] All required documentation files (`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `reviewer.md`, `ai-use.md`) are complete and accurate.
- [ ] README setup and test instructions are up to date.

---

## 11. Assumptions and Technical Decisions

1. **Development Login Simulator:** Uses local browser storage (`localStorage` / React State) to hold the `selectedRequesterId`. No real authentication tokens are used in Lab 2.
2. **File Storage:** Attachments are stored locally on disk under `server/uploads/` with sanitized, timestamped unique filenames to prevent file overwrite collisions.
3. **Ticket Number Sequence:** Ticket numbers sequence is generated by backend sequence counter incremented per year (`TKT-YYYY-XXXXXX`).
4. **Soft Removal Display:** Soft-removed attachment records remain visible in the attachment list for auditability, clearly styled with a "Removed" badge and muted text, but with download links disabled/removed.
5. **Atomic Attachment Compensation:** Creation of ticket + initial attachments uses database transaction / file cleanup rollback compensation if disk write fails.
