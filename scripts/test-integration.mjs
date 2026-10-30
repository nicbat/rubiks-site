import { join } from "node:path";
import { readdir } from "node:fs/promises";
import {
  prepareStack,
  publicBackendEnv,
  root,
  run,
} from "./local-supabase.mjs";
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--browser"))
  throw Error("Only --browser is supported.");
const stack = await prepareStack("test");
let cleaning;
const cleanup = () => (cleaning ||= stack.stop());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
try {
  const config = await stack.start();
  const env = publicBackendEnv(config);
  await stack.sqlTests();
  await stack.seed();
  await run(
    process.execPath,
    [
      "--import",
      "./scripts/svelte-loader.mjs",
      "--test",
      "--test-concurrency=1",
      ...(await readdir(join(root, "tests/integration")))
        .filter((name) => name.endsWith(".test.js"))
        .sort()
        .map((name) => `tests/integration/${name}`),
    ],
    { env },
  );
  if (args.includes("--browser")) {
    await run(
      process.execPath,
      [
        join(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--outDir",
        ".integration-dist",
      ],
      { env },
    );
    await run(
      process.execPath,
      [
        join(root, "node_modules/@playwright/test/cli.js"),
        "test",
        "--config",
        "playwright.integration.config.js",
      ],
      { env },
    );
  }
} finally {
  await cleanup();
}
