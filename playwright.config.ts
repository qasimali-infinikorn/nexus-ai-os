import { defineConfig, devices } from "@playwright/test";

/**
 * Optional smoke E2E. Skipped automatically when E2E_EMAIL / E2E_PASSWORD are unset.
 * Run: npx playwright install && npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
    trace: "on-first-retry"
  }
});
