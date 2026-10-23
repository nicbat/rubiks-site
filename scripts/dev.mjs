import { join } from "node:path";
import {
  prepareStack,
  publicBackendEnv,
  root,
  run,
} from "./local-supabase.mjs";
const mode = process.argv[2] || "demo";
if (!["demo", "guest", "backend"].includes(mode))
  throw Error("Unknown development mode.");
let env = process.env;
if (mode === "backend") {
  const stack = await prepareStack("dev");
  const config = await stack.start();
  await stack.migrate();
  env = publicBackendEnv(config);
  console.log(
    `Local email inbox: ${config.mail}\nSign in as learner@example.test for @local_learner. Use the emailed code.\nThe backend stays running; use npm run backend:stop when finished.`,
  );
}
await run(
  process.execPath,
  [
    join(root, "node_modules/vite/bin/vite.js"),
    "--host",
    mode === "backend" ? "127.0.0.1" : "0.0.0.0",
    "--mode",
    mode,
    ...(mode === "backend" ? ["--port", "5175", "--strictPort"] : []),
    ...process.argv.slice(3),
  ],
  { env },
);
