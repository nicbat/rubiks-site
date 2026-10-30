import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import catalog from "../../data/algorithms.json" with { type: "json" };
import { createTrainingStorage } from "../../src/training-storage.js";
import { emptyProgress, setKnown, STORAGE_KEY } from "../../src/progress.js";
import { SOLVES_KEY } from "../../src/solve-history.js";
import { CUBES_KEY } from "../../src/cubes.js";
import { trainingBackup, restoreBackup } from "../../src/training-backup.js";
import { mergeBackup, prepareBackupImport } from "../../src/backup-import.js";
import { createCloudSync } from "../../src/cloud-sync.js";
import { createSyncQueue } from "../../src/sync-queue.js";
import { trainingRemote } from "../../src/supabase.js";
import { profileRemote } from "../../src/profiles.js";
import { backendConfig, closeClients, signIn } from "./helpers.js";

const keys = [STORAGE_KEY, SOLVES_KEY, CUBES_KEY];
const empty = () =>
  trainingBackup(emptyProgress(), [], { cubes: [], defaultId: null });
function memory() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
const marks = () => ({
  ...emptyProgress(),
  selected: ["oll-27", "pll-Y"],
  known: { "oll-27": [0], "pll-Y": [1] },
  variants: { "pll-Y": 1 },
});
const timerSolve = (id) => ({
  id,
  cubeId: null,
  elapsed: 15321,
  date: "2026-10-26T23:00:00Z",
  day: "2026-10-26",
  scramble: Array(10).fill("R U").join(" "),
});

// Use the same committed storage, account namespaces, full-backup adapter and
// sync queue as main.js. Every simulated browser/origin gets separate storage.
function device(t, client, accountId, config, browser = memory()) {
  let offline = false;
  let busy = false;
  const storage = createTrainingStorage(browser, () => empty());
  storage.setAccount(accountId);
  const read = () =>
    trainingBackup(
      JSON.parse(
        storage.getItem(STORAGE_KEY) || JSON.stringify(emptyProgress()),
      ),
      JSON.parse(storage.getItem(SOLVES_KEY) || "[]"),
      JSON.parse(storage.getItem(CUBES_KEY) || '{"cubes":[],"defaultId":null}'),
    );
  const actual = trainingRemote(client, accountId, config);
  const available = (operation) => {
    if (offline) throw new TypeError("Device offline");
    return operation();
  };
  const engine = createCloudSync({
    catalog,
    storage: storage.target,
    read,
    replace: (value) => restoreBackup(storage.target, value),
    isPristine: () => keys.every((key) => storage.target.getItem(key) === null),
    canReplace: () => !busy,
    remote: {
      read: () => available(() => actual.read()),
      write: (value, revision) =>
        available(() => actual.write(value, revision)),
      cancel: () => actual.cancel(),
    },
  });
  const queue = createSyncQueue(engine);
  t.after(() => queue.cancel());
  return {
    browser,
    storage,
    read,
    queue,
    engine,
    set offline(value) {
      offline = value;
    },
    set busy(value) {
      busy = value;
    },
    saveProgress(value) {
      storage.setItem(STORAGE_KEY, JSON.stringify(value));
      return queue.request();
    },
    saveSolve(value) {
      storage.setItem(SOLVES_KEY, JSON.stringify([...read().solves, value]));
      return queue.request();
    },
  };
}

test(
  "simulate case progress across guest, signed-in, offline and fresh computer storage",
  { timeout: 90000 },
  async (t) => {
    const clients = [];
    t.after(() => closeClients(clients));
    const config = backendConfig();
    const id = randomUUID().replaceAll("-", "").slice(0, 12);
    const owner = await signIn(`sync-simulation-${id}@example.test`, clients);
    await profileRemote(owner.client, owner.id, config).claim(
      `simulation_${id}`,
    );
    const remote = trainingRemote(owner.client, owner.id, config);
    await remote.write(empty(), 0);

    await t.test(
      "guest marks plus account solves reproduce a healthy sync with no cloud case marks; explicit transfer repairs it",
      async (t) => {
        const browser = memory();
        browser.setItem(STORAGE_KEY, JSON.stringify(marks()));
        const guestBytes = browser.getItem(STORAGE_KEY);
        const first = device(t, owner.client, owner.id, config, browser);
        await first.queue.request();
        await first.saveSolve(timerSolve("signed-in-solve"));
        const saved = await remote.read();
        assert.equal(first.engine.snapshot.status, "synced");
        assert.equal(saved.payload.solves.length, 1);
        assert.deepEqual(saved.payload.progress.selected, []);
        assert.equal(saved.payload.progress.known, undefined);
        assert.equal(
          browser.getItem(STORAGE_KEY),
          guestBytes,
          "Signing in preserves guest learning locally",
        );
        const second = device(t, owner.client, owner.id, config);
        await second.queue.request();
        assert.equal(second.read().solves.length, 1);
        assert.equal(
          second.read().progress.known,
          undefined,
          "A second computer sees solves but no guest learning",
        );
        const merged = mergeBackup(
          first.read(),
          JSON.parse(guestBytes),
          catalog,
        ).backup;
        restoreBackup(first.storage.target, merged);
        await first.queue.request();
        await second.queue.request();
        assert.deepEqual(second.read().progress.known, marks().known);
        assert.equal(second.read().solves.length, 1);
        assert.equal(
          browser.getItem(STORAGE_KEY),
          guestBytes,
          "Transfer keeps the original guest copy",
        );
      },
    );

    await t.test(
      "older v1 learning stays out of the v2 account while timer data remains; explicit legacy import restores marks",
      async (t) => {
        const prior = await remote.read();
        await remote.write(
          trainingBackup(
            emptyProgress(),
            prior.payload.solves,
            prior.payload.cubeCollection,
          ),
          prior.revision,
        );
        const browser = memory();
        const legacy = { ...marks(), version: 1 };
        browser.setItem("last-layer.progress.v1", JSON.stringify(legacy));
        const first = device(t, owner.client, owner.id, config, browser);
        await first.queue.request();
        // The current guest-import reader checks v2, so an old v1-only browser
        // has no guest learning to offer until its backup is explicitly imported.
        assert.equal(browser.getItem(STORAGE_KEY), null);
        assert.equal(first.read().progress.known, undefined);
        assert.equal(first.read().solves.length, 1);
        assert.equal(
          browser.getItem("last-layer.progress.v1"),
          JSON.stringify(legacy),
        );
        const prepared = await prepareBackupImport(legacy, catalog);
        const merged = mergeBackup(first.read(), prepared, catalog).backup;
        restoreBackup(first.storage.target, merged);
        await first.queue.request();
        const second = device(t, owner.client, owner.id, config);
        await second.queue.request();
        assert.deepEqual(second.read().progress.known, marks().known);
        assert.equal(second.read().solves.length, 1);
      },
    );

    await t.test(
      "an existing empty account cache requires a recovery choice rather than silently downloading or overwriting learning",
      async (t) => {
        const browser = memory();
        const first = device(t, owner.client, owner.id, config, browser);
        restoreBackup(first.storage.target, empty());
        const before = await remote.read();
        await first.queue.request();
        assert.equal(first.engine.snapshot.status, "conflict");
        assert.deepEqual(first.read().progress.selected, []);
        assert.equal((await remote.read()).revision, before.revision);
        await first.queue.request("cloud");
        assert.equal(first.engine.snapshot.status, "synced");
        assert.deepEqual(first.read().progress.known, marks().known);
      },
    );

    await t.test(
      "offline OLL/PLL edits remain local until reconnect and then survive an independent solve on another computer",
      async (t) => {
        const first = device(t, owner.client, owner.id, config);
        const second = device(t, owner.client, owner.id, config);
        await first.queue.request();
        await second.queue.request();
        first.offline = true;
        const progress = first.read().progress;
        setKnown(progress, "oll-21", 0, true);
        setKnown(progress, "pll-T", 0, true);
        await first.saveProgress(progress);
        assert.equal(first.engine.snapshot.status, "error");
        assert.equal(
          (await remote.read()).payload.progress.known["pll-T"],
          undefined,
        );
        await second.saveSolve(timerSolve("other-device-solve"));
        first.offline = false;
        await first.queue.request();
        await second.queue.request();
        assert.equal(first.engine.snapshot.status, "synced");
        assert.deepEqual(second.read().progress.known["oll-21"], [0]);
        assert.deepEqual(second.read().progress.known["pll-T"], [0]);
        assert.equal(second.read().solves.length, 2);
      },
    );

    await t.test(
      "active work can leave a second computer temporarily behind while cloud already contains the marks",
      async (t) => {
        const first = device(t, owner.client, owner.id, config);
        const second = device(t, owner.client, owner.id, config);
        await first.queue.request();
        await second.queue.request();
        second.busy = true;
        const progress = first.read().progress;
        setKnown(progress, "pll-H", 0, true);
        await first.saveProgress(progress);
        await second.queue.request();
        assert.equal(second.engine.snapshot.pendingReason, "incoming");
        assert.equal(second.read().progress.known["pll-H"], undefined);
        assert.deepEqual(
          (await remote.read()).payload.progress.known["pll-H"],
          [0],
        );
        second.busy = false;
        await second.queue.request();
        assert.deepEqual(second.read().progress.known["pll-H"], [0]);
      },
    );

    await t.test(
      "leaving before the upload starts keeps case edits on the original computer until that account resumes sync",
      async (t) => {
        const first = device(t, owner.client, owner.id, config);
        const second = device(t, owner.client, owner.id, config);
        await first.queue.request();
        await second.queue.request();
        const progress = first.read().progress;
        setKnown(progress, "oll-23", 0, true);
        const saving = first.saveProgress(progress);
        first.queue.cancel();
        await saving;
        assert.deepEqual(first.read().progress.known["oll-23"], [0]);
        await second.queue.request();
        assert.equal(second.read().progress.known["oll-23"], undefined);
        const resumed = device(
          t,
          owner.client,
          owner.id,
          config,
          first.browser,
        );
        await resumed.queue.request();
        await second.queue.request();
        assert.deepEqual(second.read().progress.known["oll-23"], [0]);
      },
    );
    await t.test(
      "an older computer adding a solve cannot erase newer OLL/PLL marks",
      async (t) => {
        const first = device(t, owner.client, owner.id, config);
        const second = device(t, owner.client, owner.id, config);
        await first.queue.request();
        await second.queue.request();
        const progress = first.read().progress;
        setKnown(progress, "oll-22", 0, true);
        await first.saveProgress(progress);
        await second.saveSolve(timerSolve("stale-device-solve"));
        assert.deepEqual(
          (await remote.read()).payload.progress.known["oll-22"],
          [0],
        );
        assert.deepEqual(second.read().progress.known["oll-22"], [0]);
      },
    );
  },
);
