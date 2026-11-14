import { defineConfig, devices } from "@playwright/test";

const port = process.env.LAST_LAYER_TEST_PORT || "4174";

export default defineConfig({
  testDir: "./tests/e2e",
  // This opt-in flow requires the dedicated Vite development server.
  testIgnore: "**/multi-event.spec.js",
  outputDir: `test-results/port-${port}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: `playwright-report/port-${port}` }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
