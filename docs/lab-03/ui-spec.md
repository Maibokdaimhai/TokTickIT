# Lab 3 UI Specification - Zen Green Extension

Status: Draft. All Lab 2 tokens, focus behavior, validation placement, and responsive expectations remain in force.

## 1. Application Shell

- Header retains the TokTickIT brand and displays authenticated name plus a role badge.
- Profile menu contains Change Password and Logout.
- Requester navigation: My Tickets and Create Ticket.
- IT Staff navigation: Ticket Queue.
- Administrator navigation: User Management (default) and Ticket Queue as separate destinations under the proposed authorization matrix.
- Unauthorized destinations are not rendered, but server authorization remains authoritative.

## 2. Shared Components

- `AppShell`, `RoleBadge`, `StatusBadge`, and `PriorityBadge` provide consistent labels plus color-independent text.
- `FormField`, `ErrorCallout`, `EmptyState`, `LoadingState`, `ConfirmationModal`, and pagination controls are reused across roles.
- Editable controls are white; immutable values use the Lab 2 soft gray-green treatment.
- Public Comments use green-accented cards labeled "Public". Internal Notes use amber-accented cards labeled "Private - IT Staff and Administrators".
- Focus indicators remain visible with keyboard navigation; labels, error association, dialog semantics, and 44px touch targets are required.

## 3. Login

### Default mode

- Centered card with logo, email, password/show control, and Sign In.
- Client validates required fields and email shape; server remains authoritative.

### Feedback

- Busy: button disabled with spinner and "Signing in...".
- Invalid credentials: generic inline callout without revealing account existence.
- Inactive/locked/safe API failure: distinct safe callout and retry guidance where appropriate.
- Successful login routes according to `mustChangePassword` and role.

## 4. Mandatory Change Password

- Shows current, new, and confirmation password controls.
- Visible checklist communicates at least ten characters, uppercase/lowercase/digit/symbol, and the 72 UTF-8 byte limit. Show a clear validation message if non-ASCII input exceeds the byte limit; never silently truncate it.
- Continue remains busy/disabled while saving.
- Normal navigation is absent until success; Logout remains available.
- Field errors appear immediately below their controls; server failure preserves non-secret input only where safe.

## 5. Requester Screens

- Remove RequesterSelectorModal, requester badge switching, and localStorage requester identity.
- Existing My Tickets, Create Ticket, detail, and attachment states remain visually and behaviorally compatible.
- Ticket Detail adds a Public Comments timeline/composer.
- "Problem Appears Resolved" is a clearly worded secondary action with confirmation explaining that IT Staff still formally resolve/close the ticket.
- The indication and timestamp appear in ticket detail without presenting it as formal ticket status.

## 6. IT Staff Ticket Queue

### Desktop

Table columns: Ticket Number, Updated, Summary, Category, Requested Priority, IT Priority, Status, Owner, and Open action. Avoid additional low-value columns.

Controls: search; category, status, Requested Priority, IT Priority, and owner filters; one sort selector; clear filters; page size (10/20/50); pagination. Debounce search by 300 ms, reset page to 1 when queries change, cancel/discard stale responses, and retain queries when returning from detail. Priority sorting follows URGENT/HIGH/MEDIUM/LOW, not alphabetic order.

### Tablet and mobile

- Tablet may hide Category before any essential operational field.
- Below 768px, rows become cards showing ticket number, summary, priorities, status, owner, updated time, and a full-width Open action.
- No horizontal scrolling is permitted.

### Modes and feedback

- Loading skeleton/spinner, true empty queue, filtered no-results with Clear Filters, forbidden callout, safe failure with Retry, and populated results.

## 7. IT Staff Ticket Detail

- Read-only requester submission is grouped separately from operational controls.
- Operational card contains owner, IT Priority, status, and guarded Save actions.
- Claim is prominent for unassigned tickets. Reassign loads its choices from `GET /api/staff/eligible-owners` and presents only eligible active IT Staff and Administrator users; the Administrator user-management list is not used.
- Destructive/terminal transitions require a confirmation modal.
- Tabs/sections: Public Comments, Internal Notes, Attachments. Public and private composers remain visually unmistakable.
- IT Staff and Administrators can view attachment metadata and download active attachments from accessible tickets. Removed attachments remain visible as audited metadata but have no download action.
- Concurrent `409` feedback explains that the ticket changed and offers Reload.
- Load owner options independently with loading/empty/retry states; disable reassignment until options load. Keep Unassigned distinct from an empty eligible-owner list. Claim calls the dedicated claim endpoint, not reassignment. Disable repeated mutations while saving and refresh version after success. An owner who became inactive between loading and saving produces safe INVALID_OWNER feedback with refreshed choices.
- Staff/Admin attachment cards expose metadata and active download only; Requester upload/removal controls do not appear. If a file is missing or was removed since rendering, show a safe error and refresh metadata.

## 8. Administrator User Management

### Desktop

- Left/main area: search, optional role filter, user list with Name, Email, Role, Status, Edit.
- Side panel/modal: Create or Edit User with name, email, one role, active toggle, and initial-password controls.

### Mobile

- User rows become cards; create/edit uses a full-width dialog or page section.
- Actions remain at least 44px and do not overflow.

### Safety and feedback

- Duplicate email, invalid role/input, forbidden access, self-deactivation, and last-administrator prevention receive specific safe messages.
- Initial password values are never redisplayed after submission.
- Success feedback names the completed action without exposing credentials.

## 9. Responsive Breakpoints

- Desktop: `>= 992px`, centered content up to 1200px, multi-column layouts.
- Tablet: `768-991px`, two-column layouts only where readable.
- Mobile: `< 768px`, single-column flow, cards instead of wide tables, no clipping or horizontal overflow.

## 10. Visual Verification Checklist

- [ ] Zen Green tokens and typography match Lab 2.
- [ ] Authenticated name and role are clear at every breakpoint.
- [ ] Role navigation exposes no unauthorized destination.
- [ ] Status, Requested Priority, IT Priority, and role badges include text labels.
- [ ] Public Comments and Internal Notes cannot be visually confused.
- [ ] Editable and read-only values are distinct.
- [ ] Validation is adjacent and programmatically associated.
- [ ] Loading, success, empty, no-results, forbidden, conflict, and failure states are readable.
- [ ] Keyboard focus, dialog focus handling, labels, and touch targets pass inspection.
- [ ] Desktop, tablet, and mobile have no clipping, overlap, or unintended horizontal scrolling.

## 11. Screen Modes, Navigation, and Failures

| Screen | Primary modes | Processing and feedback |
|---|---|---|
| Login | Enter credentials | Required/email errors; signing in; generic invalid credentials; verified inactive-account guidance; throttled retry; safe network/server failure |
| Change Password | Required first change; optional self change | Rule/confirmation/current-password errors; saving; successful rotated session; logout available; no normal navigation in required mode |
| Requester My Tickets | List/filter/view | Loading; true empty; no results; retry; page reset; all eight status labels |
| Create Ticket | Create; success confirmation | Read-only authenticated user; existing validation; upload progress/rollback; preserve draft on failure; warn about retained ticket if compensation fails |
| Requester Detail | Read; append Public Comment; indicate resolution; attachments | Missing/forbidden safe page; composer validation/saving/retry; resolution confirmation/duplicate conflict; active/removed attachment modes |
| Staff Queue | List/filter/view | Loading; empty; no results; retry; forbidden; query controls remain usable across breakpoints |
| Staff Detail | Read; edit operations; append public/private communication | Owner-options loading/empty/failure; save/confirmation; stale-version conflict; not-found/forbidden; retain unsent content on failure |
| User Management | List; create; edit; set initial password | Loading/empty/no results/retry; field/duplicate validation; safety conflicts; forbidden; saved feedback; cancel abandons unsaved form with confirmation |

Use path-based navigation so direct navigation/reload and browser back can be tested: /login, /change-password, /my-tickets, /tickets/new, /tickets/:id, /staff/tickets, /staff/tickets/:id, /admin/users. Load /auth/me before revealing protected content. Invalid sessions clear cached user/ticket/note data and redirect to Login; restricted sessions route to Change Password; unauthorized roles see a safe forbidden page with a link to their permitted home. Do not reuse data from the previous user. After successful logout, clear authentication/private caches and return to Login. If logout fails, clear visible private state, report failure, and offer retry without claiming the server session was revoked.

Problem Appears Resolved appears only in BR-17 permitted states; an existing indication shows time and disables repetition. Confirmation explicitly distinguishes the indication from formal resolution. Public/Private composers have separate labels and state; changing a tab cannot transfer draft content into the other composer. Status options contain only legal next values. Reopening, resolving, closing, and cancelling each require a named confirmation. No Actions Taken tab, email-reset checkbox, self-registration, or advanced administration features are implemented merely because an illustrative worksheet mockup shows them.

Reuse the exact tokens and typography in [Lab 2 UI specification](../lab-02/ui-spec.md). New badges: OPEN uses pale blue with 'Open'; WAITING_FOR_REQUESTER uses amber with 'Waiting for Requester'; REOPENED uses amber with 'Reopened'; CANCELLED uses muted gray with 'Cancelled'. Role labels always show Requester/IT Staff/Administrator. Error text remains #DC2626; primary #006B3C; secondary #0B7A46; page #F5F7F6; text #1A2E26. Verify contrast and ensure a text/icon label accompanies every color distinction. Tablet can switch to cards early if the table cannot fit; no clipping of operational data.

Dialogs move focus inside, trap Tab, restore the trigger on close, and support Escape except while a submitted operation is pending. Error summaries focus the first invalid field; use aria-invalid and aria-describedby, role=alert for errors, and polite live regions for save status. Keyboard users can access menus, sorting, pagination, composers, and password visibility. Never place passwords in URLs, persistent browser storage, screenshots, or success callouts.

## 12. Screenshot Plan

Under artifacts/lab-03/screenshots/, capture authentication/, requester/, staff-queue/, staff-ticket-detail/, and user-management/. For each major screen capture desktop (1440x900), tablet (820x1180), and mobile (390x844). Use descriptive names such as staff-queue/desktop-populated.png and authentication/mobile-password-validation.png.

Additional state evidence includes invalid/inactive/busy login, mandatory change, logout rejection; queue filtered/no-results/empty/failure; claim/reassign/status confirmation/conflict; public/private note distinction and forbidden API response; active/removed attachments; requester resolution indication; user creation/duplicate/reset/self-deactivation/last-admin safeguards and safe failures. Record browser/viewport, tested commit, scenario and result alongside evidence in tests.md. Do not mark the visual checklist complete until the screenshots and keyboard inspection exist.
