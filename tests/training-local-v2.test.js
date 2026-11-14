import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress, STORAGE_KEY } from "../src/progress.js";
import { SOLVES_KEY } from "../src/solve-history.js";
import { CUBES_KEY } from "../src/cubes.js";
import { RESTORE_KEY } from "../src/training-backup.js";
import { accountStorage } from "../src/training-storage.js";
import {
  createTrainingV2Store,
  TRAINING_V2_KEY,
  LEGACY_TRAINING_KEYS,
  trainingWebLockRunner,
  assertLegacyTrainingWritable,
  readLegacyTrainingV2,
} from "../src/training-local-v2.js";

const SYNC_KEY = "last-layer.sync.v1";
const solve = {
  id: "legacy",
  elapsed: 12000,
  date: "2026-10-17T01:00:00Z",
  day: "2026-10-16",
  scramble: Array(10).fill("R U").join(" "),
  notes: "Preserve\nnotes",
};
function memory(entries = []) {
  const values = new Map(entries);
  const writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
}
function legacyEntries() {
  return [
    [STORAGE_KEY, JSON.stringify(emptyProgress(), null, 2)],
    [SOLVES_KEY, JSON.stringify([solve], null, 2)],
    [CUBES_KEY, '{ "cubes": [], "defaultId": null }'],
    [
      SYNC_KEY,
      '{ "revision":7,"fingerprint":"original unchanged bytes","payload":null }',
    ],
  ];
}
function locks() {
  const pending = new Map();
  return async (name, operation) => {
    const previous = pending.get(name) ?? Promise.resolve();
    let release;
    const tail = new Promise((resolve) => {
      release = resolve;
    });
    pending.set(name, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}
let sequence = 0;
function store(storage, options = {}) {
  return createTrainingV2Store({
    storage,
    catalog,
    scope: "guest:false",
    withLock: locks(),
    createToken: () => `token-${++sequence}`,
    ...options,
  });
}
function changed(payload, id = "new") {
  return {
    ...payload,
    solves: [
      ...payload.solves,
      {
        ...solve,
        id,
        eventId: "333oh",
        scrambleGrip: { up: "white", front: "green" },
      },
    ],
  };
}

test("migration atomically publishes a full v2 envelope and preserves exact original bytes", async () => {
  const storage = memory(legacyEntries());
  const originals = Object.fromEntries(
    LEGACY_TRAINING_KEYS.map((key) => [key, storage.getItem(key)]),
  );
  const session = store(storage);
  const result = await session.open();
  assert.equal(result.migrated, true);
  assert.equal(result.ready, true);
  assert.equal(result.legacyPristine, false);
  assert.deepEqual(result.legacyOriginals, originals);
  assert.deepEqual(
    Object.fromEntries(
      LEGACY_TRAINING_KEYS.map((key) => [key, storage.getItem(key)]),
    ),
    originals,
  );
  assert.deepEqual(result.payload.solves, [
    {
      ...solve,
      eventId: "333",
      scrambleGrip: { up: "yellow", front: "green" },
    },
  ]);
  assert.deepEqual(storage.writes, [TRAINING_V2_KEY]);
  assert.equal(result.payload.version, 2);
  assert.equal(session.assertWritable(), true);
  result.legacyOriginals[STORAGE_KEY] = "changed return object";
  result.payload.solves[0].notes = "mutated return object";
  assert.equal(
    session.inspect().legacyOriginals[STORAGE_KEY],
    originals[STORAGE_KEY],
  );
  assert.equal(session.inspect().payload.solves[0].notes, solve.notes);
});

test("empty guest migration remains distinguishable from a previously saved empty account", async () => {
  const empty = await store(memory()).open();
  assert.equal(empty.legacyPristine, true);
  assert.deepEqual(empty.payload.solves, []);
  assert.deepEqual(empty.payload.cubeCollection, {
    cubes: [],
    defaultsByEvent: {},
  });
  const saved = await store(
    memory([[STORAGE_KEY, JSON.stringify(emptyProgress())]]),
  ).open();
  assert.equal(saved.legacyPristine, false);
});

test("migration quota/storage failure leaves all originals and no partial v2 result", async () => {
  const storage = memory(legacyEntries());
  const before = [...storage.values];
  const native = storage.setItem;
  storage.setItem = () => {
    throw new Error("quota exceeded");
  };
  await assert.rejects(store(storage).open(), /quota/);
  assert.deepEqual([...storage.values], before);
  storage.setItem = native;
  assert.equal((await store(storage).open()).ready, true);
});

test("read failures and malformed legacy sources never publish an empty replacement", async () => {
  for (const key of LEGACY_TRAINING_KEYS) {
    const storage = memory(legacyEntries());
    const before = [...storage.values];
    const get = storage.getItem;
    storage.getItem = (requested) => {
      if (requested === key) throw Error("read unavailable");
      return get(requested);
    };
    await assert.rejects(store(storage).open(), /unavailable/);
    assert.deepEqual([...storage.values], before);
  }
  for (const key of [STORAGE_KEY, SOLVES_KEY, CUBES_KEY]) {
    const storage = memory(legacyEntries());
    storage.values.set(key, "malformed");
    const before = [...storage.values];
    await assert.rejects(store(storage).open());
    assert.deepEqual([...storage.values], before);
  }
});

test("a pending legacy restore is preserved for existing journal recovery before migration", async () => {
  const storage = memory([
    ...legacyEntries(),
    [RESTORE_KEY, JSON.stringify([null, null, null])],
  ]);
  const before = [...storage.values];
  await assert.rejects(store(storage).open(), {
    code: "LEGACY_RESTORE_PENDING",
  });
  assert.deepEqual([...storage.values], before);
});

test("interruption after the atomic publication reopens the committed v2 envelope without repeating migration", async () => {
  const storage = memory(legacyEntries());
  const interrupted = store(storage, {
    withLock: async (_, operation) => {
      operation();
      throw Error("process stopped after write");
    },
  });
  await assert.rejects(interrupted.open(), /process stopped/);
  const raw = storage.getItem(TRAINING_V2_KEY);
  assert.notEqual(raw, null);
  const recovered = await store(storage).open();
  assert.equal(recovered.migrated, false);
  assert.equal(recovered.ready, true);
  assert.equal(storage.getItem(TRAINING_V2_KEY), raw);
  assert.deepEqual(storage.writes, [TRAINING_V2_KEY]);
});

test("commit failure retains the complete previous v2 envelope and original v1 copies", async () => {
  const storage = memory(legacyEntries());
  const session = store(storage);
  const opened = await session.open();
  const before = [...storage.values];
  const set = storage.setItem;
  storage.setItem = () => {
    throw Error("storage full");
  };
  await assert.rejects(
    session.commit(changed(opened.payload), { expectedToken: opened.token }),
    /storage full/,
  );
  assert.deepEqual([...storage.values], before);
  storage.setItem = set;
  const saved = await session.commit(changed(opened.payload), {
    expectedToken: opened.token,
  });
  assert.notEqual(saved.token, opened.token);
  assert.deepEqual(saved.legacyOriginals, opened.legacyOriginals);
  assert.equal(saved.payload.solves.length, 2);
  assert.equal(saved.ready, true);
});

test("shared locks and expected tokens prevent two tabs from silently overwriting each other's saves", async () => {
  const storage = memory(legacyEntries());
  const withLock = locks();
  const first = store(storage, { withLock });
  const second = store(storage, { withLock });
  const a = await first.open();
  const b = await second.open();
  const results = await Promise.allSettled([
    first.commit(changed(a.payload, "first"), { expectedToken: a.token }),
    second.commit(changed(b.payload, "second"), { expectedToken: b.token }),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[1].reason.code, "TRAINING_LOCAL_CONFLICT");
  assert.equal(second.canWrite(), false);
  assert.deepEqual(
    first.inspect().payload.solves.map((item) => item.id),
    ["legacy", "first"],
  );
  assert.equal(second.inspect().ready, false);
  const latest = await second.open();
  await second.commit(changed(latest.payload, "second"), {
    expectedToken: latest.token,
  });
  assert.deepEqual(
    second.inspect().payload.solves.map((item) => item.id),
    ["legacy", "first", "second"],
  );
});

test("late changes to each legacy key block v2 writes and expose both immutable original and current copies", async () => {
  for (const key of LEGACY_TRAINING_KEYS) {
    const storage = memory(legacyEntries());
    const session = store(storage);
    const opened = await session.open();
    const saved = storage.getItem(TRAINING_V2_KEY);
    storage.setItem(key, "old tab changed this");
    assert.equal(session.canWrite(), false);
    assert.throws(() => session.assertWritable(), {
      code: "TRAINING_LEGACY_CONFLICT",
    });
    await assert.rejects(session.commit(changed(opened.payload)), {
      code: "TRAINING_LEGACY_CONFLICT",
    });
    const recovered = await store(storage).open();
    assert.equal(recovered.ready, false);
    assert.deepEqual(recovered.legacyChanges, [key]);
    assert.equal(recovered.legacyOriginals[key], opened.legacyOriginals[key]);
    assert.equal(recovered.legacyCurrent[key], "old tab changed this");
    assert.equal(storage.getItem(TRAINING_V2_KEY), saved);
  }
});

test("legacy edits during publication preserve the committed v2 copy but cannot report write readiness", async () => {
  const storage = memory(legacyEntries());
  const set = storage.setItem;
  storage.setItem = (key, value) => {
    set(key, value);
    if (key === TRAINING_V2_KEY)
      set(SOLVES_KEY, JSON.stringify([{ ...solve, id: "late-legacy" }]));
  };
  const session = store(storage);
  const migrated = await session.open();
  assert.equal(migrated.ready, false);
  assert.deepEqual(migrated.legacyChanges, [SOLVES_KEY]);
  assert.equal(migrated.payload.solves[0].id, "legacy");
  assert.equal(
    JSON.parse(migrated.legacyCurrent[SOLVES_KEY])[0].id,
    "late-legacy",
  );
  assert.equal(session.canWrite(), false);
});

test("malformed or future v2 envelopes never fall back to the otherwise valid v1 keys", async () => {
  for (const raw of [
    "{",
    '{"format":"last-layer-local-training","version":3}',
    "null",
  ]) {
    const storage = memory([...legacyEntries(), [TRAINING_V2_KEY, raw]]);
    const before = [...storage.values];
    await assert.rejects(store(storage).open(), { code: "INVALID_LOCAL_V2" });
    assert.deepEqual([...storage.values], before);
  }
  const storage = memory(legacyEntries());
  await store(storage).open();
  const value = JSON.parse(storage.getItem(TRAINING_V2_KEY));
  delete value.legacy[SYNC_KEY];
  storage.values.set(TRAINING_V2_KEY, JSON.stringify(value));
  await assert.rejects(store(storage).open(), { code: "INVALID_LOCAL_V2" });
});

test("missing cross-tab locks fail explicitly while read-only v2 export remains available", async () => {
  const storage = memory(legacyEntries());
  await assert.rejects(store(storage, { withLock: undefined }).open(), {
    code: "TRAINING_LOCK_UNAVAILABLE",
  });
  assert.equal(storage.getItem(TRAINING_V2_KEY), null);
  await store(storage).open();
  const readonly = store(storage, { withLock: undefined });
  assert.equal(readonly.inspect().payload.version, 2);
  assert.equal(readonly.inspect().ready, false);
  assert.equal(readonly.canWrite(), false);
  assert.throws(() => trainingWebLockRunner(undefined), {
    code: "TRAINING_LOCK_UNAVAILABLE",
  });
  const requests = [];
  const runner = trainingWebLockRunner({
    request(name, options, operation) {
      requests.push({ name, options });
      return operation();
    },
  });
  await store(memory(), { scope: "test-scope", withLock: runner }).open();
  assert.deepEqual(requests, [
    {
      name: "last-layer.training.v2:test-scope",
      options: { mode: "exclusive" },
    },
  ]);
});

test("guest/account/sandbox scopes migrate independently and never modify another source", async () => {
  const storage = memory(legacyEntries());
  const account = accountStorage(storage, "account-one");
  const other = accountStorage(storage, "account-two");
  for (const [key, raw] of legacyEntries()) account.setItem(key, raw);
  other.setItem(SOLVES_KEY, "unreadable other account");
  const sandbox = memory();
  const sessions = [
    store(storage),
    store(account, { scope: "account-one:false" }),
    store(sandbox, { scope: "guest:true" }),
  ];
  const results = await Promise.all(sessions.map((session) => session.open()));
  assert.equal(new Set(sessions.map((session) => session.lockName)).size, 3);
  assert.equal(results[0].payload.solves.length, 1);
  assert.equal(results[1].payload.solves.length, 1);
  assert.equal(results[2].payload.solves.length, 0);
  assert.equal(other.getItem(TRAINING_V2_KEY), null);
  assert.equal(other.getItem(SOLVES_KEY), "unreadable other account");
});

test("closing a scope while waiting for its lock cancels migration without touching storage", async () => {
  const storage = memory(legacyEntries());
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const session = store(storage, {
    withLock: async (_, operation) => {
      await wait;
      return operation();
    },
  });
  const opening = session.open();
  session.close();
  release();
  await assert.rejects(opening, { code: "TRAINING_SCOPE_CLOSED" });
  assert.equal(storage.getItem(TRAINING_V2_KEY), null);
  assert.equal(session.canWrite(), false);
});

test("queued commits capture detached candidates and reject invalid data before writing", async () => {
  const storage = memory(legacyEntries());
  const session = store(storage);
  const opened = await session.open();
  const before = storage.getItem(TRAINING_V2_KEY);
  await assert.rejects(session.commit({ ...opened.payload, version: 1 }));
  assert.equal(storage.getItem(TRAINING_V2_KEY), before);
  const candidate = changed(opened.payload);
  const committing = session.commit(candidate);
  candidate.solves[1].scrambleGrip.up = "red";
  candidate.solves[1].notes = "mutated while queued";
  const saved = await committing;
  assert.equal(saved.payload.solves[1].scrambleGrip.up, "white");
  assert.equal(saved.payload.solves[1].notes, solve.notes);
});

test("a removed development flag cannot reactivate legacy writes over adopted or malformed v2", () => {
  const storage = memory();
  assert.doesNotThrow(() => assertLegacyTrainingWritable(storage));
  for (const raw of ["{}", "broken", JSON.stringify({ version: 2 })]) {
    storage.values.set(TRAINING_V2_KEY, raw);
    assert.throws(() => assertLegacyTrainingWritable(storage), {
      code: "TRAINING_REQUIRES_V2",
    });
    assert.equal(storage.values.get(TRAINING_V2_KEY), raw);
  }
});

test("guest transfer refuses a pending legacy restore before reading partial training fields", () => {
  const storage = memory([
    ...legacyEntries(),
    [RESTORE_KEY, JSON.stringify([null, null, null])],
  ]);
  const reads = [];
  const source = {
    getItem(key) {
      reads.push(key);
      return storage.getItem(key);
    },
  };
  assert.throws(() => readLegacyTrainingV2(source, catalog), {
    code: "LEGACY_RESTORE_PENDING",
  });
  assert.deepEqual(reads, [RESTORE_KEY]);
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.getItem(TRAINING_V2_KEY), null);
});

test("guest transfer normalizes an unchanged legacy snapshot without writing or consuming its checkpoint", () => {
  const storage = memory(legacyEntries());
  const before = [...storage.values];
  const result = readLegacyTrainingV2(storage, catalog);
  assert.equal(result.version, 2);
  assert.equal(result.solves[0].eventId, "333");
  assert.equal(result.solves[0].scramble, solve.scramble);
  assert.deepEqual([...storage.values], before);
  assert.deepEqual(storage.writes, []);
});

test("guest transfer rejects legacy mutation or v2 adoption during its read", () => {
  for (const change of ["restore", "solve", "adoption"]) {
    const storage = memory(legacyEntries());
    let changed = false;
    const source = {
      getItem(key) {
        const raw = storage.getItem(key);
        if (key === SOLVES_KEY && !changed) {
          changed = true;
          if (change === "restore")
            storage.values.set(RESTORE_KEY, "[null,null,null]");
          if (change === "solve") storage.values.set(SOLVES_KEY, "[]");
          if (change === "adoption") storage.values.set(TRAINING_V2_KEY, "{}");
        }
        return raw;
      },
    };
    assert.throws(
      () => readLegacyTrainingV2(source, catalog),
      (error) =>
        [
          "LEGACY_RESTORE_PENDING",
          "TRAINING_LEGACY_CONFLICT",
          "TRAINING_REQUIRES_V2",
        ].includes(error.code),
    );
    assert.deepEqual(storage.writes, []);
  }
});
