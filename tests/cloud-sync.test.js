import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress, STORAGE_KEY } from "../src/progress.js";
import { trainingBackup, restoreBackup } from "../src/training-backup.js";
import {
  createTrainingStorage,
  accountStorage,
} from "../src/training-storage.js";
import {
  createCloudSync,
  cloudBackup,
  canonical,
  SYNC_KEY,
} from "../src/cloud-sync.js";
import {
  supabaseConfig,
  readAuthRedirect,
  trainingRemote,
} from "../src/supabase.js";

const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};
const backup = (selected = []) =>
  trainingBackup({ ...emptyProgress(), selected }, [], {
    cubes: [],
    defaultId: null,
  });
function setup() {
  let local = backup(["pll-T"]);
  let row = null;
  let writes = 0;
  let fail = false;
  const storage = memory();
  const remote = {
    async read() {
      if (fail) throw Error("offline");
      return structuredClone(row);
    },
    async write(payload, revision) {
      if (fail) throw Error("offline");
      writes++;
      if ((row?.revision ?? 0) !== revision) return null;
      row = { payload: structuredClone(payload), revision: revision + 1 };
      return row.revision;
    },
  };
  const options = {
    remote,
    storage,
    catalog,
    read: () => structuredClone(local),
    replace: (value) => {
      local = structuredClone(value);
    },
  };
  return {
    storage,
    remote,
    options,
    engine: createCloudSync(options),
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
    get writes() {
      return writes;
    },
    set fail(value) {
      fail = value;
    },
  };
}

test("public configuration is optional, allows Vercel/public keys and refuses privileged keys", () => {
  assert.equal(supabaseConfig({}), null);
  const env = {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  };
  assert.deepEqual(supabaseConfig(env), {
    url: env.VITE_SUPABASE_URL,
    key: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  for (const key of [
    "sb_secret_no",
    `x.${btoa(JSON.stringify({ role: "service_role" }))}.x`,
    "bad-key",
  ])
    assert.throws(() =>
      supabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
    );
  assert.throws(() =>
    supabaseConfig({ VITE_SUPABASE_URL: env.VITE_SUPABASE_URL }),
  );
  assert.throws(() =>
    supabaseConfig({ ...env, VITE_SUPABASE_URL: "http://example.com" }),
  );
});

test("guest, two accounts, restore journals and test-data storage remain isolated", () => {
  const storage = memory();
  const training = createTrainingStorage(storage, () => backup());
  training.setItem(STORAGE_KEY, JSON.stringify(backup(["pll-T"]).progress));
  training.setAccount("user-a");
  assert.equal(training.getItem(STORAGE_KEY), null);
  restoreBackup(training.target, backup(["pll-Ua"]));
  const a = training.getItem(STORAGE_KEY);
  training.setAccount("user-b");
  assert.equal(training.getItem(STORAGE_KEY), null);
  training.setTestData(true);
  const demo = training.getItem(STORAGE_KEY);
  training.setItem(STORAGE_KEY, "demo changes");
  training.setTestData(false);
  assert.equal(training.getItem(STORAGE_KEY), null);
  training.setAccount("user-a");
  assert.equal(training.getItem(STORAGE_KEY), a);
  training.setAccount(null);
  assert.deepEqual(JSON.parse(training.getItem(STORAGE_KEY)).selected, [
    "pll-T",
  ]);
  assert.notEqual(demo, a);
  assert.throws(() => accountStorage(storage, "../user"));
});

test("cloud input requires a complete validated backup and canonical comparison ignores object key order", () => {
  for (const data of [
    emptyProgress(),
    { ...backup(), solves: [{ bad: true }] },
    { ...backup(), cubeCollection: null },
    { ...backup(), version: 2 },
  ])
    assert.throws(() => cloudBackup(data, catalog));
  assert.equal(canonical({ b: 2, a: [3] }), canonical({ a: [3], b: 2 }));
});

test("first upload, reload, local edits and remote edits sync without duplicating attempts or saves", async () => {
  const s = setup();
  await s.engine.sync();
  assert.equal(s.row.revision, 1);
  assert.deepEqual(s.row.payload.progress.selected, ["pll-T"]);
  await s.engine.sync();
  assert.equal(s.writes, 1);
  s.local = backup(["pll-Ua"]);
  const reloaded = createCloudSync(s.options);
  await reloaded.sync();
  assert.equal(s.row.revision, 2);
  s.row = { revision: 3, payload: backup(["pll-T", "pll-Ua"]) };
  await reloaded.sync();
  assert.deepEqual(s.local.progress.selected, ["pll-T", "pll-Ua"]);
  assert.equal(reloaded.snapshot.status, "synced");
});

test("independent offline selection edits combine while remote deletions are preserved", async () => {
  const s = setup();
  await s.engine.sync();
  s.local = backup(["pll-Ua"]);
  s.row = { revision: 2, payload: backup() };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(s.local.progress.selected, ["pll-Ua"]);
  assert.deepEqual(s.row.payload.progress.selected, ["pll-Ua"]);
  assert.equal(s.row.revision, 3);
  assert.equal(s.engine.snapshot.status, "synced");
});

test("first sign-in never silently replaces device or existing cloud data", async () => {
  const s = setup();
  s.row = { revision: 5, payload: backup(["pll-Ua"]) };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "conflict");
  assert.equal(s.writes, 0);
  await s.engine.sync("device");
  assert.deepEqual(s.row.payload.progress.selected, ["pll-T"]);
  assert.equal(s.row.revision, 6);
});

test("a choice cannot overwrite a cloud revision changed after conflict was displayed", async () => {
  const s = setup();
  s.row = { revision: 2, payload: backup(["pll-Ua"]) };
  await s.engine.sync();
  s.row = { revision: 3, payload: backup() };
  await s.engine.sync("device");
  assert.equal(s.engine.snapshot.status, "conflict");
  assert.equal(s.writes, 0);
  assert.deepEqual(s.row.payload.progress.selected, []);
});

test("compare-and-swap failure retains local state and requests an automatic retry", async () => {
  const s = setup();
  await s.engine.sync();
  s.local = backup(["pll-Ua"]);
  s.remote.write = async () => null;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "pending");
  assert.equal(s.engine.snapshot.retry, true);
  assert.deepEqual(s.local.progress.selected, ["pll-Ua"]);
});

test("offline and corrupt cloud data preserve both copies and allow retry", async () => {
  const s = setup();
  s.fail = true;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "error");
  assert.deepEqual(s.local.progress.selected, ["pll-T"]);
  s.fail = false;
  s.row = { revision: 1, payload: { version: 999 } };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "error");
  assert.equal(s.writes, 0);
  s.row = null;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
});

test("failed local replacement does not advance sync baseline or mutate local data", async () => {
  const s = setup();
  await s.engine.sync();
  const previous = s.storage.getItem(SYNC_KEY);
  s.row = { revision: 2, payload: backup() };
  const engine = createCloudSync({
    ...s.options,
    replace: () => {
      throw Error("quota");
    },
  });
  await engine.sync();
  assert.equal(engine.snapshot.status, "error");
  assert.equal(s.storage.getItem(SYNC_KEY), previous);
  assert.deepEqual(s.local.progress.selected, ["pll-T"]);
});

test("active work defers cloud replacement without advancing metadata", async () => {
  const s = setup();
  await s.engine.sync();
  s.row = { revision: 2, payload: backup() };
  const engine = createCloudSync({ ...s.options, canReplace: () => false });
  await engine.sync();
  assert.equal(engine.snapshot.status, "pending");
  assert.deepEqual(s.local.progress.selected, ["pll-T"]);
});

test("sign-out, identity change and demo activation cancel late downloads and uploads", async () => {
  for (const cancelAt of ["read", "write"]) {
    const s = setup();
    const method = s.remote[cancelAt];
    let release;
    let started;
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    s.remote[cancelAt] = async (...args) => {
      started();
      await new Promise((resolve) => {
        release = resolve;
      });
      return method(...args);
    };
    const pending = s.engine.sync();
    await ready;
    s.engine.cancel();
    release();
    await pending;
    assert.equal(s.storage.getItem(SYNC_KEY), null);
    assert.deepEqual(s.local.progress.selected, ["pll-T"]);
  }
});

test("edits during upload stay pending and the next sync sends the newer state", async () => {
  const s = setup();
  const write = s.remote.write;
  s.remote.write = async (...args) => {
    s.local = backup(["pll-Ua"]);
    return write(...args);
  };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "pending");
  assert.deepEqual(s.row.payload.progress.selected, ["pll-T"]);
  s.remote.write = write;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(s.row.payload.progress.selected, ["pll-Ua"]);
});

test("Supabase REST adapter uses session JWTs, owner-filtered reads and revision RPC", async () => {
  const calls = [];
  let session = { user: { id: "owner-a" }, access_token: "user-jwt" };
  const client = {
    auth: {
      async getSession() {
        return { data: { session } };
      },
    },
  };
  const request = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(
      JSON.stringify(
        url.includes("/rpc/") ? 2 : [{ revision: 1, payload: backup() }],
      ),
    );
  };
  const config = {
    url: "https://example.supabase.co",
    key: "sb_publishable_test",
  };
  const remote = trainingRemote(client, "owner-a", config, request);
  assert.equal((await remote.read()).revision, 1);
  assert.equal(await remote.write(backup(), 1), 2);
  assert.equal(calls[0].url.searchParams.get("user_id"), "eq.owner-a");
  assert.equal(calls[0].options.headers.Authorization, "Bearer user-jwt");
  assert.equal(calls[0].options.headers.apikey, config.key);
  assert.equal(calls[1].url.pathname, "/rest/v1/rpc/save_training_snapshot");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    payload: backup(),
    expected_revision: 1,
  });
  session = { ...session, user: { id: "owner-b" } };
  await assert.rejects(remote.write(backup(), 2), /session changed/);
  assert.equal(calls.length, 2);
});

test("REST adapter rejects network/API errors, malformed row sets, expired sessions and cancellation", async () => {
  const client = {
    auth: {
      async getSession() {
        return {
          data: { session: { user: { id: "owner" }, access_token: "jwt" } },
        };
      },
    },
  };
  const config = { url: "https://example.supabase.co", key: "public" };
  for (const response of [
    new Response("denied", { status: 403 }),
    new Response("{}"),
    new Response("[{},{}]"),
  ]) {
    await assert.rejects(
      trainingRemote(client, "owner", config, async () => response).read(),
    );
  }
  await assert.rejects(
    trainingRemote(client, "owner", config, async () => {
      throw Error("offline");
    }).read(),
    /offline/,
  );
  let aborted = false;
  const remote = trainingRemote(
    client,
    "owner",
    config,
    async (_url, options) => {
      aborted = options.signal.aborted;
      options.signal.throwIfAborted();
    },
  );
  remote.cancel();
  await assert.rejects(remote.read());
  assert.equal(aborted, true);
  client.auth.getSession = async () => ({ data: { session: null } });
  await assert.rejects(remote.read(), /session changed/);
});

test("auth link fragments are captured separately from hash routes and incomplete/expired links fail closed", () => {
  assert.equal(readAuthRedirect("#/cfop/pll/full?settings"), null);
  assert.deepEqual(
    readAuthRedirect(
      "#access_token=user-jwt&refresh_token=refresh&expires_in=3600",
    ),
    { access_token: "user-jwt", refresh_token: "refresh" },
  );
  assert.deepEqual(readAuthRedirect("#access_token=user-jwt"), { error: true });
  assert.deepEqual(
    readAuthRedirect("#error=access_denied&error_code=otp_expired"),
    { error: true },
  );
});

test("a fresh account cache restores existing cloud progress without offering to overwrite it with empty data", async () => {
  const s = setup();
  s.local = backup();
  s.row = { revision: 7, payload: backup(["pll-Ua"]) };
  const engine = createCloudSync({ ...s.options, isPristine: () => true });
  await engine.sync();
  assert.equal(engine.snapshot.status, "synced");
  assert.deepEqual(s.local.progress.selected, ["pll-Ua"]);
  assert.equal(s.writes, 0);
  assert.equal(JSON.parse(s.storage.getItem(SYNC_KEY)).revision, 7);
});

test("an intentionally saved empty device copy still requires a first-sync choice", async () => {
  const s = setup();
  s.local = backup();
  s.row = { revision: 2, payload: backup(["pll-Ua"]) };
  const engine = createCloudSync({ ...s.options, isPristine: () => false });
  await engine.sync();
  assert.equal(engine.snapshot.status, "conflict");
  assert.deepEqual(s.local.progress.selected, []);
  assert.equal(s.writes, 0);
});

test("clearing previously synced progress uploads the deletion even if the account now looks empty", async () => {
  const s = setup();
  await s.engine.sync();
  s.local = backup();
  const engine = createCloudSync({ ...s.options, isPristine: () => true });
  await engine.sync();
  assert.equal(engine.snapshot.status, "synced");
  assert.deepEqual(s.row.payload.progress.selected, []);
  assert.equal(s.row.revision, 2);
});

test("a device copy saved while the first cloud read is pending is never treated as pristine", async () => {
  const s = setup();
  s.local = backup();
  s.row = { revision: 2, payload: backup(["pll-Ua"]) };
  let pristine = true;
  const read = s.remote.read;
  s.remote.read = async () => {
    pristine = false;
    return read();
  };
  const engine = createCloudSync({ ...s.options, isPristine: () => pristine });
  await engine.sync();
  assert.equal(engine.snapshot.status, "conflict");
  assert.deepEqual(s.local.progress.selected, []);
  assert.equal(s.writes, 0);
});

test("damaged sync metadata requires a safe choice rather than permanently breaking sync", async () => {
  const s = setup();
  s.storage.setItem(SYNC_KEY, "broken");
  s.row = { revision: 3, payload: backup(["pll-Ua"]) };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "conflict");
  assert.deepEqual(s.local.progress.selected, ["pll-T"]);
  assert.equal(s.writes, 0);
  await s.engine.sync("cloud");
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(s.local.progress.selected, ["pll-Ua"]);
  assert.equal(JSON.parse(s.storage.getItem(SYNC_KEY)).revision, 3);
});

test("matching copies repair invalid metadata without changing the cloud", async () => {
  const s = setup();
  s.storage.setItem(
    SYNC_KEY,
    JSON.stringify({ revision: -1, fingerprint: "bad" }),
  );
  s.row = { revision: 4, payload: structuredClone(s.local) };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
  assert.equal(s.writes, 0);
  const base = JSON.parse(s.storage.getItem(SYNC_KEY));
  assert.equal(base.revision, 4);
  assert.match(base.fingerprint, /^[a-f0-9]{64}$/);
});

test("unavailable metadata storage still stops sync and preserves local data", async () => {
  const s = setup();
  s.storage.getItem = () => {
    throw Error("Storage unavailable");
  };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "error");
  assert.equal(s.writes, 0);
  assert.deepEqual(s.local.progress.selected, ["pll-T"]);
});

const syncSolve = (id, notes = "") => ({
  id,
  elapsed: 12345,
  date: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
  scramble: Array(10).fill("R U").join(" "),
  notes,
});
test("a racing first upload retries without asking for a whole-copy choice", async () => {
  const s = setup();
  s.remote.write = async () => null;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "pending");
  assert.equal(s.engine.snapshot.retry, true);
  assert.equal(s.engine.snapshot.conflict, false);
  assert.equal(s.storage.getItem(SYNC_KEY), null);
  s.row = { revision: 1, payload: structuredClone(s.local) };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "synced");
});
test("merged uploads preserve the prior baseline when another local save happens in flight", async () => {
  const s = setup();
  await s.engine.sync();
  const previous = s.storage.getItem(SYNC_KEY);
  s.local.solves.push(syncSolve("device"));
  const cloud = backup(["pll-T"]);
  cloud.solves.push(syncSolve("cloud"));
  s.row = { revision: 2, payload: cloud };
  const write = s.remote.write;
  s.remote.write = async (...args) => {
    const revision = await write(...args);
    s.local.solves.push(syncSolve("during-upload"));
    s.remote.write = write;
    return revision;
  };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "pending");
  assert.equal(s.storage.getItem(SYNC_KEY), previous);
  assert.deepEqual(
    s.row.payload.solves.map((solve) => solve.id),
    ["cloud", "device"],
  );
  assert.deepEqual(
    s.local.solves.map((solve) => solve.id),
    ["device", "during-upload"],
  );
  const reload = createCloudSync(s.options);
  await reload.sync();
  assert.equal(reload.snapshot.status, "synced");
  assert.deepEqual(
    s.local.solves.map((solve) => solve.id),
    ["cloud", "device", "during-upload"],
  );
  assert.deepEqual(s.row.payload, s.local);
});
test("resolving conflicting notes keeps independent solves from both devices", async () => {
  const s = setup();
  s.local.solves.push(syncSolve("shared", "old"));
  await s.engine.sync();
  s.local.solves[0].notes = "device edit";
  s.local.solves.push(syncSolve("device-new"));
  const cloud = backup(["pll-T"]);
  cloud.solves = [syncSolve("shared", "cloud edit"), syncSolve("cloud-new")];
  s.row = { revision: 2, payload: cloud };
  await s.engine.sync();
  assert.equal(s.engine.snapshot.mergeConflict, true);
  assert.equal(s.row.revision, 2);
  await s.engine.sync("cloud");
  assert.equal(s.engine.snapshot.status, "synced");
  assert.deepEqual(
    s.local.solves.map((solve) => solve.id),
    ["cloud-new", "device-new", "shared"],
  );
  assert.equal(
    s.local.solves.find((solve) => solve.id === "shared").notes,
    "cloud edit",
  );
  assert.deepEqual(s.row.payload, s.local);
});
test("failed compare-and-swap of a merged upload never replaces local data or advances its baseline", async () => {
  const s = setup();
  await s.engine.sync();
  const previous = s.storage.getItem(SYNC_KEY);
  s.local.solves.push(syncSolve("device"));
  const cloud = backup(["pll-T"]);
  cloud.solves.push(syncSolve("cloud"));
  s.row = { revision: 2, payload: cloud };
  s.remote.write = async () => null;
  await s.engine.sync();
  assert.equal(s.engine.snapshot.status, "pending");
  assert.equal(s.engine.snapshot.retry, true);
  assert.equal(s.storage.getItem(SYNC_KEY), previous);
  assert.deepEqual(
    s.local.solves.map((solve) => solve.id),
    ["device"],
  );
  assert.deepEqual(
    s.row.payload.solves.map((solve) => solve.id),
    ["cloud"],
  );
});
