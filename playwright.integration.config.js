import { defineConfig, devices } from "@playwright/test";
import { localOrigin } from "./scripts/local-supabase.mjs";
// Refuse to launch a real-backend browser suite against a hosted project.
localOrigin(process.env.LAST_LAYER_TEST_API_URL);
export default defineConfig({
  testDir: "./tests/integration-browser",
  outputDir: "test-results/integration",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/integration" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4176",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "npm run preview -- --host 127.0.0.1 --port 4176 --strictPort --outDir .integration-dist",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
  },
});
