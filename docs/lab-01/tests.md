# Lab 1 — Test Plan and Evidence  (fill this in)

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Passed |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Passed |
| 3 | Vitest | Heading renders | Passed |
| 4 | Vitest | Success state shows Online + category list | Passed |
| 5 | Vitest | Error state shows Offline + message | Passed |

Paste your passing terminal output / screenshot below.

## Server Tests:
```
> toktickit-server@1.0.0 test
> vitest run


 RUN  v2.1.9 /Users/meng/dev/MyUniversity/CPE334-SoftwareEngineer/toktickit/server

 ✓ tests/lab-01/categories.test.ts (1)
 ✓ tests/lab-01/health.test.ts (1)

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  12:21:40
   Duration  306ms (transform 34ms, setup 0ms, collect 214ms, tests 55ms, environment 0ms, prepare 69ms)
```

## Client Tests:
```
> toktickit-client@1.0.0 test
> vitest run


 RUN  v2.1.9 /Users/meng/dev/MyUniversity/CPE334-SoftwareEngineer/toktickit/client

 ✓ tests/lab-01/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTickIT heading
     ✓ shows Online and the seeded categories on success
     ✓ shows an Offline error message when the API is unavailable

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  12:22:25
   Duration  570ms (transform 29ms, setup 39ms, collect 61ms, tests 42ms, environment 256ms, prepare 30ms)
```