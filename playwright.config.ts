import { defineConfig, devices } from "@playwright/test";
import { assertSafeDatabaseUrl } from "./e2e/lab-03/db-guard.js";

// Fail-closed safety checks: prevent accidental writes or execution against development databases
const dbUrl = process.env.DATABASE_URL || "";
assertSafeDatabaseUrl(dbUrl, process.env.E2E_ALLOW_DB_WRITE);

const serverPort = 3104;
const clientPort = 5174;
const uploadsDir = process.env.UPLOADS_DIR || "/private/tmp/toktickit-e2e-uploads-20260918";

export default defineConfig({
  testDir: "./e2e/lab-03",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${clientPort}`,
    trace: "on-first-retry",
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
      command: `npm run dev -- --port ${clientPort}`,
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
