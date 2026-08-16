# Lab 1 — Peer Review Record  (fill this in)

**Author:** Thanawat Suntarawattana — 67070501022 — GitHub: [@Maibokdaimhai](https://github.com/Maibokdaimhai)
**Peer reviewer:** Tanadet Nuchaikaew — 67070501081 — GitHub: [@Kawi-HBLI](https://github.com/Kawi-HBLI)
**Partner I reviewed:** Songwit Rueangsawat — 67070501060 — GitHub: [@R1NNE0](https://github.com/R1NNE0)

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
|  #5  | feature/1-project-foundation | Approved |
|  #6  | feature/2-health-check | Approved |
|  #7  | feature/3-category-seed | Approved |
|  #8  | feature/4-category-list | Approved |

### PR#5: `feat: set up TokTickIT project foundation (Issue #1)`
- **Link PR** https://github.com/Maibokdaimhai/toktikit/pull/5
- **Reviewer comment I received:**
    ```
    Approved.

    Checked local setup and environment:

    ☑ Frontend: React + TS + Vite bootstrapped successfully; Bootstrap integrated.
    ☑ Backend: Express + TS server runs correctly; Prisma schema set up and PostgreSQL connected via Docker.
    ☑ Config & Tooling: Vitest and Supertest in place; .gitignore covers secrets and build artifacts; .env.example provided.
    ☑ Docs: README covers install, run, and test steps clearly.
    Ready to merge.
    ```
- **How I responded:**
    ```
    Thanks for the detailed review! All checks passed, merging into lab1-staging.
    ```
### PR#6: `feat: implement API health check endpoint and UI status (Issue #2)`
- **Link PR** https://github.com/Maibokdaimhai/toktikit/pull/6
- **Reviewer comment I received:**
    ```
    Approved.

    Checked the implementation against Issue #2 requirements:

    ☑ Server: GET /api/health now returns HTTP 200 with { status: "ok", service: "TokTickIT API" } — matches the test expectation in health.test.ts.
    ☑ Client api.ts: checkSystem() correctly fetches /api/health and throws on failure; gracefully handles missing /api/categories (Issue #4 scope).
    ☑ Client App.tsx: UI handles all required states — loading, success (Online + category list), and error (Offline + message).
    ☑ docker-compose.yml: Removed deprecated version field, no functional impact.
    Ready to merge.
    ```
- **How I responded:**
    ```
    Thank you! Verified health check API and UI states, merging into lab1-staging.
    ```
### PR#7: `feat: add Category model, migration, and seed script (Issue #3)`
- **Link PR** https://github.com/Maibokdaimhai/toktikit/pull/7
- **Reviewer comment I received:**
    ```
    Approved.

    Checked the implementation against Issue #3 requirements:

    Migration: migration.sql correctly creates the Category table with id, name (UNIQUE), and createdAt fields matches the Prisma schema.
    Seed: All four required categories seeded (Account and Access, Hardware, Software, Network).
    Idempotent: Uses upsert so running the seed multiple times will not create duplicates.
    Cleanup: Removed .vite/ cache files from tracking and updated .gitignore accordingly.
    Ready to merge.
    ```
- **How I responded:**
    ```
    Thanks for catching the .vite cache issue! Cleaned git tracking and merged into lab1-staging.
    ```
### PR#8: `feat: fetch and display categories in UI (Issue #4) - #8`
- **Link PR** https://github.com/Maibokdaimhai/toktikit/pull/8
- **Reviewer comment I received:**
    ```
    Looks awesome!

    Server: GET /api/categories returns categories ordered by id with { id, name } shape; errors respond with 500 and a safe message.
    Client api.ts: checkSystem() now properly fetches and validates the categories endpoint.
    Client Tests: Both success (Online + 4 categories rendered) and error (Offline + message) states covered using vi.spyOn mocks.
    Server Tests: categories.test.ts asserts the four seeded categories in correct id order.
    I pulled the branch and tested everything locally. Both the automated tests (client & server) and the actual app run perfectly! The GET /api/categories endpoint and the UI state handling are exactly what we need.

    Just a suggestion for the future: Maybe down the line, we could spice up the UI a bit with some icons or a card layout just to make it look a bit fancier. But for this PR, it does the job perfectly.

    Approved and ready to merge! Great job bro!
    ```
- **How I responded:**
    ```
    Thank you for the great review! Categories integration is complete, merging into lab1-staging.
    ```

---

## Pull Requests I reviewed for my partner

### PR: `feat: set up project foundation (Issue #1) - #7`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/7
- **My comment:** 
    ```
    All setup verification tests passed successfully and ready to merge! 🚀

    Verification Checklist:

    ✅Frontend (React + TS + Vite): Started & verified Bootstrap UI rendering.
    ✅Backend (Node.js + Express + TS): Up and running.
    ✅Database & ORM: PostgreSQL connected & Prisma initialized.
    ✅Testing Setup: Vitest & Supertest configured.
    ✅Docs: Initial setup instructions added to README.md.
    ```
- **Partner's response:**
    ```
    Thanks for the thorough review and verification.

    I've verified that all foundational setups are functioning as expected. Merging this PR into lab1-staging now so I can move forward with the next issues.
    ```

### PR: `feat: implement API health check (Issue #2)`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/8
- **My comment:** 
    ```
    Issue 2 Status Checklist

    ✅ GET /api/health returns HTTP 200
    ✅ JSON response contains status = ok and service = TokTickIT API
    ✅ Supertest test passes
    ❌ React page displays backend status based on real API call
    ❌ Useful error message appears when backend is unavailable

    Feedback

    The backend API and Supertest tests look great and pass cleanly! However, the frontend client implementation is missing:

    Please update client/src/api.ts and client/src/App.tsx so clicking [Check System] calls /api/health.
    Display System Status: Online on success, and System Status: Offline with an error message when the backend is down.
    ```
    
    ```
    Approve!

    Issue 2 Status Checklist

    ✅ GET /api/health returns HTTP 200
    ✅ JSON response contains status = ok and service = TokTickIT API
    ✅ Supertest test passes
    ✅ React page displays backend status based on real API call
    ✅ Useful error message appears when backend is unavailable
    ```
- **Partner's response:**
    ```
    Thank you for the detailed feedback and the approval.

    I've addressed the missing frontend integration by connecting the [Check System] button to GET /api/health and handling both the Online and Offline (with error message) UI states properly. Merging this PR into lab1-staging now.
    ```

### PR: `feat: create category model and seed initial data`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/9
- **My comment:** 
    ```
    Approved ✅

    Acceptance Criteria Checklist
    ✅ Prisma Category Model: Defined with id (autoincrement), name (unique), and createdAt.
    ✅ Database Migration: Generated initial SQL migration creating the Category table and unique index.
    ✅ Seeded Categories: Successfully seeds the 4 categories (Account and Access, Hardware, Software, Network).
    ✅ Idempotency Verified: Ran npm run prisma:seed multiple times consecutively with no duplicate key errors.
    ✅ Secrets Protected: server/.env is excluded via .gitignore and database credentials remain untracked.
    ```
- **Partner's response:**
    ```
    Thanks for verifying the database migration and seeding logic.

    I'm glad the idempotency checks and secret protections all passed smoothly. Merging this PR into lab1-staging now so I can proceed with Issue 4.
    ```


### PR: `feat: display IT request category list and integrate API`
- **Link PR:** https://github.com/R1NNE0/toktickit/pull/10
- **My comment:** 
    ```
    Acceptance Criteria Checklist

    ✅ Backend Endpoint: GET /api/categories returns HTTP 200 OK with { id, name } categories ordered by id ascending.
    ✅ Error Handling: Returns safe HTTP 500 response on database failure.
    ✅ Supertest Test: Enabled and passing in server/tests/lab-01/categories.test.ts.
    ✅ Frontend API & UI: checkSystem() fetches both endpoints and App.tsx dynamically renders the 4 categories on Online status.
    ✅ Frontend Vitest Tests: Enabled and passing in client/tests/lab-01/App.test.tsx (heading, success state, and offline error state).

    Reviewer Feedback

    Awesome work on Issue 4! The full-stack integration between Express, Prisma, PostgreSQL, and React works seamlessly. All backend Supertest tests and frontend Vitest UI tests pass cleanly.

    PR is approved and ready to merge into lab1-staging! Great job completing Lab 1! 🎉
    ```
- **Partner's response:**
    ```
    Thank you so much for the review, feedback, and approval.

    It's great to see the full-stack integration and all test suites passing seamlessly across both client and server. Merging this final PR into lab1-staging now to complete Lab 1, Great teamwork.
    ```
