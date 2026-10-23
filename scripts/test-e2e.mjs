import { spawnSync } from "node:child_process";

// Every browser build uses a fake, same-origin Supabase endpoint. Tests fulfil
// requests in their isolated context; production keys and services are never used.
const port = process.env.LAST_LAYER_TEST_PORT || "4174";
if (!/^\d+$/.test(port) || +port < 1024 || +port > 65535)
  throw Error("Invalid isolated browser-test port");
const env = {
  ...process.env,
  VITE_SUPABASE_URL: `http://127.0.0.1:${port}`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_tests",
};
for (const args of [
  ["node_modules/vite/bin/vite.js", "build"],
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
