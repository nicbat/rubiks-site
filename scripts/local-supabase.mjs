import { spawn } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import { createServer } from "node:net";
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
// Probe all seven published ports, including SMTP/POP3. Automatic test stacks
// use a range below Linux's usual outbound ephemeral ports instead of 56320+.
async function portsAvailable(base) {
  const servers = [];
  try {
    for (let offset = 0; offset < 7; offset++) {
      const server = createServer((socket) => socket.destroy());
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(
          { port: base + offset, host: "0.0.0.0", exclusive: true },
          resolve,
        );
      });
    }
    return true;
  } catch (error) {
    if (error.code === "EADDRINUSE") return false;
    throw error;
  } finally {
    await Promise.all(
      servers
        .filter((server) => server.listening)
        .map(
          (server) =>
            new Promise((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
    );
  }
}
export async function integrationPortBase(
  value,
  choose = () => randomInt(1000, 3000) * 10,
) {
  if (value !== undefined) {
    const base = portBase(value);
    if (await portsAvailable(base)) return base;
    throw Error(
      `Integration ports ${base}–${base + 6} are occupied. Choose another LAST_LAYER_INTEGRATION_PORT_BASE.`,
    );
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const base = portBase(choose());
    if (await portsAvailable(base)) return base;
  }
  throw Error(
    "No free integration port block was found. Set LAST_LAYER_INTEGRATION_PORT_BASE to seven unused consecutive ports.",
  );
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
  const base = temporary
    ? await integrationPortBase(process.env.LAST_LAYER_INTEGRATION_PORT_BASE)
    : portBase(process.env.LAST_LAYER_BACKEND_PORT_BASE, 55320);
  const directory = temporary
    ? await mkdtemp(join(tmpdir(), "last-layer-integration-"))
    : join(root, ".supabase", "dev");
  const suffix = createHash("sha256")
    .update(resolve(directory))
    .digest("hex")
    .slice(0, 10);
  const project = `last-layer-${kind}-${suffix}`;
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
