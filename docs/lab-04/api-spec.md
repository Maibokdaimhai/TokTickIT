# Lab 4 REST API Contract - TokTickIT

Status: Draft, not implemented. Base `/api`. Inherit [Lab 3 authentication, errors, and retained APIs](../lab-03/api-spec.md). [Business rules](specification.md) are normative; identifiers here are Lab 4 scoped.

## 1. Shared protocol

Cookie credentials, exact allowed Origin on unsafe methods, no-store protected responses, per-request active-role/password-change checks, strict IDs, and safe JSON errors remain unchanged. Sequence: Origin (unsafe routes), session, password-change gate, role, resource/ownership, input/business checks. Requester action writes fail 403 before resource lookup. For readable resources, another Requester's Ticket and an absent Ticket return identical 404 `{error:{code:"NOT_FOUND",message:"Ticket not found"}}`.

IDs are integers 1..2147483647; expected versions are integers 0..2147483647, no numeric strings in JSON. Dates serialize as UTC ISO strings. Reject unknown/array query parameters and unknown JSON body fields. JSON body limit stays 64 KiB; malformed JSON 400 and oversized JSON 413. Unsupported paths/methods return safe 404. Logs never include cookies, passwords, text content, retry payloads, or filesystem paths.

Error envelope: `{error:{code:string,message:string,details?:{field:string,message:string}[]}}`. Statuses: 400 invalid input/transition/confirmation/assignee; 401 invalid session; 403 role/Origin/password restriction; 404 missing/inaccessible resource; 409 concurrency/state/retry/resolution conflict; 413 oversized body; 500 safe unexpected failure. Inherited login throttling remains 429.

| Code | Status | Meaning |
|---|---:|---|
| VALIDATION_ERROR / BAD_REQUEST | 400 | Field/body/query shape or limits invalid |
| INVALID_ASSIGNEE | 400 | Target missing, inactive, or not staff/admin |
| INVALID_ACTION_TRANSITION | 400 | Illegal/no-op action transition or entirely unchanged edit |
| INVALID_STATUS_TRANSITION / OWNER_REQUIRED / CONFIRMATION_REQUIRED | 400 | Existing Ticket policy |
| VERSION_CONFLICT / STATUS_CONFLICT | 409 | Expected Ticket/action version or Ticket status stale |
| ACTION_READ_ONLY / TICKET_READ_ONLY | 409 | Action terminal or parent frozen |
| IDEMPOTENCY_CONFLICT | 409 | Retry key reused for different canonical create |
| RESOLUTION_BLOCKED | 409 | Resolution gate unmet; details.field is completedAction, activeActions, or followUp |

409 responses do not leak current resource bodies; the client refreshes authorized GETs and preserves its draft. A failed transaction must not create a revision/event or increment a version.

## 2. Shared shapes

Specification notation, not implementation files:

```ts
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Identity = {
  id: number; name: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean;
};
type Action = {
  id: number; ticketId: number; actionAt: string;
  description: string; result: string | null;
  performedBy: Identity; assignee: Identity;
  followUpRequired: boolean; followUpNote: string | null;
  attachmentNotes: string | null; status: ActionStatus; version: number;
  createdAt: string; updatedAt: string;
};
type Revision = {
  id: number; actionId: number; version: number; editor: Identity;
  createdAt: string;
  snapshot: {
    actionAt: string; description: string; result: string | null;
    performedById: number; assigneeId: number; followUpRequired: boolean;
    followUpNote: string | null; attachmentNotes: string | null;
    status: ActionStatus;
  };
};
type TransitionEvent = {
  id: number; ticketId: number; fromStatus: TicketStatus; toStatus: TicketStatus;
  actor: Identity; createdAt: string; ticketVersion: number;
};
type Page = { page: number; limit: number; totalItems: number; totalPages: number };
type TicketPreview = {
  id: number; ticketNumber: string; summary: string; status: TicketStatus;
  itPriority: Priority; owner: {id:number; name:string} | null; updatedAt: string;
};
type ActionPreview = Action & { ticket: TicketPreview };
```

TicketStatus/Priority retain the Lab 3 enums. Identity represents current safe account identity; immutable snapshots retain original IDs, not historical name/role claims. No emails are required in new action/history projections. Requester shapes never contain Internal Notes/counts. Add `resolvedAt:string|null` and `resolvedAtEstimated:boolean` to existing TicketRow/Detail shapes, preserving existing fields and wrappers. Action writes return parent version explicitly; use separate list endpoints rather than embedding unbounded histories in Ticket Detail.

## 3. Actions Taken

### GET /tickets/:id/actions

Owning Requester or Staff/Admin. Optional page (default 1), limit (10 default, allowed 10/20/50). Returns 200 `{actions:Action[],pagination:Page,ticketVersion:number}` ordered createdAt ASC, id ASC. Empty list: actions=[], totalItems=0, totalPages=0; valid out-of-range page returns [] and unchanged totals. Ticket ownership checked even when no actions exist.

### GET /tickets/:id/actions/:actionId/revisions

Same read roles and Ticket check; action must belong to Ticket, otherwise 404 `{error:{code:"NOT_FOUND",message:"Action not found"}}` for authorized Ticket readers. Same pagination as action list. Returns 200 `{revisions:Revision[],pagination:Page}` ordered version ASC. Creation revision is included. All snapshot text is public to the owning Requester.

### POST /staff/tickets/:id/actions

Staff/Admin. Required body fields: `clientRequestId` (UUID), `expectedTicketVersion`, `actionAt`, `description`, `assigneeId`, `followUpRequired`, `status` (PLANNED/IN_PROGRESS). Optional `result`, `followUpNote`, `attachmentNotes` accept string/null; normalization and bounds follow BR-04/05. Reject performer/editor IDs, server timestamps, ticketId, and version fields not specified here.

```json
{
  "clientRequestId": "fbfe8033-9b10-4b0c-a7a9-45ac46dba970",
  "expectedTicketVersion": 3,
  "actionAt": "2026-10-27T09:00:00+07:00",
  "description": "Inspect the network connection",
  "assigneeId": 7,
  "followUpRequired": true,
  "followUpNote": "Confirm connectivity with the Requester",
  "attachmentNotes": "See the existing router photograph",
  "status": "IN_PROGRESS"
}
```

201 `{action:Action,ticketVersion:number,replayed:false}`. Exact retry: 200 `{action:Action,ticketVersion:number,replayed:true}` using the current projection and current parent version, not an old serialized response. Original creation is not repeated. Compare the original normalized semantic create fields and Ticket ID, excluding expectedTicketVersion/clientRequestId; retain canonical representation in DB. Retry-key reuse with a different semantic payload returns 409. Recognize valid exact replay after resource authorization but before stale-version/frozen-state checks; no new write occurs. A new key on a frozen parent fails TICKET_READ_ONLY.

### PATCH /staff/tickets/:id/actions/:actionId

Staff/Admin. Require `expectedTicketVersion` and `expectedActionVersion`, plus at least one of actionAt/description/result/assigneeId/followUpRequired/followUpNote/attachmentNotes/status. Validate the merged state, not just supplied fields. Changing followUpRequired to false clears followUpNote. If current assignee is ineligible, the patch must choose an eligible assignee. No parent/performer change. Verify parent-action association before writing.

200 `{action:Action,ticketVersion:number}` with one new revision and action version+1. A repeated stale PATCH returns 409 VERSION_CONFLICT; the client refreshes and checks whether the intended state already committed. Terminal-parent and terminal-action rules, completion/cancellation result requirements, and assignee validation are enforced on the backend.

### Eligible assignees

Reuse GET `/staff/eligible-owners` with its existing `{owners:[...]}` shape and active Staff/Admin filtering. Revalidate eligibility in the action transaction; the dropdown is not authority. No new action upload/download/delete endpoint: attachment notes are plain references to existing Ticket attachments and confer no additional file access.

## 4. Ticket workflow and history

Keep PATCH `/staff/tickets/:id/status` body `{status,expectedStatus,expectedVersion,confirmed?}` and `{ticket:StaffTicketDetail}` response. Enforce the full matrix and resolution gate from specification.md; status and version conflicts precede transition/gate checks. On successful status change atomically update resolvedAt/estimated flag and append event with resulting Ticket version. Existing POST claim also appends an event when it changes NEW to OPEN. Owner/priority changes do not create transition events.

GET `/tickets/:id/status-history`: owning Requester or Staff/Admin, page/limit as action list; 200 `{events:TransitionEvent[],pagination:Page,historyStartsAt:string}`. historyStartsAt is the recorded Lab 4 migration instant, not a claim of complete legacy history. No writes to history directly. Requester Problem Appears Resolved and existing Public Comment/Internal Note/attachment APIs remain unchanged; compensation deletion gains the action/event guard.

## 5. Dashboards

GET `/dashboards/requester`: REQUESTER only. GET `/dashboards/staff`: IT_STAFF/ADMINISTRATOR only. No query parameters accepted. Aggregate under a repeatable-read snapshot; asOf captured once from backend time. All counts are nonnegative integers, not formatted strings. Dashboard response contains summary counts and at most five entries in each preview.

Requester 200:

```ts
{
  asOf: string; timeZone: "Asia/Bangkok"; windowStart: string;
  metrics: { activeTickets:number; waitingForRequester:number; recentlyResolved:number };
  recentlyResolvedIncludesEstimates: boolean;
  recentTickets: TicketPreview[];
}
```

Staff 200:

```ts
{
  asOf: string; timeZone: "Asia/Bangkok"; windowStart: string;
  metrics: { unassignedTickets:number; myTickets:number; myActiveActions:number };
  byStatus: Record<TicketStatus, number>;
  byItPriority: Record<Priority, number>;
  recentTickets: TicketPreview[]; myActions: ActionPreview[];
}
```

All metric predicates, windows and ordering are BR-17 through BR-21. `recentlyResolvedIncludesEstimates` is true iff at least one counted record is estimated. No matches returns zeros for all metrics/buckets and empty arrays, never 404 or missing keys. Safe failure is 500, never a fabricated all-zero success. Staff metric identity is the logged-in actor even for Administrator. Queries never use client requester/assignee IDs to choose dashboard scope.

## 6. Filtered drill-down contract

Existing list defaults and old filters stay valid. New filters combine with existing filters using AND; query values are scalar, not arrays. Empty new filters are invalid. New `statusGroup=active` is mutually exclusive with `status`. `resolvedFrom`/`resolvedTo` must both be present as valid offset ISO instants with from <= to and are inclusive; they filter current RESOLVED/CLOSED and resolvedAt within the range. Unknown enum/sort/group is 400. IDs never override session ownership. Extend Requester `status` to all eight enums and add `sort=updatedAt_desc` with id ASC tie-breaker. Preserve the earlier four sort modes and existing requested-priority semantics.

| Source | Destination route | List API query / predicate |
|---|---|---|
| Requester active | /my-tickets?statusGroup=active | GET /tickets?statusGroup=active |
| Requester waiting | /my-tickets?status=WAITING_FOR_REQUESTER | GET /tickets?status=WAITING_FOR_REQUESTER |
| Requester recently resolved | /my-tickets?resolvedFrom=...&resolvedTo=... | GET /tickets with returned windowStart and asOf (URL encoded) |
| Staff unassigned | /staff/tickets?statusGroup=active&owner=unassigned | GET /staff/tickets with same filters |
| Staff my Tickets | /staff/tickets?statusGroup=active&owner=me | GET /staff/tickets with same filters |
| Staff status bucket | /staff/tickets?status=ENUM | GET /staff/tickets?status=ENUM |
| Staff priority bucket | /staff/tickets?statusGroup=active&itPriority=ENUM | GET /staff/tickets with same filters |
| Staff my active actions | /staff/actions?assignee=me&statusGroup=active | New action list below |
| Recent Ticket item | /tickets/:id or /staff/tickets/:id | Existing authorized detail |
| My action item | /staff/tickets/:id?actionId=ACTION_ID | Existing detail plus fetch action list page containing the action |

GET `/staff/actions`: Staff/Admin; permits only `assignee=me` and `statusGroup=active` (both required), page and limit (10 default, 10/20/50). Uses BR-19 myActiveActions predicate, order updatedAt DESC/id ASC; 200 `{actions:ActionPreview[],pagination:Page}`. No unrestricted analytics/action report builder is added. Opening a specific action from a preview may use new GET `/tickets/:id/actions/:actionId` (same roles/association rules as list), returning `{action:Action,ticketVersion:number}` to avoid fetching all pages; the selected card and history can be shown above the paginated list.

UI reads/writes filters through URLSearchParams, validates direct URLs, resets page on filter changes, retains filters through refresh/back, and cancels or ignores stale responses. Drill-down totals are live and may change after dashboard asOf; show refresh guidance instead of promising a frozen database view.
