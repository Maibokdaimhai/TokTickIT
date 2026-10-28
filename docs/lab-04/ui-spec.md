# Lab 4 UI Contract - TokTickIT

Status: Lab 4 features merged through PR #57. Issue #52 local rendered checks and corrections are recorded in [regression evidence](regression-and-evidence.md); final-main/release inspection remains pending. Reuse [Lab 2 tokens](../lab-02/ui-spec.md) and [Lab 3 conventions](../lab-03/ui-spec.md). Behavior and scope follow [specification.md](specification.md); exact filters and responses follow [api-spec.md](api-spec.md).

## 1. Shell, navigation, and routes

Add Dashboard to each permitted role's navigation. Login/default-home/Return Home route to `/dashboard` for Requester and `/staff/dashboard` for Staff/Admin, unless password change is mandatory. Preserve explicit permitted deep links, all earlier routes, browser history synchronization, active-page labels and logout. Administrator retains User Management and Staff Queue navigation. Header must wrap without hiding controls on mobile.

| Route | Screen and permitted role |
|---|---|
| /dashboard | Requester Dashboard, REQUESTER |
| /staff/dashboard | Staff Dashboard, IT_STAFF/ADMINISTRATOR |
| /staff/actions?assignee=me&statusGroup=active | Paginated My Active Actions, Staff/Admin |
| /staff/tickets/:id | Existing Staff Detail plus Actions Taken and transition history |
| /tickets/:id | Existing owned Requester Detail plus read-only Actions Taken and history |

Unauthorized routes use the existing forbidden screen and permitted-home action. Malformed IDs/filters show safe validation. Ticket 404 does not identify whether it belongs to someone else. Action anchors use `?actionId=ID`; load the selected item via authorized GET rather than assuming it is on the first page.

## 2. Requester Dashboard

Heading, explicit Refresh button, as-of time labelled Asia/Bangkok; three cards labelled Active Tickets, Waiting for You, Recently Resolved (Last 7 Calendar Dates). Include a short date-range label; show an estimate note when recentlyResolvedIncludesEstimates. Recent Tickets shows up to five ticket number, summary, text status, IT priority and last updated time. Keep My Tickets and Create Ticket readily accessible.

Each metric links to the exact filtered list in api-spec.md, including zero-count cards (useful empty result). Recent items open own Ticket Detail. Do not show anyone else's records or duplicate the complete My Tickets list. Waiting card explains that staff is waiting for Requester input; no automatic status change is implied.

## 3. Staff/Admin Dashboard

Heading, as-of and Refresh; cards Unassigned Active Tickets, My Active Tickets, My Active Actions. Separate text-labelled status and active IT-priority distributions; counts are links with meaningful accessible names. Recent Tickets and My Active Actions previews contain up to five items each. Action preview shows description, assignee, action status and parent Ticket number; its item opens the selected action in Staff Detail. The My Active Actions card opens the paginated filtered action list. Administrator sees their own assigned work in My cards.

No SLA clocks or invented urgency scores. Priority ordering URGENT, HIGH, MEDIUM, LOW. Status display order NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED. Zero buckets remain visible. Counts come directly from the backend, not client aggregation of preview arrays.

## 4. Actions Taken

Staff Detail gains an Actions Taken section with paginated chronological items; use cards on narrow screens. Show Action Date/Time, description, result, Performed by, Assigned to, status, follow-up flag/note, attachment notes, created/updated time. Performed by is always read-only. Keep primary Ticket Owner visible independently. Clearly label: "Actions and their history are visible to the Requester. Use Internal Notes for private information."

Create and Edit use a labelled inline form to avoid nested-dialog complexity. Create defaults performer/assignee to session user, time to now, status to PLANNED, follow-up false. Assignee dropdown contains eligible Staff/Admin; performer is text, not an editable dropdown. Label Action Date/Time with Asia/Bangkok and convert explicitly to/from offset ISO. Date cannot precede Ticket creation or be in the future. Show text counters and required markers with linked inline errors. Follow-up Note becomes required/visible when checked and is cleared on successful save when unchecked. Attachment Notes is plain text referring to existing files, with no upload control or automatic unsafe links.

Nonterminal actions offer Edit and only permitted status destinations. Complete/Cancel require confirmation displaying result text and validation if it is blank. Terminal actions show original work as Read only and no ordinary Edit/assignment/status controls. A COMPLETED action with outstanding follow-up and a writable parent additionally offers Record Follow-up Completion; CANCELLED actions and completed follow-ups do not offer it. The completion form requires a 1-2000-code-point note and explains that the original work and follow-up note remain in history. Confirming calls the dedicated endpoint with current versions, disables repeat submission, retains the note on recoverable failure/conflict, and refreshes authorized data before any retry. After success show Follow-up completed, the original follow-up note, completion note, backend time and completing user to both Staff and the owning Requester. No editable completion identity/time fields appear. A historical inactive assignee does not hide this operation from eligible acting staff. Frozen parent shows "Reopen the Ticket before recording more work." Ineligible saved assignee remains visible with a warning and requires an eligible replacement on edit. Do not silently substitute another person.

Save disables repeated clicks; one UUID persists for the create draft across uncertain failure/retry. Generate a new UUID only after successful completion or deliberately starting a new draft. PATCH conflicts refresh latest item and Ticket versions and show comparison guidance; preserve unsaved text separately, never automatically resubmit with a fresh version. On failed save or assignee-list fetch, retain all draft fields and offer explicit retry. Warn before abandoning a dirty form. On 401 clear protected content and use login flow; do not persist sensitive drafts in localStorage.

Success replaces the current projection, refreshes Ticket version/status and visible lists, announces success, and returns focus to a meaningful item heading. A replay response is success with no duplicate item. Requester Detail shows all items, including cancelled ones, and public revisions read-only. No create/edit/assign/status buttons appear for Requesters.

Each item has View History: paginated immutable snapshots in version order, with editor/time and status. Ticket History lists actual transition events in stable order and displays "History available since [migration time]"; empty legacy history is an honest empty state. No edit/delete controls for history, Public Comments, or Internal Notes.

## 5. Ticket workflow feedback

Keep only matrix-permitted destinations. Confirmation names the destination for Resolve, Close, Cancel and Reopen. Explain resolution blockers: no completed work with a result, active actions remaining, or outstanding non-cancelled follow-up. For a completed action with pending follow-up, offer Record Follow-up Completion; after that succeeds, refresh Ticket version and gate feedback so a separate permitted Resolve can succeed. Show the completion in history without replacing its earlier outstanding state. UI guidance supplements the authoritative API; a stale gate may still return 409. On success refresh summary status and transition history. Show resolution date with an Estimated label for backfilled records. Requester Problem Appears Resolved remains clearly advisory.

## 6. Shared state behavior

| State | Required behavior |
|---|---|
| Initial loading | Skeleton or role=status; no fake zero metrics or stale protected data |
| Empty/no results | Distinguish no records from filtered no matches; relevant permitted next action |
| Refresh failure | Retain labelled stale prior dashboard data and as-of time; explicit retry, no zero replacement |
| Initial API failure | Safe error message and Retry; no stack traces or raw payloads |
| Forbidden/not found | Existing safe screen, correct role home, no private content |
| Validation | Field-linked errors plus summary, preserve fields, focus first error |
| Conflict | Preserve draft, refresh authorized data, require explicit reconciliation |
| Success | Announce through aria-live, refresh dependent view, maintain logical focus |
| Navigation/filter change | URL matches state, reset pagination when filter changes, ignore old network results |

## 7. Zen Green, responsive and accessibility rules

Use existing token values and type scale; primary green #006B3C, secondary #0B7A46 and existing semantic text/background colors remain inherited. New action status badges always include text; private Internal Notes stay visibly distinct from shared Actions/Public Comments. Do not introduce a new component library. Standard text contrast >=4.5:1; large text and interactive boundaries >=3:1. Verify actual rendered colors rather than relying on token names.

Test 320x900, 390x844, 820x1180, 1440x900. Cards use an auto-fit grid whose minimum cannot exceed available parent width. Long descriptions, names, timestamps, result/attachment notes and labels wrap. Textareas use border-box, min-width 0, max-width 100%; action rows wrap. Preserve the already merged communication fix. Major controls have >=44x44 CSS-pixel targets; nearby small text links need adequate target/padding. No clipping, overlap or horizontal page scrolling at any required width or 200% zoom.

Semantic headings/landmarks, native labelled controls, explicit button types, visible keyboard focus, accessible loading/error/success announcements, text-only status cues, and logical tab order are required. Any existing confirmation modal must trap focus, support Escape where cancellation is allowed, label itself and return focus on close. Respect reduced motion. Focus must not disappear when a saved item changes layout.

## 8. Evidence checklist (product-wide completion still pending)

- [x] Dashboard/role navigation, login home and deep links for all three roles (component tests and real Chromium feature scope; full release inspection pending).
- [x] Requester/Staff dashboards: accurate nonzero/zero data, loading, failure, forbidden and drill-down (SQL-oracle/API/component tests plus three real browser scenarios; tests.md Section 11).
- [x] Actions: list, create, assign, edit, complete, cancel, record follow-up completion on completed work, public history and Requester read view (component/App checks and controlled-API Chromium coverage; selected real backend workflows now covered in Issue #50; full release E2E remains pending).
- [x] Workflow: permitted/blocked/stale transitions, resolution gate and legacy case (Issue #50 API/component tests and three real-backend Chromium scenarios; see tests.md Section 10).
- [x] Existing communication panels and new screens at four widths; direct bounds and contained table scrolling checked in Issue #52 local evidence.
- [x] Long content/names, sampled keyboard flows/modal focus, accessible names, rendered contrast, 44px targets, reduced motion and 200% equivalent reflow checked locally; scope/limits in regression-and-evidence.md.
- [x] Safe failure/draft retention and links exercised; no uncaught page errors in new Requester/Staff render journeys. Expected HTTP failures and final-main limits are recorded explicitly.

Store new evidence under `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow,regression}/`. Record tested commit, role, viewport, scenario, browser and result in tests.md. Actions, workflow and dashboard screenshots now exist for their documented local scope; final release regression captures remain pending.
