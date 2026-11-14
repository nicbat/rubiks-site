import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

test("profile picture catalog imports transform in Vite development mode", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "last-layer-vite-pfps-"));
  const server = await createServer({
    cacheDir,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    // A JSON import from public/ builds but is forbidden by Vite's dev server.
    const result = await server.transformRequest("/src/pfps.js");
    assert.ok(result?.code.includes("function profilePicture"));
    assert.deepEqual(server.config.optimizeDeps.entries, ["index.html"]);
  } finally {
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("Vite dependency discovery accepts timeline and timer components", async () => {
  const { resolveConfig, optimizeDeps } = await import("vite");
  const cacheDir = await mkdtemp(join(tmpdir(), "last-layer-vite-timeline-"));
  try {
    const config = await resolveConfig(
      {
        cacheDir,
        logLevel: "silent",
        optimizeDeps: { entries: ["src/components/Timer.svelte"] },
      },
      "serve",
    );
    // This is Vite's real script-only scanner, not Svelte compilation. Exporting
    // a markup-declared snippet from a script block previously failed here.
    const metadata = await optimizeDeps(config, true);
    assert.ok(
      Object.keys(metadata.optimized).some((id) => id.startsWith("svelte")),
    );
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});
