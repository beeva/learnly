import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end smoke and accessibility checks. They run against the mock API
 * (`npm run dev:mock`), so no backend or database is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }], ["github"]] : [["list"], ["html", { open: "never" }]],
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev:mock",
    port: PORT,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
