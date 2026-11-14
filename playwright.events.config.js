import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
const port = process.env.LAST_LAYER_TEST_PORT || "4191";
if (!/^\d+$/.test(port) || +port < 1024 || +port > 65535)
  throw Error("Invalid isolated browser-test port");
// Explicit development-only integration suite; production activation stays gated.
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "multi-event.spec.js",
  outputDir: `test-results/events-${port}`,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: `playwright-report/events-${port}` },
    ],
  ],
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: {
      VITE_DEV_DATA_MODE: "guest",
      VITE_SUPABASE_URL: `http://127.0.0.1:${port}`,
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_tests",
    },
  },
});
