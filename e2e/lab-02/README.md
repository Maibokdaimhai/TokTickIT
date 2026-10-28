# Archived Lab 2 browser journeys

`requester-ticket-flow.spec.ts` records the original unauthenticated requester-selector workflow and hard-coded port 3000. It is retained as historical source and is deliberately outside current Playwright discovery. Do not run it against development data.

The authenticated replacement is `e2e/lab-03/requester-regression.spec.ts`: E2E-01 covers creation/validation/failure/busy/upload; E2E-02 covers filtering/pagination/responsive/empty results; E2E-03 covers detail/additional upload/download/soft removal; E2E-04 extends communication/advisory/ownership security. Session sign-out/sign-in replaces the retired identity selector. No earlier selector-era test is counted as a passing Lab 4 execution.

Use the repository-root guarded `npm run test:e2e` against an explicitly opted-in disposable PostgreSQL database. The Lab 4 discovery inventory is in `artifacts/lab-04/verification/regression-discovery.json`; controlled-API fixture suites run separately with `npm run test:e2e:fixtures`.
