# Lab 3 UI Specification - Zen Green Extension

Status: Draft. All Lab 2 tokens, focus behavior, validation placement, and responsive expectations remain in force.

## 1. Application Shell

- Header retains the TokTickIT brand and displays authenticated name plus a role badge.
- Profile menu contains Change Password and Logout.
- Requester navigation: My Tickets and Create Ticket.
- IT Staff navigation: Ticket Queue.
- Administrator navigation: User Management, with secondary ticket access only when deliberately entering an authorized ticket workflow.
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
- Visible checklist communicates the 10-72 character complexity policy.
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

Controls: search; category, status, IT Priority, and owner filters; one sort selector; clear filters; pagination.

### Tablet and mobile

- Tablet may hide Category before any essential operational field.
- Below 768px, rows become cards showing ticket number, summary, priorities, status, owner, updated time, and a full-width Open action.
- No horizontal scrolling is permitted.

### Modes and feedback

- Loading skeleton/spinner, true empty queue, filtered no-results with Clear Filters, forbidden callout, safe failure with Retry, and populated results.

## 7. IT Staff Ticket Detail

- Read-only requester submission is grouped separately from operational controls.
- Operational card contains owner, IT Priority, status, and guarded Save actions.
- Claim is prominent for unassigned tickets. Reassign uses only eligible active owners.
- Destructive/terminal transitions require a confirmation modal.
- Tabs/sections: Public Comments, Internal Notes, Attachments. Public and private composers remain visually unmistakable.
- Concurrent `409` feedback explains that the ticket changed and offers Reload.

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
