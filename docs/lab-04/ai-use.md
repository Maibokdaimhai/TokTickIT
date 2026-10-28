# Lab 4 AI Use and Reflection - TokTickIT

Status: Initial factual record, 27 October 2026. Tool used: OpenAI Codex. Do not infer a specific model from generated text; record the configured model from the actual session if needed for submission.

## Selected actual prompts

| # | Actual user prompt | Context / outcome |
|---|---|---|
| 1 | "After you create `lab4-staging` from `main` you can create `feature/lab4-lab3-tech-debt` to fix it." | Established staging and the first technical-debt feature branch for the deferred mobile communication fix. |
| 2 | "can you add and commit and push about this PR? And use convention commit syntax like before in lab3." | Authorized the earlier technical-debt commit/push using conventional commit syntax. This is historical authorization for that earlier task, not permission to push this draft. |
| 3 | "It already merge so you can do spec and tests. Don't push anything" | Authorized the original local engineering-contract and test-plan drafting after the tech-debt merge, with no push at that stage. |
| 4 | "Ok create Lab 4 Issues now and don't forget about specification-and-tests Issue too. You can edit PR#46 Description to close issue" | Authorized creating the sprint backlog and linking the specification Issue to the PR. |
| 5 | "Fix this request change and push it again" | Requested correction of PR #46 review feedback; the resulting BR-23 defines an audited path to complete outstanding follow-up. |
| 6 | "PR46 Already merge so you can do next feature branch" | Started the next feature, Issue #48 Actions foundation, locally from merged staging. |
| 7 | "PR54 Already merge so you can do next feature" | Started Issue #49 Actions UI locally from merged staging; authenticated views, draft/conflict recovery, component and controlled-API browser checks were implemented. |

| 8 | "PR55 already merge do next task" | Started Issue #50 Ticket workflow locally from merged staging; resolution gates, public transition history, timestamp metadata and tests implemented. No commit/push at this stage. |

| 9 | "56 merge เข้า staging แล้วมั้ง น่าจะทำอันต่อไปได้" | Verified PR #56 merge and started Issue #51 locally on feature/lab4-dashboards: aggregate APIs, exact drill-downs, role home/navigation, SQL-oracle/component/real browser and performance verification. No publication at this stage. |

| 10 | "Request changes." | User review identified stale refresh retention, Detail-reload list context loss and possible routing-test timing sensitivity. Added failing regressions, local fixes, parallel/serial and browser verification; no publication authorized in this follow-up. |

The worksheet asks for 6-10 selected key prompts; ten genuine excerpts are recorded here. Append or select later prompts as the sprint proceeds. Do not reconstruct prompts or count planned tests as actual implementation results.

## Specification and coding use

In this drafting task Codex inspected the merged base, existing schema/routes/policies and earlier contracts, then proposed explicit choices for ambiguous Action statuses, assignment, audit history, resolution and dashboards. That original drafting task did not implement new feature code. After PR #46 merged, the Issue #48 task implemented Actions APIs/schema/seeds and 48 new backend tests; full backend verification passed 317 tests on a dedicated disposable PostgreSQL instance, including restore recovery. The verified implementation was committed as 0432b19; publication and PR creation were subsequently authorized by the user. No independent code-review approval is claimed.

## My Reflection

Pending the student's own reflection. Explain what you learned from the specification and coding work, which assumptions you challenged, how you checked generated claims, and what you would change next time. Do not submit AI-written first-person learning claims as if the student had supplied them.

Issue #51 publication was subsequently authorized by the actual prompt: "push `feature/lab4-dashboards` และเปิด PR ได้เลย". The implementation and verification evidence are committed separately using Conventional Commits; reviewer approval remains pending.

PR #57 correction publication was subsequently authorized by the actual prompt: "push it because it request change from PR. Give me the comment to reply him too". The reply text is provided to the user for posting; no reviewer comment is posted automatically.
