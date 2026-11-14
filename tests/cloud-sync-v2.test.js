import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";
import { trainingBackup } from "../src/training-backup.js";
import {
  normalizeTrainingSnapshot,
  trainingFingerprint,
} from "../src/training-schema.js";
import {
  createCloudSync,
  cloudBackup,
  SYNC_KEY,
  SYNC_V2_KEY,
} from "../src/cloud-sync.js";

const v1 = () =>
  trainingBackup(emptyProgress(), [], { cubes: [], defaultId: null });
const v2 = () => normalizeTrainingSnapshot(v1(), catalog);
const solve = (id, eventId = "222") => ({
  id,
  eventId,
  elapsed: 5000,
  date: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
  scramble: "R U F2",
  scrambleGrip: { up: "white", front: "green" },
});
function setup(options = {}) {
  let local = v2(),
    row = null,
    ready = true;
  const values = new Map(),
    writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const remote = {
    read: async () => structuredClone(row),
    write: async (payload, revision) => {
      writes.push(structuredClone({ payload, revision }));
      if ((row?.revision ?? 0) !== revision) return null;
      row = { revision: revision + 1, payload: structuredClone(payload) };
      return row.revision;
    },
  };
  const config = {
    storage,
    remote,
    catalog,
    read: () => structuredClone(local),
    replace: (value) => {
      local = structuredClone(value);
    },
    schemaVersion: 2,
    canWriteV2: () => ready,
    ...options,
  };
  return {
    storage,
    remote,
    writes,
    config,
    engine: createCloudSync(config),
    get local() {
      return local;
    },
    set local(value) {
      local = value;
    },
    get row() {
      return row;
    },
    set row(value) {
      row = value;
    },
    set ready(value) {
      ready = value;
    },
  };
}
async function remember(storage, payload, revision = 1, key = SYNC_KEY) {
  storage.setItem(
    key,
    JSON.stringify({
      revision,
      fingerprint: await trainingFingerprint(payload),
      payload,
    }),
  );
}

test("v2 normalization is explicit and default sync never accepts or projects v2 down to v1", async () => {
  assert.throws(() => cloudBackup(v2(), catalog), /full training backup/);
  assert.deepEqual(cloudBackup(v1(), catalog, { version: 2 }), v2());
  const s = setup({ schemaVersion: 1 });
  await s.engine.sync();
  assert.equal(s.engine.snapshot.failure, "local");
  assert.equal(s.writes.length, 0);
});

test("v2 writes default closed and can become ready without reconstructing the sync engine", async () => {
  const s = setup({ canWriteV2: undefined });
  await s.engine.sync();
  assert.equal(s.engine.snapshot.pendingReason, "schema");
  assert.equal(s.writes.length, 0);
  assert.equal(s.storage.getItem(SYNC_V2_KEY), null);
  const dynamic = setup();
  dynamic.ready = false;
  await dynamic.engine.sync();
  assert.equal(dynamic.engine.snapshot.pendingReason, "schema");
  dynamic.ready = true;
  await dynamic.engine.sync();
  assert.equal(dynamic.engine.snapshot.status, "synced");
  assert.equal(dynamic.row.payload.version, 2);
});

test("equal normalized v1 cloud still gets exactly one schema-only CAS and preserves the original checkpoint", async () => {
  const s = setup();
  const old = v1();
  await remember(s.storage, old, 3);
  const original = s.storage.getItem(SYNC_KEY);
  s.row = { revision: 3, payload: old };
  await s.engine.sync();
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].revision, 3);
  assert.equal(s.writes[0].payload.version, 2);
  assert.equal(s.engine.snapshot.result, "updated");
  assert.equal(s.storage.getItem(SYNC_KEY), original);
  const checkpoint = JSON.parse(s.storage.getItem(SYNC_V2_KEY));
  assert.equal(checkpoint.revision, 4);
  assert.equal(checkpoint.payload.version, 2);
  assert.equal(
    checkpoint.fingerprint,
    await trainingFingerprint(checkpoint.payload),
  );
  await s.engine.sync();
  assert.equal(s.writes.length, 1);
  assert.equal(s.engine.snapshot.result, "unchanged");
});

test("original v1 fingerprint authenticates the deletion baseline before migration", async () => {
  const old = v1();
  old.solves.push({
    id: "deleted",
    elapsed: 12345,
    date: "2026-10-20T12:00:00Z",
    scramble: Array(10).fill("R U").join(" "),
  });
  const s = setup();
  await remember(s.storage, old);
  s.local = normalizeTrainingSnapshot(old, catalog);
  s.local.solves = [];
  s.row = { revision: 2, payload: normalizeTrainingSnapshot(old, catalog) };
  s.row.payload.solves.push(solve("remote-new"));
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(
    s.local.solves.map((record) => record.id),
    ["remote-new"],
  );
  assert.deepEqual(
    s.row.payload.solves.map((record) => record.id),
    ["remote-new"],
  );
});

test("tampered legacy baseline cannot silently authorize a three-way merge", async () => {
  const s = setup(),
    old = v1();
  await remember(s.storage, old);
  const metadata = JSON.parse(s.storage.getItem(SYNC_KEY));
  metadata.payload.progress.selected = ["pll-T"];
  s.storage.setItem(SYNC_KEY, JSON.stringify(metadata));
  s.local.solves.push(solve("local"));
  s.row = { revision: 2, payload: v2() };
  s.row.payload.solves.push(solve("cloud", "333oh"));
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "conflict");
  assert.equal(s.writes.length, 0);
});

test("gate is rechecked after an in-flight read and a throwing stale-tab guard prevents upload", async () => {
  const s = setup();
  let release;
  s.remote.read = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = s.engine.sync();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  s.ready = false;
  release(null);
  await pending;
  assert.equal(s.writes.length, 0);
  assert.equal(s.engine.snapshot.pendingReason, "schema");
  const stale = setup({
    canWriteV2: () => {
      throw new Error("old tab wrote data");
    },
  });
  await stale.engine.sync();
  assert.equal(stale.writes.length, 0);
  assert.equal(stale.engine.snapshot.failure, "local");
});

test("schema-only CAS failure retains both checkpoints and local state", async () => {
  const s = setup();
  const old = v1();
  await remember(s.storage, old);
  const original = s.storage.getItem(SYNC_KEY);
  s.row = { revision: 1, payload: old };
  s.remote.write = async () => null;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "pending");
  assert.equal(s.engine.snapshot.retry, true);
  assert.equal(s.storage.getItem(SYNC_KEY), original);
  assert.equal(s.storage.getItem(SYNC_V2_KEY), null);
  assert.deepEqual(s.local, v2());
});

test("fresh v2 cache imports and upgrades v1 cloud before acknowledging it", async () => {
  const s = setup({ isPristine: () => true });
  const old = v1();
  old.progress.selected = ["pll-T"];
  s.row = { revision: 4, payload: old };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(s.local.progress.selected, ["pll-T"]);
  assert.equal(s.local.version, 2);
  assert.equal(s.row.revision, 5);
  assert.equal(s.row.payload.version, 2);
});

test("v2 baseline combines interleaved event history without stripping grips or provenance", async () => {
  const s = setup();
  await s.engine.sync();
  s.local.solves.push({
    ...solve("local"),
    scrambleProvenance: {
      id: "local-generator",
      version: "1",
      method: "random-state",
    },
  });
  s.row = { revision: 2, payload: v2() };
  s.row.payload.solves.push(solve("remote", "333oh"));
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(
    s.local.solves.map((item) => item.eventId),
    ["222", "333oh"],
  );
  assert.equal(s.local.solves[0].scrambleProvenance.id, "local-generator");
  assert.deepEqual(s.local.solves[1].scrambleGrip, {
    up: "white",
    front: "green",
  });
});

test("async atomic replacement must commit before the normalized baseline is acknowledged", async () => {
  let release;
  const s = setup({
    isPristine: () => true,
    replace: () =>
      new Promise((resolve, reject) => {
        release = { resolve, reject };
      }),
  });
  s.row = { revision: 2, payload: v2() };
  s.row.payload.solves.push(solve("cloud"));
  const pending = s.engine.sync();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.storage.getItem(SYNC_V2_KEY), null);
  release.reject(new Error("atomic commit failed"));
  await pending;
  assert.equal(s.engine.snapshot.failure, "local");
  assert.equal(s.storage.getItem(SYNC_V2_KEY), null);
  assert.equal(s.local.solves.length, 0);
});

test("a gate closing during upload prevents stale local replacement or checkpoint acknowledgement", async () => {
  const s = setup();
  const originalWrite = s.remote.write;
  s.remote.write = async (...args) => {
    const revision = await originalWrite(...args);
    s.ready = false;
    return revision;
  };
  await s.engine.sync();
  assert.equal(
    s.row.payload.version,
    2,
    "an already transmitted CAS cannot be undone locally",
  );
  assert.equal(s.engine.snapshot.pendingReason, "schema");
  assert.equal(s.storage.getItem(SYNC_V2_KEY), null);
  assert.equal(s.engine.snapshot.result, null);
});
