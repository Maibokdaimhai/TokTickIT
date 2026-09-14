import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Lab 2 selector journeys remain historical; the Lab 3 copy runs with real login.
  testDir: "./e2e/lab-03",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
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
      port: 3000,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm run dev",
      cwd: "client",
      port: 5173,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
