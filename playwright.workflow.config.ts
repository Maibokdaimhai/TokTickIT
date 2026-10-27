import { defineConfig, devices } from "@playwright/test";
import { assertSafeDatabaseUrl } from "./e2e/lab-03/db-guard.js";

// Real backend/database workflow checks. Discovery is scoped to this feature;
// the prior Lab 3 and fixture-only UI configurations remain available separately.
const databaseUrl = process.env.DATABASE_URL ?? "";
assertSafeDatabaseUrl(databaseUrl, process.env.E2E_ALLOW_DB_WRITE);
export default defineConfig({
  testDir: "./e2e/lab-04", testMatch: "ticket-resolution.spec.ts", workers: 1, timeout: 90000,
  reporter: "list", use: { baseURL: "http://localhost:5174", reducedMotion: "reduce", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "npm run dev", cwd: "server", port: 3104, reuseExistingServer: false, timeout: 60000,
      env: { DATABASE_URL: databaseUrl, CLIENT_ORIGIN: "http://localhost:5174", PORT: "3104", NODE_ENV: "test", UPLOADS_DIR: "/private/tmp/toktickit-workflow-e2e-uploads-20261027-50" } },
    { command: "npm run dev -- --host localhost --port 5174 --strictPort", cwd: "client", port: 5174, reuseExistingServer: false,
      env: { VITE_API_URL: "http://localhost:3104" } },
  ],
});
