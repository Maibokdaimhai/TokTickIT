# Lab 2 UI Specification — Zen Green Design Language

## 1. Design System & Color Tokens

Lab 2 establishes reusable presentation rules based on the **Zen Green Theme**. All components and screens MUST conform to these exact color tokens and visual conventions:

| Token / Element | Color Code | Usage / Purpose |
| :--- | :--- | :--- |
| **Primary Green** | `#006B3C` | Application header bar, primary action buttons, main heading accents. |
| **Secondary Green** | `#0B7A46` | Active navigation tabs, focus rings, link text, secondary hover states. |
| **Pale Green** | `#EAF6EF` | Selected list items, success callout background, subtle section highlights. |
| **Page Background** | `#F5F7F6` | Quiet, comfortable near-white canvas background. |
| **Surface / Cards** | `#FFFFFF` | Form containers, ticket list cards, surface modals (white background, `#E2E8F0` border, subtle shadow). |
| **Text Primary** | `#1A2E26` | Dark charcoal-green for readable high-contrast body text (not pure black). |
| **Text Secondary** | `#4A5568` | Muted charcoal for field labels, timestamps, metadata text. |
| **Editable Field** | `#FFFFFF` | Background for editable inputs/selects with `#CBD5E1` neutral border. |
| **Read-Only Field** | `#F1F5F9` | Soft gray-green/ivory shading for system-generated or disabled inputs. |
| **Error State** | `#DC2626` | Dark red text, icon, and border; inline validation text placed directly below controls. |
| **Warning State** | `#D97706` | Amber callout background/border and warning status badges. |
| **Success State** | `#16A34A` | Green confirmation modal/banner with readable text and icon indicator. |

---

## 2. Typography and Layout System

- **Font Family:** System UI font stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Headings:**
  - `h1`: 24px (1.5rem), Semi-Bold (600), Charcoal-green text.
  - `h2`: 20px (1.25rem), Semi-Bold (600).
  - `h3`: 16px (1rem), Medium (500).
- **Body Text:** 14px (0.875rem), Regular (400), line-height 1.5.
- **Form Controls:** 14px text, 40px height for text inputs and dropdowns, 8px border-radius.

---

## 3. Component & State Rules

### 3.1 Field Controls & Validation
- **Labels:** Positioned directly above input controls with 4px gap, weight 500 (medium), dark charcoal text.
- **Required Marker:** Red asterisk (`*`) placed immediately after label text (`<label>Summary <span class="required">*</span></label>`).
- **Validation Error Placement:** Validation messages MUST appear directly below the associated field control in 12px red text (`#DC2626`). Input border changes to red (`#DC2626`) when invalid.
- **Read-Only Fields:** Read-only fields (e.g. Ticket Number, Ticket Date, Requester Name) use background `#F1F5F9`, muted text, cursor `not-allowed`, and remain visually distinct from editable white fields.

### 3.2 Button Hierarchy & States
- **Primary Button:** Solid Primary Green `#006B3C`, white text, 8px radius, hover state `#00542F`.
- **Secondary Button:** Outlined Primary Green `#006B3C`, white background, 8px radius, hover state `#EAF6EF`.
- **Destructive Button:** Soft red background `#FEE2E2`, dark red text `#DC2626`, hover state `#FCA5A5`.
- **Busy / Loading State:** Submit button displays a spinning loader icon, white text "Submitting...", and enters `disabled` state (pointer-events disabled, opacity 0.75).

### 3.3 Status and Priority Badges
- **Status Badges:**
  - `NEW`: Pale blue background `#E0F2FE`, dark blue text `#0369A1`.
  - `IN_PROGRESS`: Pale amber background `#FEF3C7`, dark amber text `#B45309`.
  - `RESOLVED`: Pale green background `#DCFCE7`, dark green text `#15803D`.
  - `CLOSED`: Muted gray background `#F3F4F6`, dark gray text `#4B5563`.
- **Priority Badges:**
  - `LOW`: Muted gray `#F3F4F6`.
  - `MEDIUM`: Amber `#FEF3C7` / `#B45309`.
  - `HIGH`: Orange `#FFEDD5` / `#C2410C`.
  - `URGENT`: Red `#FEE2E2` / `#B91C1C`.

---

## 4. Screen Layout Rules & Responsiveness

### 4.1 Breakpoint Definitions
- **Desktop ($\ge 992\text{px}$):**
  - Centered canvas layout with max-width $1200\text{px}$.
  - Header: TokTickIT logo left, nav links middle ("My Tickets", "Create Ticket"), active requester badge & "Change Requester" right.
  - My Tickets: Full multi-column data table.
  - Create Ticket: Two-column grid for classification options; full-width summary and description.
- **Tablet ($768\text{px} - 991\text{px}$):**
  - Grid collapses to 2 columns where practical.
  - Summary and description take full width.
  - My Tickets table enables horizontal scroll or responsive table wrapping.
- **Mobile ($< 768\text{px}$):**
  - Single-column vertical stack layout.
  - Inputs and buttons take 100% width with touch targets $\ge 44\text{px}$.
  - My Tickets transforms from table into a card-based list view showing Ticket Number, Summary, Category, Status badge, and Created Date per card.

---

## 5. Screen Specifications

### 5.1 Development Requester Selection Screen (Simulated Login)
- **Header Disclaimer:** Banner explaining "Select a Development Requester to test requester-specific ticket behavior. This is not a login screen. Authentication will be introduced in Lab 3."
- **Controls:** Dropdown of active requesters (`RequesterUser`), "Continue" primary button, "Cancel" secondary button.
- **States:** Loading state with skeleton loader, empty state if no active requesters exist, API failure callout.

### 5.2 Create Ticket Screen
- **Section 1 (System Info):** Read-only Ticket Number (`TKT-YYYY-XXXXXX` placeholder), Ticket Date (today's date), Requester Name (active requester).
- **Section 2 (Classification):** Category select (dropdown), Related System select (dropdown), Requested Priority select (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Section 3 (Details):** Summary input, Description multiline textarea (height min 120px, resizable vertically).
- **Section 4 (Attachments):** Drag-and-drop / click file selector supporting JPG, PNG, WEBP, PDF up to 5 MB per file.
- **Section 5 (Actions):** Primary "Submit Ticket" button, Secondary "Cancel" button.

### 5.3 My Tickets Screen
- **Filter Bar:** Search input (ticket no / summary), Category dropdown, Priority dropdown, Status dropdown, "Clear Filters" button, "Create Ticket" primary button.
- **List View:**
  - Desktop: Table with columns (Ticket No, Date, Summary, Category, Priority, Status, Owner, Last Updated).
  - Mobile: Card list showing summary, status badge, ticket number, and date.
- **Pagination Bar:** `Previous`, Page numbers (`1`, `2`, ...), `Next`, Item counter (`Showing 1 to 10 of 42 tickets`).
- **States:** Loading spinner, Empty list state (no tickets created), No-results state (filters matched 0 tickets).

### 5.4 Ticket Detail Screen (Read-Only)
- **Header:** Back to My Tickets link, Ticket Number, Ticket Date, Status Badge, Priority Badge.
- **Main Fields:** Read-only values for Requester, Category, Related System, Summary, Description.
- **Attachment Section:**
  - Active Attachment Card: File icon, Original Name, File Size, Upload Date, "Download" button, "Remove" soft-remove button.
  - Soft-Removed Attachment Card: Muted styling, "Removed" badge, Removal Reason text, Removal Date, disabled download link.
  - Upload New Attachment button ($\le 5$ active limit enforced).
- **Soft-Removal Modal:** Dialog asking for mandatory removal reason before confirming soft removal.

---

## 6. Visual Checklist and Screenshot Artifact Paths

Screenshots collected during visual inspection will be saved to the following artifact paths:
- `artifacts/lab-02/screenshots/create-ticket/01-initial-form.png`
- `artifacts/lab-02/screenshots/create-ticket/02-validation-error.png`
- `artifacts/lab-02/screenshots/create-ticket/03-submitting-busy.png`
- `artifacts/lab-02/screenshots/create-ticket/04-success-modal.png`
- `artifacts/lab-02/screenshots/create-ticket/05-api-failure.png`
- `artifacts/lab-02/screenshots/my-tickets/01-desktop-table.png`
- `artifacts/lab-02/screenshots/my-tickets/02-mobile-cards.png`
- `artifacts/lab-02/screenshots/my-tickets/03-filtered-results.png`
- `artifacts/lab-02/screenshots/my-tickets/04-empty-state.png`
- `artifacts/lab-02/screenshots/ticket-detail/01-detail-view.png`
- `artifacts/lab-02/screenshots/ticket-detail/02-attachment-active.png`
- `artifacts/lab-02/screenshots/ticket-detail/03-soft-remove-modal.png`
- `artifacts/lab-02/screenshots/ticket-detail/04-attachment-removed.png`
