# Lab 2 — AI Pair Programming Log and Reflection

**AI Model Used:** Gemini 3.6 Flash (High) / Antigravity Agentic Assistant

---

## 1. Selected Key Prompts Table

| Prompt # | Topic / Intent | Prompt Excerpt | Outcome / Applied Value |
| :-: | :--- | :--- | :--- |
| **1** | **Sprint Requirements Analysis** | *"Read the Lab 2 worksheet PDF and inspect the current repository to analyze all sprint requirements and technical deliverables."* | Analyzed the PDF handout and current codebase; synthesized a 5-issue sprint plan covering Spec DD, DB seeding, Ticket Creation, My Tickets, and Attachments. |
| **2** | **GitHub Issue Decomposition** | *"Decompose Sprint 2 into GitHub Issues with detailed descriptions, scopes, deliverables, acceptance criteria, and feature branch names."* | Generated structured GitHub issue descriptions with tasks, acceptance criteria, and branch names ready for issue creation. |
| **3** | **Engineering Specification Drafting** | *"Execute Issue #1: Draft the complete Sprint 2 Engineering Specification in docs/lab-02/specification.md covering all 11 required sections, including FRs, BRs, data models, API summaries, and ACs."* | Authored `docs/lab-02/specification.md` detailing FR-01..FR-12, BR-01..BR-15, AC-01..AC-15, and Product Definition of Done. |
| **4** | **Test DD Plan & Traceability Matrix** | *"Prepare docs/lab-02/tests.md establishing the planned unit, API, UI component, and E2E test matrix mapped to acceptance criteria."* | Created `docs/lab-02/tests.md` mapping ACs to Test IDs and concrete test file paths (`server/tests/lab-02/...`, `client/tests/lab-02/...`, `e2e/lab-02/...`). |
| **5** | **Zen Green UI System Specification** | *"Define docs/lab-02/ui-spec.md following the Zen Green design system tokens, component rules, and responsive breakpoint specifications."* | Authored `docs/lab-02/ui-spec.md` with color tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`, `#F5F7F6`), button states, responsive breakpoints, and visual inspection checklist. |
| **6** | **REST API Contract Specification** | *"Draft docs/lab-02/api-spec.md detailing REST API endpoints, HTTP status codes, request/response JSON schemas, query parameters, and standard error formats."* | Created `docs/lab-02/api-spec.md` defining HTTP methods, request/response JSON schemas, query parameters, and standard error shapes. |

---

## 2. My Reflection

Using an AI coding agent as a pair-programming partner in Lab 2 significantly accelerated the Spec-Driven Development (Spec DD) and Test-Driven Development (TDD) planning phase. Rather than manually writing boilerplate specification documents from scratch, the AI assistant systematically extracted requirements from the stakeholder worksheet and transformed them into precise, testable engineering contracts (`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`). 

The most valuable aspect of working with the AI was maintaining traceability across acceptance criteria, business rules, and planned test scenarios. By enforcing rigorous Spec DD prior to writing functional code, ambiguity was resolved early, establishing a clear contract for the subsequent database, API, and UI implementation sprints.
