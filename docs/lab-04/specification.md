# Lab 4 Engineering Specification - TokTickIT

Status: Lab 4 release PR #60 merged into main at `51d0d7aeef13097376a9e3fd98bcaea670d8f191`. Actual-main verification has executed and found a compiled-startup blocker despite passing suites/builds. See [final-main verification](final-main-verification.md). The separately tested build correction awaits reviewed integration and updated-main verification; Issue #53 remains open. PDF preparation is the final step afterward. IDs are scoped to Lab 4.

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
| FR-11 | Maintain requirement-to-test traceability and final-main evidence, peer review, and README; prepare the nine-part submission after main integration and final verification. |

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
| AC-17 | Final main passes relevant suites/builds; every AC maps to tests and real evidence; reviewed release is complete. Prepare the nine-part report afterward as the final submission step. |

## 10. Product Definition of Done

Status checked after the actual-main run on 31 October 2026. Release integration and suite execution have completed; the compiled-startup defect prevents an all-pass release. Branch correction results are separate from main results.

- [x] Contract and AC coverage reviewed before feature implementation; PR #46 feedback and approval are recorded in [reviewer.md](reviewer.md).
- [x] Actions Taken, lifecycle, role dashboards, and drill-downs implemented and peer-reviewed through PRs #54–57; PR #58 regression/safety corrections are also approved and merged into `lab4-staging`. See [reviewer.md](reviewer.md).
- [x] Additive migration, repeatable seed, and restore-recovery checks recorded on disposable targets, preserving development data. See [tests.md Section 8](tests.md#8-issue-48-foundation-execution) and [Section 10](tests.md#10-issue-50-ticket-workflow-execution) and [Actions foundation](actions-foundation.md).
- [ ] Fully passing updated-main release, including compiled startup. On actual main `51d0d7a`, backend/client/browser/recovery/performance/typechecks/builds passed, but `npm start` failed. The branch correction passes its startup regression and full backend suite; verify the corrected merged-main SHA before checking this item. See [execution and blocker](final-main-verification.md).
- [x] Local rendered visual/keyboard evidence recorded at the specified widths, with contrast, labels, focus, target sizes, long content, and zoom-equivalent reflow checks. See [regression evidence](regression-and-evidence.md) and [rendered results](../../artifacts/lab-04/verification/rendered-accessibility.json). This is scoped evidence, not formal accessibility certification or native toolbar zoom; repeat required checks for final release.
- [x] README updated for Lab 4 setup, environment, migration, both seeds, tests, recovery, and demo. Commands and local links checked against repository scripts/configuration; `.gitignore` exclusions checked for secrets/generated runtime files. See [README](../../README.md). The new main run rehearsed migrations/bootstrap/both seeds on a disposable database. Installed dependencies were reused; a fresh npm installation was not claimed. Compiled startup remains the specific release blocker above.
- [ ] All sprint Issues Done, including Issue #53 release work. Actual review identities, PR links, complete feedback/responses, and approvals for completed increments are recorded in [reviewer.md](reviewer.md).
- [x] Ten selected prompt entries and the student-edited reflection are present in [ai-use.md](ai-use.md); the student remains responsible for the final submission's accuracy.
- [x] Reviewed release from `lab4-staging` into `main`: [PR #60](https://github.com/Maibokdaimhai/TokTickIT/pull/60), approved by Kawi-HBLI, merged at `51d0d7aeef13097376a9e3fd98bcaea670d8f191`. [Main execution record](final-main-verification.md) captures the SHA and results; correction integration is still required for an all-pass release.

Submission after release (outside this documentation PR): once integration into `main` and final-main verification are complete, prepare one concise PDF with working links and Answer Part 1 through Answer Part 9, mapped to the worksheet's grading evidence. The PDF is the last submission step.

## 11. Assumptions, decisions, and delivery order

### Original planning context

Before implementation, the worksheet left the Action status enum, precise resolution gate, date limits, dashboard window, and terminal edit policy to be defined. BR-05/06/07/12/20/23 record the choices reviewed in PR #46, including the dedicated follow-up completion operation on completed work. Rubric Part 6 requires assign/status/complete/cancel and inactive-assignee rejection. Part 7 requires append-only history; the implementation preserves transition events and Action revisions while permitting the specified Action updates. All Action content/history is Requester-visible per Section 8.3; private work belongs in Internal Notes.

The original baseline inspection identified incomplete Requester status/sort filters, missing grouped active-status and Action-assignee filters, and browser discovery restricted to Lab 3. The dashboard increment implemented the required filter extensions, and the regression increment expanded discovery while preserving authenticated earlier-lab journeys. These are resolved baseline gaps, retained here as design context.

### Delivery status

| Issue | Branch | Reviewed integration / current status | Evidence |
| --- | --- | --- | --- |
| #44 | `feature/lab4-lab3-tech-debt` | PR #45 approved and merged into `lab4-staging`; deferred mobile communication-panel fix completed. | [Review record](reviewer.md) |
| #47 | `feature/lab4-spec-and-tests` | PR #46 approved and merged; specification, contracts, and planned traceability established before feature implementation. | [Review record](reviewer.md) |
| #48 | `feature/lab4-actions-foundation` | PR #54 approved and merged; Actions schema, migration, seed/recovery, APIs, authorization, revisions, and concurrency coverage implemented. | [Foundation notes](actions-foundation.md), [tests Section 8](tests.md#8-issue-48-foundation-execution) |
| #49 | `feature/lab4-actions-ui` | PR #55 approved and merged; Staff editors, Requester read-only views, public history, and draft/conflict recovery implemented. | [UI notes](actions-ui.md), [tests Section 9](tests.md#9-issue-49-actions-ui-execution) |
| #50 | `feature/lab4-ticket-workflow` | PR #56 approved and merged; resolution gates, metadata, transition history, and workflow integration implemented. | [Workflow notes](ticket-workflow.md), [tests Section 10](tests.md#10-issue-50-ticket-workflow-execution) |
| #51 | `feature/lab4-dashboards` | PR #57 approved and merged, including refresh/navigation review corrections; aggregate APIs, filter extensions, role dashboards, and drill-downs implemented. | [Dashboard notes](dashboards.md), [tests Sections 11–13](tests.md#11-issue-51-dashboard-execution) |
| #52 | `test/lab4-regression-and-evidence` | PR #58 approved and merged, including separated-token safety corrections; regression discovery and rendered accessibility/layout evidence completed within recorded verification scopes. | [Regression notes](regression-and-evidence.md), [tests Sections 14–15](tests.md#14-issue-52-regression-accessibility-and-evidence) |
| #53 | `docs/lab4-final-evidence-release` | Documentation PR #59 and release PR #60 merged. Actual-main verification executed and found the compiled-startup blocker; this branch records the run and verified correction. Updated-main verification and final submission remain open. | [README](../../README.md), [DoD](#10-product-definition-of-done), [reviewer.md](reviewer.md), [ai-use.md](ai-use.md) |

Release integration through PR #60 is complete and the actual-main checks have executed. Review/merge the compiled-startup correction, capture and verify the updated main SHA, then prepare the submission PDF last. Earlier counts and the new main/correction results remain tied to their separate recorded snapshots; see [final-main verification](final-main-verification.md).
