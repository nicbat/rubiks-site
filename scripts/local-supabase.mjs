import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, cp, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "node_modules", "supabase", "dist", "supabase.js");
const excluded =
  "realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor";

export function run(
  command,
  args,
  { env = process.env, input, quiet = false, cwd = root } = {},
) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: [
        input === undefined ? "ignore" : "pipe",
        quiet ? "pipe" : "inherit",
        quiet ? "pipe" : "inherit",
      ],
    });
    let stdout = "",
      stderr = "";
    if (quiet) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    if (input !== undefined) child.stdin.end(input);
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolveRun(stdout)
        : reject(
            Error(
              `${command.split(/[\\/]/).at(-1)} failed (${code}).${quiet ? `\n${stderr}` : ""}`,
            ),
          ),
    );
  });
}
export function portBase(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 1024 || n > 65525)
    throw Error("Use a local port base between 1024 and 65525.");
  return n;
}
export function localOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("Integration tools require a loopback HTTP origin.");
  return url.origin;
}
export async function prepareStack(kind) {
  if (!["dev", "test"].includes(kind)) throw Error("Unknown local stack.");
  const temporary = kind === "test";
  const directory = temporary
    ? await mkdtemp(join(tmpdir(), "last-layer-integration-"))
    : join(root, ".supabase", "dev");
  const suffix = createHash("sha256")
    .update(resolve(directory))
    .digest("hex")
    .slice(0, 10);
  const project = `last-layer-${kind}-${suffix}`;
  const base = portBase(
    process.env[
      temporary
        ? "LAST_LAYER_INTEGRATION_PORT_BASE"
        : "LAST_LAYER_BACKEND_PORT_BASE"
    ],
    temporary ? 56320 : 55320,
  );
  await mkdir(join(directory, "supabase"), { recursive: true });
  let config = await readFile(join(root, "supabase/config.toml"), "utf8");
  config = config
    .replace('project_id = "last-layer"', `project_id = "${project}"`)
    .replace(/5532([0-6])/g, (_, offset) => String(base + Number(offset)));
  if (temporary)
    config = config
      .replace("[db.seed]\nenabled = true", "[db.seed]\nenabled = false")
      .replace(
        'site_url = "http://127.0.0.1:5175"',
        'site_url = "http://127.0.0.1:4176"',
      );
  await writeFile(join(directory, "supabase/config.toml"), config);
  for (const file of ["migrations", "templates", "seed.sql"]) {
    await rm(join(directory, "supabase", file), {
      recursive: true,
      force: true,
    });
    await cp(join(root, "supabase", file), join(directory, "supabase", file), {
      recursive: true,
    });
  }
  const invoke = (args, options) =>
    run(process.execPath, [cli, ...args, "--workdir", directory], options);
  return {
    project,
    directory,
    base,
    async start() {
      console.log(
        `Starting Last Layer ${kind === "dev" ? "development" : "disposable test"} backend (API port ${base + 1})…`,
      );
      // CLI stdout includes server-only credentials. Never print or write it.
      await invoke(["start", "--exclude", excluded], { quiet: true });
      return this.status();
    },
    async status() {
      const status = JSON.parse(
        await invoke(["status", "-o", "json"], { quiet: true }),
      );
      const url = localOrigin(status.API_URL);
      const mail = localOrigin(status.INBUCKET_URL);
      if (
        new URL(url).port !== String(base + 1) ||
        new URL(mail).port !== String(base + 4)
      )
        throw Error("Unexpected local backend ports.");
      return { url, key: status.ANON_KEY, mail };
    },
    async reset() {
      await invoke(["db", "reset", "--local", "--yes"], { quiet: true });
    },
    async migrate() {
      await invoke(["migration", "up", "--local"], { quiet: true });
    },
    async sqlTests() {
      const { readdir } = await import("node:fs/promises");
      for (const file of (await readdir(join(root, "supabase/tests")))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await run(
          "docker",
          [
            "exec",
            "-i",
            `supabase_db_${project}`,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
          ],
          {
            input: await readFile(join(root, "supabase/tests", file), "utf8"),
            quiet: true,
          },
        );
        console.log(`Database regression passed: ${file}`);
      }
    },
    async seed() {
      if (!temporary)
        throw Error(
          "Seed only a fresh disposable test database; use backend:reset for development.",
        );
      await run(
        "docker",
        [
          "exec",
          "-i",
          `supabase_db_${project}`,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        {
          input: await readFile(join(root, "supabase/seed.sql"), "utf8"),
          quiet: true,
        },
      );
    },
    async stop() {
      await invoke(["stop", ...(temporary ? ["--no-backup"] : [])], {
        quiet: true,
      });
      if (temporary) await rm(directory, { recursive: true, force: true });
    },
  };
}
export function publicBackendEnv(config) {
  return {
    ...process.env,
    VITE_SUPABASE_URL: localOrigin(config.url),
    VITE_SUPABASE_PUBLISHABLE_KEY: config.key,
    LAST_LAYER_TEST_API_URL: localOrigin(config.url),
    LAST_LAYER_TEST_ANON_KEY: config.key,
    LAST_LAYER_TEST_MAIL_URL: localOrigin(config.mail),
  };
}
