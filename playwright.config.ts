import { defineConfig, devices } from "@playwright/test";
import { assertSafeUploadsDir } from "./e2e/lab-03/upload-guard.js";
import { assertSafeDatabaseUrl } from "./e2e/lab-03/db-guard.js";

// Fail-closed safety checks: prevent accidental writes or execution against development databases
const dbUrl = process.env.DATABASE_URL || "";
assertSafeDatabaseUrl(dbUrl, process.env.E2E_ALLOW_DB_WRITE);

const serverPort = 3104;
const clientPort = 5174;
const uploadsDir = assertSafeUploadsDir(process.env.UPLOADS_DIR);

process.env.E2E_LAB4_SCREENSHOTS_DIR ??= "artifacts/lab-04/screenshots/regression/features";

export default defineConfig({
  testDir: "./e2e",
  // Lab 2 selector-based journeys are explicitly superseded by the authenticated
  // Lab 3 requester suite; see the Issue #52 discovery inventory.
  testMatch: ["lab-03/**/*.spec.ts", "lab-04/ticket-resolution.spec.ts", "lab-04/dashboard-flow.spec.ts", "lab-04/actions-taken-flow.spec.ts", "lab-04/responsive-accessibility.spec.ts"],
  timeout: 90000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${clientPort}`,
    trace: "retain-on-failure",
    contextOptions: {
      reducedMotion: "reduce",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: "server",
      port: serverPort,
      env: {
        PORT: String(serverPort),
        CLIENT_ORIGIN: `http://localhost:${clientPort}`,
        DATABASE_URL: dbUrl,
        UPLOADS_DIR: uploadsDir,
        NODE_ENV: "test",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `npm run dev -- --host localhost --port ${clientPort} --strictPort`,
      cwd: "client",
      port: clientPort,
      env: {
        VITE_API_URL: `http://localhost:${serverPort}`,
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
