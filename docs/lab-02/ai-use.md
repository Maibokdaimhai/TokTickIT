# Lab 2 — AI Pair Programming Log and Reflection

**AI Model Used:** Gemini 3.6 Flash (High) / Antigravity Agentic Assistant

---

## 1. Selected Key Prompts Table

| Prompt # | Topic / Intent | Prompt Excerpt | Outcome / Applied Value |
| :-: | :--- | :--- | :--- |
| **1** | **Sprint Requirements Analysis** | *"Read the Lab 2 worksheet PDF and inspect the current repository to analyze all sprint requirements and technical deliverables."* | Analyzed the PDF handout and current codebase; synthesized a 5-issue sprint plan covering Spec DD, DB seeding, Ticket Creation, My Tickets, and Attachments. |
| **2** | **Prisma Client Debugging & Test Refactoring** | *"Explain what this problem is and help me fix it: Property 'requesterUser' does not exist on type 'PrismaClient'..."* | Diagnosed stale Prisma Client TypeScript definitions, regenerated `@prisma/client`, and refactored client unit tests (`App.test.tsx`) to match the Lab 2 Requester Context UI layout. |
| **3** | | | |
| **4** | | | |
| **5** | | | |
| **6** | | | |

---

## 2. My Reflection

Using an AI coding agent as a pair-programming partner in Lab 2 significantly accelerated both the Spec-Driven Development (Spec DD) planning phase and active backend/frontend implementation. Rather than manually writing boilerplate specification documents from scratch, the AI assistant systematically extracted requirements from the stakeholder worksheet and transformed them into precise engineering contracts (`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`).

Beyond initial specification design, the AI proved highly effective for real-time diagnostic troubleshooting and test alignment. For instance, when encountering a Prisma Client type mismatch (`Property 'requesterUser' does not exist on type 'PrismaClient'`), the AI quickly identified the out-of-sync type definitions in `node_modules/@prisma/client` and guided the execution of `npx prisma generate`. Additionally, as UI components evolved from Lab 1 to Lab 2, the AI helped refactor legacy unit tests (`App.test.tsx`) to match current navigation tab structures while ensuring total test suite integrity.

Overall, pair programming with the AI maintained full traceability across acceptance criteria, business rules, and test suites, allowing for rapid iteration without sacrificing code quality or test coverage.

