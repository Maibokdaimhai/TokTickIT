# Lab 4 Engineering Specification - TokTickIT

Status: Contract merged through PR #46; Actions foundation/UI merged through PR #54/#55. Issue #50 Ticket workflow implemented and verified locally on 27 October 2026, based on staging `f8238e9`. Dashboards and final release verification remain incomplete. See [workflow evidence](ticket-workflow.md). IDs in this document are scoped to Lab 4.

Source: CPE334 Lab 4 worksheet, Sections 1-14 and grading Parts 1-9. Earlier approved behavior remains governed by [Lab 3](../lab-03/specification.md) unless a change is explicitly stated here. This contract resolves implementation choices; it does not claim instructor or peer approval.

## 1. Sprint goal

Complete the service-desk workflow with accountable Actions Taken, enforced Ticket resolution, concise role dashboards, and verified regression across Labs 1-3.

## 2. Stakeholder request

Record the actual work under each Ticket, including who performed it and any follow-up. Keep the Ticket Owner responsible for coordination while allowing other staff to contribute. Give each role a useful operational starting point and finish the product with consistent Zen Green feedback and reliable lifecycle behavior.

## 3. Scope

Included: the carried-forward mobile communication fix; Actions Taken and revision history; assignment and action status controls required by the grading rubric; final Ticket transitions and resolution gate; Requester and Staff dashboards (Administrator reuses Staff); additive migration and repeatable seeds; authentication/ownership regression; visual and accessibility evidence; final release documentation.

Excluded: SLA/escalation automation, external notifications, inventory/purchasing, billing/payroll, approval signatures, report builders/exports, multi-tenancy, production cloud operations, action file uploads, hard deletion of actions, and optional Administrator account-count cards.

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Staff/Admin can create, assign, edit, complete, and cancel Actions Taken under an accessible Ticket. |
| FR-02 | Capture action date/time, description, result, automatic performer, follow-up flag/note, attachment notes, assignee, and status; record completion of outstanding follow-up with separate immutable evidence. |
| FR-03 | The owning Requester sees all action items and their public revision history read-only; another Requester receives no data. |
| FR-04 | Retain immutable revisions and Ticket transition events with stable ordering and safe actor identity. |
| FR-05 | Enforce the final Ticket transition matrix and resolution gate in the backend; Requester resolution indication stays advisory. |
| FR-06 | Handle stale writes and duplicate retries without lost updates, duplicate actions, or partial history. |
| FR-07 | Serve backend-calculated Requester metrics and recent lists limited to the authenticated Requester's Tickets. |
| FR-08 | Serve Staff/Admin operational metrics, current-user Actions Taken, recent Tickets, and matching drill-downs. |
| FR-09 | Preserve earlier records and authorized behavior through migration, seed, rollback/recovery, and regression testing. |
| FR-10 | Extend Zen Green navigation and accessible responsive screens with complete loading/empty/error/conflict states. |
| FR-11 | Maintain requirement-to-test traceability and final-main evidence, peer review, README, and nine-part submission. |

## 5. Business rules

### Actions Taken

- **BR-01:** Each action belongs to exactly one existing Ticket. Its Ticket and original performer cannot be changed. Ticket Owner and action assignee/performer are independent.
- **BR-02:** Any active full-session IT_STAFF or ADMINISTRATOR may operate any Ticket's actions, regardless of Ticket ownership. Backend checks are mandatory. Requesters cannot write actions or transition Tickets.
- **BR-03:** `performedById` is the authenticated creator, never client-supplied. `assigneeId` is required and defaults to the creator in the UI; it must reference active IT_STAFF/ADMINISTRATOR at creation or reassignment. An editor is recorded separately on each revision; reassignment never rewrites the original performer.
- **BR-04:** Description is trimmed, 1-2000 Unicode code points. Result and follow-up note are 0-2000, attachment notes 0-1000. Follow-up note must contain at least one non-whitespace code point when `followUpRequired=true`; ordinary nonterminal edits that clear the flag save it as null. BR-23 follow-up completion instead retains the original note as historical context. Its completion note is required, trimmed, 1-2000 Unicode code points. Optional empty result/attachment notes become null. Reject unknown fields and invalid types; text is plain text, escaped on rendering.
- **BR-05:** `actionAt` is required as ISO 8601 date/time with an explicit offset, converted to UTC. It must be at or after Ticket creation and not later than backend receipt time. `createdAt`/`updatedAt`/revision time come from the backend. UI defaults action time to now and submits an explicit offset.
- **BR-06:** Action statuses are PLANNED, IN_PROGRESS, COMPLETED, CANCELLED. Creation permits PLANNED or IN_PROGRESS only. Allowed changes: PLANNED -> IN_PROGRESS/COMPLETED/CANCELLED; IN_PROGRESS -> COMPLETED/CANCELLED. COMPLETED/CANCELLED are terminal: ordinary content, assignee and status edits are read-only. BR-23 is the sole exception for recording completion of outstanding follow-up on a COMPLETED action; it does not reopen or rewrite the original work. Completing requires a nonempty result; cancelling requires a nonempty result explaining cancellation. Unchanged status permits content/assignee edits on nonterminal actions; an entirely unchanged PATCH is rejected.
- **BR-07:** Create/update actions only while Ticket is NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, or REOPENED. RESOLVED/CLOSED/CANCELLED freeze writes; reopen the Ticket first. Terminal action work fields remain immutable after Ticket reopening. Follow-up may remain outstanding on a COMPLETED action and blocks Ticket resolution until BR-23 records its completion. If follow-up is no longer needed before the action is completed, clear the flag using an ordinary nonterminal edit; its previous note remains in earlier revisions.
- **BR-08:** No action/revision/event DELETE APIs. An action update changes its current projection and appends a complete revision in one transaction. Creation appends revision 0. Revision ordering is version ascending; action ordering is createdAt ascending then id ascending, unaffected by backdated actionAt. Ticket transitions append events ordered by createdAt then id. Existing Public Comments/Internal Notes remain append-only.
- **BR-09:** Every successful action write increments Ticket version/updatedAt and action version (new action version 0). Create requires expectedTicketVersion; update requires expectedTicketVersion and expectedActionVersion. Compare under lock. Any competing Ticket/action write invalidates a stale request; losing write returns 409 with no partial changes. Retried action creates use BR-10.
- **BR-10:** Create includes a UUID `clientRequestId`, unique per actor across all Tickets. Exact replay returns the original action with 200 and `replayed=true`, even if the original write made the supplied version stale; a different payload or Ticket with the same key returns 409 IDEMPOTENCY_CONFLICT. Revalidate session and resource access before replay. Retain the key with the action and disable repeated submit while pending.

- **BR-23:** On a COMPLETED action with outstanding follow-up, any active full-session Staff/Admin may record follow-up completion while the parent Ticket is in a BR-07 writable state. This dedicated operation requires a nonempty completion note and expected Ticket/action versions. It atomically sets followUpRequired=false, retains the original followUpNote, records followUpCompletedAt/backend time, followUpCompletedById/session actor and followUpCompletionNote, appends exactly one complete revision, and increments action/Ticket versions and updatedAt. Original status, result, description, actionAt, performer and assignee do not change. Completion metadata is initially null, server-controlled except for the supplied note, and immutable after recording. Requesters may read it but cannot write it. Reject non-COMPLETED actions, absent/already completed follow-up, stale versions, and frozen parents without changes. Historical assignee ineligibility does not prevent an eligible acting Staff/Admin from recording this completion, since it creates no assignment. No ordinary PATCH may set completion metadata or clear follow-up on a terminal action. A repeated/parallel completion never appends a second revision; after refreshing, the user can see whether it already succeeded. All earlier revisions keep their original outstanding flag/note. The BR-12 gate then uses the cleared current flag; resolution still requires all other gate conditions.

### Ticket lifecycle

- **BR-11:** Keep all eight Lab 3 Ticket statuses and the transition matrix below. Only Staff/Admin can transition. No-op/illegal transitions return 400. RESOLVED/CLOSED/CANCELLED/REOPENED destinations require explicit confirmation. Entering IN_PROGRESS, WAITING_FOR_REQUESTER, or RESOLVED requires an active eligible Ticket Owner, preserving Lab 3 behavior.
- **BR-12:** A new transition into RESOLVED requires at least one COMPLETED action with a nonempty result, no PLANNED/IN_PROGRESS actions, and no non-cancelled action with `followUpRequired=true`. The gate is evaluated atomically under the same Ticket lock as action writes. Failure returns 409 RESOLUTION_BLOCKED with safe unmet-condition codes. Cancelled actions do not count as completed work or block resolution.
- **BR-13:** Requester Problem Appears Resolved records advisory feedback only, retaining Lab 3 state/duplicate restrictions. Reopening clears the current indication. Staff may resolve without that indication if BR-12 is met. Reopening retains prior actions/history; the same completed work may support re-resolution if no outstanding work/follow-up remains.
- **BR-14:** Existing RESOLVED/CLOSED Tickets with zero actions remain valid; reading and RESOLVED -> CLOSED do not retroactively require invented work. A reopened legacy Ticket must satisfy BR-12 before being resolved again. Cancellation may retain unfinished actions as historical work; they cannot be changed until the Ticket is reopened.
- **BR-15:** Preserve version/expectedStatus behavior of the existing status endpoint. Append a TicketStatusEvent for every actual status change, including NEW -> OPEN during claim, in the same transaction. No synthetic legacy events; display history as available since Lab 4 migration. Initial Ticket creation is not a transition event.
- **BR-16:** Draft compensation must additionally reject deletion when any action or transition event exists. User deactivation/role changes preserve performer/editor/assignee references; no user deletion. Existing ineligible action assignees remain displayed with an inactive/ineligible label, cannot receive new work, and require reassignment before further nonterminal edits. Coordinate eligibility checks with admin changes.

| Current | Permitted next statuses |
|---|---|
| NEW | OPEN, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| CANCELLED | REOPENED |

### Dashboards and security

- **BR-17:** Active Tickets = NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED. Requester metrics always start with requesterId=session user. Staff metrics cover all Tickets visible to Staff/Admin. No client-supplied user ID changes scope.
- **BR-18:** Requester cards: `activeTickets` (active set), `waitingForRequester` (WAITING_FOR_REQUESTER), `recentlyResolved` (current RESOLVED/CLOSED and resolvedAt in the recent window). Recent list = latest five owned Tickets by updatedAt descending, id ascending. Each card has its precise filtered list destination.
- **BR-19:** Staff cards: `unassignedTickets` (active and ownerId null), `myTickets` (active and ownerId=current actor), `myActiveActions` (assigneeId=current actor, action PLANNED/IN_PROGRESS, parent active). Status distribution includes all eight statuses; priority distribution includes only active Tickets grouped by IT priority. Recent list = latest five Tickets by updatedAt descending, id ascending. Current-user action preview = latest five matching myActiveActions by updatedAt descending, id ascending, linking to its parent and action anchor.
- **BR-20:** Recently resolved = [start of day six calendar days before today, asOf], seven Bangkok calendar dates including today. API returns asOf, timeZone=`Asia/Bangkok`, and windowStart as UTC ISO instants. Add nullable Ticket.resolvedAt: set to backend now on entering RESOLVED; retain through CLOSED; clear on REOPENED. Backfill existing RESOLVED/CLOSED with updatedAt as an explicitly approximate legacy value, identified by `resolvedAtEstimated=true`; later real resolution sets false. Other statuses start null/false. Recent cards include estimates and label this limitation.
- **BR-21:** Aggregate counts and bounded previews use one repeatable-read snapshot and one asOf. Empty data returns integer zeros for every enum bucket and empty arrays. Do not fetch entire collections for aggregation. No background auto-refresh; load on entry and explicit Refresh. Filtered list totals match the corresponding card when evaluated against unchanged data and the same supplied window boundaries.
- **BR-22:** Preserve cookies, Origin validation, password-change restriction, per-request active/role checks, no-store caching, strict positive integer IDs, safe error envelopes, and all Lab 3 authorization boundaries. Action data is public to the owning Requester, including result/follow-up/attachment notes and revision history; private content belongs only in Internal Notes. Never expose password/session/seed keys, idempotency keys, or filesystem paths.

## 6. UI summary and authorization

See [ui-spec.md](ui-spec.md) for routes, forms, states, and visual checklist; [api-spec.md](api-spec.md) defines exact wire contracts.

| Capability | Requester | IT Staff | Administrator |
|---|---|---|---|
| Requester dashboard | Own only | 403 | 403 |
| Staff dashboard/queue | 403 | All Tickets | All Tickets |
| Action/history read | Own Ticket only; other/missing identical 404 | All Tickets | All Tickets |
| Action create/edit/assign/status | 403 before resource lookup | BR-03 through BR-10 | Same |
| Ticket transitions | 403 | BR-11 through BR-15 | Same |
| Internal Notes | Forbidden, no content/counts | Existing access | Existing access |
| User management | 403 | 403 | Existing safeguards |

## 7. Data changes and migration decisions

Proposed Prisma concepts (implementation must use a new forward migration after the current latest migration):

| Model/field | Type and constraints | Purpose |
|---|---|---|
| ActionTaken | id Int PK; ticketId FK RESTRICT; performedById/assigneeId User FKs RESTRICT; actionAt DateTime; description VarChar(2000); result Text?; followUpRequired Boolean; followUpNote Text?; attachmentNotes Text?; status ActionStatus; version Int default 0; createdAt/updatedAt DateTime | Current work projection, with application code-point validation |
| ActionTaken follow-up completion | followUpCompletedAt DateTime?; followUpCompletedById User FK RESTRICT?; followUpCompletionNote Text?; all null until BR-23 | Immutable completion evidence separate from original work and retained followUpNote |
| ActionTaken retry identity | clientRequestId UUID, canonicalRequest Text, unique(performedById, clientRequestId), seedKey String? unique | Durable replay, exact normalized payload comparison, repeatable lab seeds; never serialize retry fields |
| ActionTakenRevision | id Int PK; actionId FK RESTRICT; version Int; editorId User FK RESTRICT; createdAt; full scalar action snapshot including assignee/performer IDs, actionAt, text/flags/status and nullable follow-up completion time/actor ID/note; unique(actionId, version) | Immutable public edit history, original author stays intact |
| TicketStatusEvent | id Int PK; ticketId FK RESTRICT; actorId User FK RESTRICT; fromStatus/toStatus TicketStatus; createdAt; ticketVersion Int; unique(ticketId, ticketVersion) | Append-only transition audit |
| Ticket additions | resolvedAt DateTime?; resolvedAtEstimated Boolean default false | Recent-resolution metric independent of unrelated updates |
| LabMetadata | key String PK; recordedAt DateTime; one immutable lab4-history-start row inserted by migration | Stable historyStartsAt even after application restart or empty history |

Indexes: ActionTaken(ticketId, createdAt, id), ActionTaken(assigneeId, status, updatedAt, id), ActionTakenRevision(actionId, version), TicketStatusEvent(ticketId, createdAt, id), Ticket(requesterId, status, resolvedAt), Ticket(status, resolvedAt). Preserve existing indexes. New instant fields use Prisma DateTime with PostgreSQL timestamptz(3), serializing UTC; preserve existing timestamps without destructive conversion. No SQL CHECK may assume an assignee remains active forever; enforce eligibility transactionally. Text limits and conditional result/follow-up rules need matching backend validation, not database types alone.

Decisions: (1) A current projection plus immutable revisions supports usable edits and the rubric's append-only audit requirement without rewriting history. (2) Separate assignee and performer avoids falsely changing who originally recorded work. (3) A dedicated resolution timestamp avoids counting unrelated comment activity as a fresh resolution; labelled legacy estimates avoid inventing precise history. (4) Reuse the Ticket version as the parent serialization boundary, accepting occasional retries rather than lost cross-record updates.

Concurrency: for action create/update lock relevant User rows in ascending ID, then Ticket, then action; recheck current eligibility/versions under locks. Admin role/deactivation operations must follow the same User -> Ticket order when interacting with assignments. Resolution/claim/status operations lock/revalidate an eligible owner before Ticket; if ownership changed before the lock, return 409 and retry rather than taking a new User lock after Ticket. Child writers and resolution both lock the parent Ticket. Transactions atomically save projection, revision/event, resolution metadata, and version. DB failures roll everything back.

Migration/recovery procedure: snapshot a disposable clone with legacy records/counts and attachment references; apply migration with existing migration tooling; compare original IDs, values, relationships, and file availability; assert zero invented actions/revisions/events; test legacy resolution behavior. Run seeds twice and compare seed-owned logical records and counts without overwriting user-created data. On failure, roll back the transaction where possible; otherwise stop writes and restore the pre-migration DB backup with the matching Lab 3 application. Document this as recovery, not a guaranteed lossless downgrade after new Lab 4 writes. Rehearse restore on a separate disposable DB; never drop/reset development data.

Seed fixtures: two Requesters with separate Tickets; multiple Staff plus Administrator and inactive/ineligible accounts; all Ticket statuses/priorities, assigned/unassigned; zero/one/multiple actions, every action status, follow-up blockers, zero and nonzero metric scenarios; boundary timestamps and equal-time tie cases. Lab 4 seed-owned actions/revisions/events must be idempotent and isolated by stable keys/relationships. Preserve earlier credentials and Lab 3 seed behavior; no credentials in evidence.

## 8. API summary

Add action list/create/update/history and Ticket transition-history reads; add Requester/Staff dashboard endpoints; extend existing list filters for exact card drill-downs. Retain existing paths and response wrappers. Full details and validation are in [api-spec.md](api-spec.md).

## 9. Acceptance criteria

| ID | Observable criterion |
|---|---|
| AC-01 | Staff creates an action on the correct Ticket with automatic performer and eligible, independently assigned staff; Requester write is denied. |
| AC-02 | Validation rejects malformed dates/IDs/text, missing follow-up note, invalid/inactive assignees, and invalid terminal results without any saved changes. |
| AC-03 | Nonterminal action edits/assignment/status changes append exactly one immutable revision; ordinary terminal writes fail, while BR-23 appends follow-up completion evidence without rewriting original work or prior revisions; list/history order is stable. |
| AC-04 | Requester sees every action on own Ticket read-only, sees no Internal Notes or secrets, and other/missing Ticket responses are identical. |
| AC-05 | Stale/parallel writes and retries produce one winner or exact replay, no lost update, no duplicate action, no orphan history. |
| AC-06 | Every Ticket status pair is tested against the matrix; owner/confirmation checks and immutable events apply, including claim. |
| AC-07 | Resolution bypass requests fail until completed work, no active work, and no remaining follow-up exist; advisory indication never resolves a Ticket. Completing an action with outstanding follow-up, recording BR-23 completion, and then resolving the Ticket succeeds with history retained. |
| AC-08 | Legacy resolved Tickets can close without invented actions; reopened Tickets obey the new gate; current indication/metadata reset correctly. |
| AC-09 | Requester metrics/lists match database queries, scoped to the session, including zeros and Bangkok date boundaries. |
| AC-10 | Staff/Admin metrics, priority/status buckets, and current-user action preview match authoritative database queries. |
| AC-11 | Every card drill-down applies its exact scope/filter/window; reload/back preserves filters and stale requests cannot overwrite newer results. |
| AC-12 | Migration preserves prior records/files, repeated seeds are stable, and backup recovery is rehearsed on disposable databases. |
| AC-13 | Authentication, roles, Ticket operations, attachment compensation, comments/notes, and admin safeguards from earlier labs continue to work except documented resolution changes. |
| AC-14 | New forms retain drafts after safe failures/conflicts, prevent repeat submit, and all screens show appropriate loading/empty/forbidden/not-found states. |
| AC-15 | Desktop/tablet/mobile, keyboard, labels, focus, contrast, touch targets, and direct clipping checks meet ui-spec.md with recorded visual evidence. |
| AC-16 | Bounded dashboard payloads and indexed queries pass the documented performance smoke test without exposing secrets. |
| AC-17 | Final main passes relevant suites/builds; every AC maps to tests and real evidence; reviewed release and nine-part report are complete. |

## 10. Product Definition of Done

- [ ] Contract and every AC reviewed before feature implementation; meaningful changes recorded in PR history.
- [ ] Actions Taken, lifecycle, role dashboards, and drill-downs meet this contract and peer review.
- [ ] New migration/seed/recovery checks pass without altering development data.
- [ ] Unit/API/UI/style/security/concurrency/regression/E2E/performance checks pass on final main; no historical counts presented as new execution.
- [ ] Visual/keyboard checklist complete at all specified widths with readable screenshots and tested commit.
- [ ] README setup, environment, migration, seed, tests, recovery and demo instructions verified; .gitignore excludes secrets/generated runtime files.
- [ ] All sprint Issues Done with actual review identities, PR links, feedback/responses/approvals in reviewer.md.
- [ ] Genuine 6-10 selected prompts and personal reflection in ai-use.md.
- [ ] Feature branches reviewed into lab4-staging, then reviewed release into main; final-main SHA captured.
- [ ] One concise PDF with working links and Answer Part 1 through Answer Part 9, mapped to the worksheet's grading evidence.

## 11. Assumptions, decisions, and delivery order

Draft decisions needing review before coding: the worksheet gives no action status enum, precise resolution gate, date limits, dashboard window, or terminal edit policy. BR-05/06/07/12/20/23 define these choices, including the narrowly permitted follow-up completion operation on completed work. Rubric Part 6 explicitly requires assign/status/complete/cancel and inactive-assignee rejection, so those are included even though the earlier field list omits them. Part 7 asks for append-only behavior; this contract applies that to transition events and action revisions while permitting the explicitly requested action updates. All action content/history is Requester-visible per Section 8.3; keep private work in Internal Notes.

Known baseline gaps from source inspection: Requester status filtering currently accepts only four statuses; Requester sorting lacks updatedAt; Staff lists do not yet accept grouped active-status or action-assignee filters. Implement these extensions explicitly rather than shipping dashboard links that silently drop their filters. Playwright currently discovers only e2e/lab-03; discovery must be expanded deliberately and verified without dropping earlier tests.

Proposed remaining Issues/branches, after merged feature/lab4-lab3-tech-debt:

1. feature/lab4-spec-and-tests: this contract and planned traceability.
2. feature/lab4-actions-foundation: schema, migration/recovery/seed, action APIs, history, authorization and concurrency tests.
3. feature/lab4-actions-ui: Staff editors, Requester read view, public-history warning, component tests.
4. feature/lab4-ticket-workflow: resolution gate, metadata/events, compensation guard, backend/UI transition tests.
5. feature/lab4-dashboards: aggregate APIs, list/filter extensions, both role screens, query oracle and drill-down tests.
6. test/lab4-regression-and-evidence: E2E discovery, all-lab regression, visual/accessibility and performance evidence.
7. docs/lab4-final-evidence-release: actual review/AI records, README, release verification and submission.

This list is a local plan; no GitHub Issues/PRs or pushes are created by this documentation task.

Issue #48 implementation and migration/recovery details: [Actions foundation](actions-foundation.md). Current executed coverage is recorded in tests.md Section 8; the complete product Definition of Done above remains pending.

Issue #49 shared Actions UI is implemented locally from merged PR #54; see [Actions UI notes](actions-ui.md) and tests.md Section 9. Later Ticket workflow, dashboards and full release verification remain pending.
