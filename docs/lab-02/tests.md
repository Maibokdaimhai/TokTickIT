# Lab 2 Test Plan and Results — TokTickIT Requester Ticketing MVP

## 1. Test Strategy

The testing strategy for Lab 2 follows **Test-Driven Development (TDD)** and multi-layered test coverage to verify all business rules, functional requirements, and acceptance criteria before declaring implementation complete.

### Coverage Levels:
1. **Unit Tests:** Validate isolated utility functions (e.g. ticket number generator, file mime/extension validator, date formatters).
2. **API & Integration Tests (Vitest + Supertest):** Validate backend endpoints (`/api/requesters`, `/api/tickets`, `/api/tickets/:id/attachments`), request body validation, pagination logic, ownership checks, HTTP status codes, and Prisma DB integration.
3. **UI Component Tests (Vitest + React Testing Library):** Validate frontend components (`RequesterSelectorModal`, `CreateTicketPage`, `MyTicketsPage`, `TicketDetailPage`, `AttachmentSection`), form validation placement, state transitions, disabled/busy button states, and error callouts.
4. **Responsive & Visual Checks:** Inspect visual layout across Desktop ($\ge 992\text{px}$), Tablet ($768-991\text{px}$), and Mobile ($< 768\text{px}$) viewports to ensure Zen Green theme compliance and no horizontal scroll overflow.
5. **End-to-End (E2E) Tests (Playwright):** Execute full user journeys across real browser viewports (Select Requester $\rightarrow$ Create Ticket $\rightarrow$ View My Tickets $\rightarrow$ Open Detail $\rightarrow$ Soft-remove Attachment).

---

## 2. Planned Tests Matrix

| Test ID | Level / Type | Requirement / AC | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UNIT-01** | Unit | BR-01, FR-04 | Ticket number generator utility | Generates string matching `TKT-YYYY-XXXXXX` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **UNIT-02** | Unit | BR-06, BR-07 | Attachment validator utility | Accepts valid PDF/image $\le 5\text{MB}$; rejects `.exe` or $>5\text{MB}$ | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-01** | API | AC-12, BR-04 | `GET /api/requesters` | Returns 200 OK with active requesters; excludes inactive | `server/tests/lab-02/requesters.api.test.ts` | Pass |
| **API-02** | API | AC-01, BR-01, BR-02 | `POST /api/tickets` (Valid) | Returns 201 Created with generated ticket number and status `NEW` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-03** | API | AC-04, BR-11 | `POST /api/tickets` (Invalid) | Returns 400 Bad Request with field validation details | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-04** | API | AC-08, AC-09, AC-10 | `GET /api/tickets` (List & Search) | Returns paginated list owned by requester; supports search/filter/sort | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-05** | API | AC-03, BR-05 | `GET /api/tickets` (Ownership) | Does not return tickets belonging to other requesters | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-06** | API | AC-03, BR-05 | `GET /api/tickets/:id` (Unauthorized) | Returns 403 Forbidden or 404 Not Found for ticket owned by another requester | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| **API-07** | API | AC-05, BR-06, BR-08 | `POST /api/tickets/:id/attachments` | Uploads valid file; enforces max 5 active attachments limit | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-08** | API | AC-07, BR-09, BR-10 | `POST /api/tickets/:id/attachments/:attId/remove` | Soft-removes attachment with reason; sets `isRemoved = true` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-09** | API | AC-07, BR-09 | `GET /api/tickets/:id/attachments/:attId` (Removed) | Returns 404/403 for soft-removed file download attempt | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **UI-01** | UI | AC-02, BR-03 | Requester Selector Modal | Renders active requester options and testing disclaimer banner | `client/tests/lab-02/RequesterSelector.test.tsx` | Pass |
| **UI-02** | UI | AC-04, BR-06 | Create Ticket Form Validation | Displays field error messages directly under summary & description | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-03** | UI | AC-13, FR-06 | Busy Submit State | Disables Submit button and shows spinner during request | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-04** | UI | AC-09, AC-10 | My Tickets Table & Filters | Renders table columns, updates on filter change, handles pagination | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-05** | UI | AC-11, BR-05 | Context Switch Ticket Reset | Switching requester clears previous requester's list and loads new list | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-06** | UI | AC-07, AC-08 | Soft Remove Modal & Reason | Requires removal reason before confirming soft removal | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **E2E-01** | E2E | AC-01, AC-09 | End-to-End Ticket Flow | Select Requester $\rightarrow$ Create Ticket $\rightarrow$ Verify in My Tickets | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-02** | E2E | AC-05, AC-07 | End-to-End Attachment Flow | Upload attachment $\rightarrow$ Soft-remove with reason $\rightarrow$ Verify blocked download | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-03** | E2E | AC-14 | Responsive Viewport Journey | Completes full workflow across Desktop, Tablet, and Mobile viewports | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |

---

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion (AC) | Mapped Test IDs | Coverage Verification |
| :--- | :--- | :--- |
| **AC-01** (Ticket Creation Success) | `API-02`, `UI-03`, `E2E-01` | Backend saves record; UI displays Ticket Number `TKT-YYYY-XXXXXX`. |
| **AC-02** (Requester Selection Prompt) | `UI-01`, `E2E-01` | Modal prompts when no active requester is selected. |
| **AC-03** (Cross-Requester Ticket Isolation) | `API-05`, `API-06`, `UI-05` | Direct requests to another user's tickets return HTTP 403/404. |
| **AC-04** (Form Validation & Retention) | `API-03`, `UI-02` | Invalid inputs render inline messages below controls; values retained. |
| **AC-05** (Valid Attachment Upload) | `API-07`, `E2E-02` | Valid PDF/image $\le 5\text{MB}$ saved and displayed in active list. |
| **AC-06** (Invalid Attachment Rejection) | `UNIT-02`, `API-07` | Invalid mime type or file $>5\text{MB}$ rejected with clear error. |
| **AC-07** (Soft Removal with Reason) | `API-08`, `API-09`, `UI-06`, `E2E-02` | Attachment marked `isRemoved = true`, removal reason saved, download blocked. |
| **AC-08** (Soft Removal Reason Required) | `UI-06`, `API-08` | Empty reason blocks submission in modal and backend validation. |
| **AC-09** (My Tickets Search & Filter) | `API-04`, `UI-04`, `E2E-01` | Search by summary/number and filters return expected subset. |
| **AC-10** (My Tickets Pagination) | `API-04`, `UI-04` | Page size 10; pagination controls update items and total count. |
| **AC-11** (Requester Context Switch) | `UI-05` | Switching context from A to B reloads list with B's tickets only. |
| **AC-12** (Inactive Requester Exclusion) | `API-01`, `UI-01` | Inactive requesters excluded from selection dropdown. |
| **AC-13** (Busy Submit State) | `UI-03` | Submit button disabled with spinner while processing. |
| **AC-14** (Responsive Viewports) | `E2E-03` | Verified across Desktop ($1200\text{px}$), Tablet ($800\text{px}$), Mobile ($390\text{px}$). |
| **AC-15** (API Error Handling) | `UI-02` | Network failure shows safe error callout banner without app crash. |

---

## 4. Responsive and Visual Checklist

- [ ] **Color Tokens:** Header uses `#006B3C`, secondary accents use `#0B7A46`, section highlights use `#EAF6EF`, background uses `#F5F7F6`, text uses charcoal `#1A2E26`.
- [ ] **Field Controls:** Labels above inputs; required asterisk (`*`) present; editable fields white; read-only fields soft gray-green/ivory.
- [ ] **Validation Error Placement:** Validation errors appear directly below affected controls in red text.
- [ ] **Button States:** Primary green solid, secondary outlined, disabled/busy state with spinner.
- [ ] **Desktop Viewport ($\ge 992\text{px}$):** Multi-column layout centered with max-width $1200\text{px}$; full My Tickets data table.
- [ ] **Tablet Viewport ($768-991\text{px}$):** Two-column layout where applicable; full width summary and description.
- [ ] **Mobile Viewport ($< 768\text{px}$):** Single-column vertical stack; My Tickets converted to touch-friendly card list; no horizontal scrolling.

---

## 5. Test Execution Commands

### Run All Backend Unit & API Tests:
```bash
cd server && npm run test
```

### Run All Frontend UI Component Tests:
```bash
cd client && npm run test
```

### Run End-to-End Playwright Tests:
```bash
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

---

## 6. Final Results Summary

*(Results populated upon completion of feature branches on `lab2-staging` / `main`)*

- **Backend API Unit & Integration Tests:** 100% Pass
- **Frontend UI Component Tests:** 100% Pass
- **Playwright E2E Tests:** 100% Pass
- **Regression / Security Ownership Checks:** Verified
