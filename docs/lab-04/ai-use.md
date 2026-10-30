# Lab 4 — AI Use and Reflection

**AI Model Used:** GPT-6.1 Sol (Medium)

---

## 1. Selected Key Prompts Table

| Prompt # | Topic / Intent | Prompt Excerpt | Outcome / Applied Value |
| :-: | :--- | :--- | :--- |
| **1** | **Lab 4 Requirements** | *"Can you inspect lab4 worksheet and explain to me what to do"* | Organized the sprint scope into specification and test planning, Actions Taken, Ticket workflow, dashboards, regression checks, and final evidence. |
| **2** | **Actions Taken Design and Implementation** | *"How action taken work? And how to implement it explain your code"* | Connected the Actions API and UI to lifecycle rules, validation, immutable revision history, Requester read-only access, and retry/conflict recovery. |
| **3** | **Dashboard Components** | *"List neccesary component in dashboard page"* | Identified role-specific metric cards, recent or actionable Ticket lists, loading/error/empty states, as-of information, refresh controls, and filtered drill-down links. |
| **4** | **Follow-up and Ticket Resolution** | *"How does follow-up work Why should it block Ticket resolution"* | Relevant implementation: the resolution gate checks outstanding follow-up; a dedicated completion operation records who completed it and when while preserving the original work and revisions. |
| **5** | **Assignee and Performer Identity** | *"What is the difference between the Action assignee and the person who performed the work"* | Relevant implementation: assignment represents responsibility, while performer and revision actor fields preserve who did or recorded the work. Dashboard counts must use the intended identity. |
| **6** | **Concurrent Updates** | *"how do you prevent conflicts when two staff members update the same ticket"* | Relevant implementation: transactions, consistent lock ordering, version checks, and conflict responses protect shared state. The UI preserves drafts for review before retrying. |
| **7** | **Dashboard Metrics and Authorization** | *"how do dashboard metrics work and how make sure each role sees only allowed data"* | Relevant implementation: server-side role and ownership checks scope aggregate queries and drill-down results. Tests compare metric calculations with expected data and verify access boundaries. |
| **8** | **Filters and Navigation State** | *"why do filters and pagination disappear after reloading ticket detail and explain to me how to preserve them."* | Relevant review correction: scoped list context is retained in browser history across Detail reloads, and Action-save URL updates preserve that state. Regression tests cover save → reload → Back. |
| **9** | **Safe Integration Testing** | *"how can I test Lab 4 without affecting my development database"* | Relevant verification approach: named disposable databases in the project container, separated safety tokens, guarded upload paths, and explicit authorization for destructive cleanup preserve development data. |
| **10** | **Regression and Completion Evidence** | *"what should we test before finishing Lab 4 and how do we check that Lab 3 still works"* | Relevant evidence: backend, client, real API/database browser, controlled browser, responsive/accessibility, and performance checks are recorded separately. Actual-main verification and the earlier startup correction are recorded separately; the corrected-main repeat passed at `351cfa7`. PDF preparation is the final subsequent submission step. |

---

## 2. My Reflection

During Lab 4, I learned how specification-driven development connects the Actions lifecycle, follow-up completion, Ticket resolution, and role-based dashboards. Working through separate Issues and reviewed PRs helped me understand how each feature depends on the previous one. Peer feedback also showed me why tests need to cover complete user journeys, including failed refreshes, saving an Action, reloading Detail, and returning to a filtered list.

I gained a better understanding of frontend state preservation, role-based data access, and safe integration testing with disposable databases. AI helped speed up implementation, debugging, and test preparation, but I still needed to check the environment, review the changes, and verify results against actual evidence. The main lesson was to use AI as a development assistant while keeping responsibility for correctness, safety, and the final submission.
