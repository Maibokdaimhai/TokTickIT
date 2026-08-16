# Lab 1 — AI Use and Reflection

**LLM/agent used:** Antigravity (Gemini 3.6 Flash (High))

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Explain the 7 acceptance criteria for Issue 1 and show me how to manually and programmatically verify each criterion. | Learned the full-stack setup requirements, checked frontend/backend dev servers, verified Prisma PostgreSQL connection, and validated Git configuration. |
| 2 | Why does `DATABASE_URL` error occur in Prisma, where do database credentials live, and how do we ensure secrets are not committed to Git? | Created `server/.env`, configured local PostgreSQL connection credentials, verified `.gitignore` rules, and successfully ran `npx prisma db push`. |
| 3 | What is Supertest, how does it verify Express endpoints without opening a network port, and why is `health.test.ts` failing with status 501? | Studied how Supertest simulates HTTP requests against the Express app and implemented `GET /api/health` returning HTTP 200 OK to pass `npm test`. |
| 4 | What is the difference between a Prisma migration and a seed script, and why must the category seed script be idempotent using `upsert`? | Defined the `Category` model, generated `prisma/migrations/`, implemented `prisma.category.upsert` in `seed.ts`, and verified seed idempotency by running `npm run prisma:seed` twice. |
| 5 | Where is the code that fetches seeded data to show on the client, and how can I verify for sure that categories are loaded from PostgreSQL? | Traced the data pipeline from `findMany()` in `app.ts` to `checkSystem()` in `api.ts` and `App.tsx`, and verified by adding a 5th category in Prisma Studio to see it render live. |
| 6 | How do I test `GET` JSON responses manually using Postman, `curl`, and web browser before running automated Supertest scripts? | Used `curl http://localhost:3000/api/health` and browser inspect tools to verify raw JSON responses directly alongside automated test runners. |
| 7 | What is CORS, why is `app.use(cors())` needed in Express, and how does it allow Vite on port 5173 to call Express on port 3000? | Verified `cors()` middleware configuration in `server/src/app.ts` to allow cross-origin API requests from the React frontend dev server to the Express backend. |

## Reflection

Working alongside the AI agent throughout Lab 1 gave me a solid, practical understanding of full-stack integration across React, Express, Prisma, and PostgreSQL. I gained hands-on clarity on how database schemas are migrated and idempotently seeded, how REST APIs process database queries, and how Supertest and Vitest automate end-to-end verification. Additionally, pair programming with the agent helped me master essential software engineering practices like managing secret environment variables and handling CORS middleware.
