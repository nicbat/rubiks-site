import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentTestData } from "../src/development.js";
import { localOrigin, portBase } from "../scripts/local-supabase.mjs";

test("ordinary frontend development starts populated; backend and guest modes start real", () => {
  assert.equal(developmentTestData(false, true, "demo", ""), true);
  for (const mode of ["backend", "guest"])
    assert.equal(developmentTestData(true, true, mode, ""), false);
  assert.equal(developmentTestData(false, true, "demo", "?demo=0"), false);
  assert.equal(developmentTestData(false, true, "backend", "?demo=1"), true);
  assert.equal(developmentTestData(true, true, "", "?demo=invalid"), true);
});
test("production ignores development defaults and query overrides", () => {
  for (const saved of [true, false])
    for (const mode of ["demo", "backend", "guest"])
      for (const search of ["", "?demo=1", "?demo=0"])
        assert.equal(developmentTestData(saved, false, mode, search), saved);
});
test("backend test tools reject hosted targets and malformed local origins", () => {
  assert.equal(localOrigin("http://127.0.0.1:56321"), "http://127.0.0.1:56321");
  assert.equal(localOrigin("http://localhost:55321"), "http://localhost:55321");
  for (const value of [
    "https://example.supabase.co",
    "http://127.0.0.1.evil.test",
    "http://user:pass@localhost",
    "http://localhost/rest/v1",
    "http://localhost?url=evil",
    "https://localhost",
  ])
    assert.throws(() => localOrigin(value), /loopback/);
  assert.equal(portBase(undefined, 55320), 55320);
  for (const value of ["oops", 80, 65530, 55320.5])
    assert.throws(() => portBase(value, 55320));
});

test("Vite frontend modes exclude hosted credentials and backend mode refuses a hosted target", async () => {
  const { loadConfigFromFile } = await import("vite");
  const saved = {};
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ])
    saved[key] = process.env[key];
  process.env.VITE_SUPABASE_URL = "https://not-a-development-target.invalid";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY =
    "sb_secret_must_never_reach_a_frontend";
  process.env.VITE_SUPABASE_ANON_KEY =
    "legacy_must_not_override_an_empty_demo_key";
  try {
    for (const mode of ["demo", "guest"]) {
      const result = await loadConfigFromFile(
        { command: "serve", mode },
        undefined,
        undefined,
        "silent",
      );
      assert.equal(
        result.config.define["import.meta.env.VITE_SUPABASE_URL"],
        '""',
      );
      assert.equal(
        result.config.define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"],
        '""',
      );
      assert.equal(
        result.config.define["import.meta.env.VITE_SUPABASE_ANON_KEY"],
        '""',
      );
    }
    await assert.rejects(
      loadConfigFromFile(
        { command: "serve", mode: "backend" },
        undefined,
        undefined,
        "silent",
      ),
      /loopback/,
    );
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("integration allocation avoids occupied mail ports and keeps explicit port choices strict", async (t) => {
  const { createServer } = await import("node:net");
  const { integrationPortBase } = await import("../scripts/local-supabase.mjs");
  const base = await integrationPortBase();
  assert.ok(base >= 10000 && base <= 29990);
  const occupied = createServer();
  await new Promise((resolve, reject) => {
    occupied.once("error", reject);
    occupied.listen(base + 6, "0.0.0.0", resolve);
  });
  t.after(() =>
    occupied.listening
      ? new Promise((resolve) => occupied.close(resolve))
      : undefined,
  );
  const next = await integrationPortBase();
  assert.notEqual(next, base);
  const candidates = [base, next];
  assert.equal(
    await integrationPortBase(undefined, () => candidates.shift()),
    next,
  );
  await assert.rejects(integrationPortBase(base), /occupied/);
  // The failed probes released their API/database ports and did not stop the
  // process owning the conflicting POP3 port.
  assert.equal(occupied.listening, true);
  await new Promise((resolve) => occupied.close(resolve));
  assert.equal(await integrationPortBase(base), base);
});
