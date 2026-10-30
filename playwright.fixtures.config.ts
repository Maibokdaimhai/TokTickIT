import { defineConfig, devices } from "@playwright/test";

// Frontend integration/visual checks only. All /api traffic is intercepted by
// controlled fixtures; this config starts no backend and accepts no database URL.
process.env.E2E_LAB4_SCREENSHOTS_DIR ??= "artifacts/lab-04/screenshots/regression/features";

export default defineConfig({
  testDir: "./e2e/lab-04", testMatch: ["actions-ui.spec.ts", "dashboard-review.spec.ts"], workers: 1, timeout: 30000,
  reporter: "list", use: { baseURL: "http://localhost:5178", contextOptions: { reducedMotion: "reduce" }, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm --prefix client run dev -- --host localhost --port 5178 --strictPort", port: 5178, env: { VITE_API_URL: "http://localhost:5178" }, reuseExistingServer: false },
});
