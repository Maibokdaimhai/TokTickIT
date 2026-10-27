# Issue #49 - Actions Taken UI

Implementation commit `47451ec` on `feature/lab4-actions-ui`, based on staging `ce32e77` after merged PR #54. The source fingerprint was verified immediately before commit; branch publication was subsequently authorized. Feature PR creation is separate. No database/container is started, migrated or accessed.

## Delivered behavior

Staff and Administrator Ticket Detail now include a shared Actions Taken section. It displays work, independent performer/assignee identities, status, follow-up, attachment references and timestamps in Bangkok time. Requester Ticket Detail uses the same public list and revision history read-only. Primary Ticket ownership stays separate from the action assignee. Private content remains in Internal Notes.

The inline create/edit form defaults the performer and initial assignee from the authenticated Staff session, supports eligible staff selection, conditional notes/results, Unicode counters and explicit Bangkok date conversion. Ordinary terminal edits are unavailable. Completion/cancellation require an explicit confirmation with the result. A separate BR-23 form records follow-up completion while preserving original work and notes; an inactive historical assignee does not prevent an eligible acting user from recording completion.

Paginated lists and histories use bounded API reads and abort/ignore stale responses. An actionId deep link fetches the selected record directly instead of loading all pages. Opening a selected record and completing a save move focus to meaningful content. Original historical IDs are displayed as current known names when available, otherwise as a user reference without inventing historical names or querying protected account lists.

## Draft and failure protection

- A create draft retains its UUID and exact payload after an uncertain network/5xx outcome; fields are locked until that exact request is retried or the user deliberately discards the draft. A replay response is treated as one successful save.
- A 409 refreshes authorized saved work and Ticket data while preserving draft text. The user explicitly chooses Use Latest Versions and Review Draft before another save; the form never silently overwrites concurrent work.
- Validation and eligible-staff lookup failures retain fields. Repeat submit is guarded synchronously, and successful writes are distinguished from a failed parent-summary refresh. Further saves pause until the summary is recovered.
- Dirty draft navigation, browser back and sign-out are guarded; page unload warns about unsaved work. Expired/restricted sessions clear protected action content without browser-storage persistence.

## Verification

- **138 client tests passed**, including 26 new Actions UI, authenticated App integration and HTTP-adapter tests. No failures or skipped cases.
- TypeScript no-emit check, client production build and whitespace checks passed.
- **8 Chromium UI integration checks passed** with controlled API fixtures, including 320/390/820/1440px viewports, direct descendant bounds and 44px button targets, create/assign/complete/history, BR-23 completion, Requester read-only keyboard history, and 200% zoom with unobscured validation focus.
- [Verification summary](../../artifacts/lab-04/verification/actions-ui.json) records the tested source fingerprint and exact evidence scope.
- [Screenshot directory](../../artifacts/lab-04/screenshots/actions-taken/) contains four Staff create/card captures and a mobile Requester history capture. Tall region screenshots hide the sticky header only during capture to avoid an offscreen-capture overlay; normal browser interactions and zoom/focus checks leave it visible. Mobile/desktop screenshots were visually inspected for layout and wrapping.

Run the client checks from `client/`:

```sh
npm test
npx tsc --noEmit
npm run build
```

Run browser UI integration from the repository root:

```sh
npx playwright test --config=playwright.ui.config.ts
```

The separate UI config starts only Vite at localhost:5178. Every API call is intercepted by controlled responses; it starts no backend, needs no DATABASE_URL, and does not replace the existing database-protected Playwright configuration. These are frontend integration/visual results, not a claim of real database-backed E2E coverage. Existing Lab 2/3 parent-unit suites explicitly isolate the new child section; the new authenticated App integration suite verifies the actual parent/child wiring, session role, navigation protection and summary refresh.

Ticket resolution-gate/transition-history UI remains Issue #50, dashboards remain #51, and full backend-integrated browser regression, contrast audit and final evidence remain #52. The user's pre-existing client/package.json edit is outside this change.
