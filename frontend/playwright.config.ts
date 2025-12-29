import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for HomERP e2e tests.
 *
 * Key design decisions:
 * - Tests run against a mocked API to ensure speed and reliability
 * - fullyParallel: true enables maximum parallelization
 * - Each test file runs independently in parallel
 * - API mocks are set up per-test for isolation
 * - Mobile viewport testing included for responsive validation
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./e2e",

  /* Maximum parallelization for speed */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only - increased due to @msw/playwright race condition */
  retries: process.env.CI ? 3 : 0,

  /* Reduced workers to minimize @msw/playwright race condition frequency */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter configuration */
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],

  /* Shared settings for all projects */
  use: {
    /* Base URL for navigation */
    baseURL,

    /* Collect trace when retrying failed tests */
    trace: "on-first-retry",

    /* Screenshot on failure for debugging */
    screenshot: "only-on-failure",

    /* Video on failure (only on CI for storage reasons) */
    video: process.env.CI ? "on-first-retry" : "off",
  },

  /* Configure test projects */
  projects: [
    /* Desktop Chrome - primary browser */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    /* Mobile Chrome - responsive testing */
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  /* Development server configuration */
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* Global timeout per test - keep short since APIs are mocked */
  timeout: 30000,

  /* Assertion timeout */
  expect: {
    timeout: 5000,
  },

  /* Output directories */
  outputDir: "test-results",
});
