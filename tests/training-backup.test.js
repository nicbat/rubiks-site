import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import {
  emptyProgress,
  identifyAttempts,
  STORAGE_KEY,
  validateProgress,
} from "../src/progress.js";
import { validateSolves, SOLVES_KEY } from "../src/solve-history.js";
import { CUBES_KEY } from "../src/cubes.js";
import {
  trainingBackup,
  validateBackup,
  restoreBackup,
  recoverRestore,
  RESTORE_KEY,
} from "../src/training-backup.js";
const attempt = {
  caseId: "pll-T",
  variant: 0,
  mode: "recognition",
  result: "help",
  day: "2026-10-16",
  at: "2026-10-17T01:00:00Z",
};
const progress = () => ({ ...emptyProgress(), attempts: [{ ...attempt }] });
const cubes = {
  cubes: [{ id: "a", name: "Old cube", description: "", deleted: true }],
  defaultId: null,
};
const solves = [
  {
    id: "s",
    cubeId: "a",
    date: "2026-10-17T01:00:00Z",
    day: "2026-10-16",
    elapsed: 12345,
    penalty: "+2",
    scramble: Array(10).fill("R U").join(" "),
  },
];
function storage() {
  const data = new Map([
    [STORAGE_KEY, "original progress"],
    [SOLVES_KEY, "original solves"],
    [CUBES_KEY, "original cubes"],
  ]);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
test("version-1 exports migrate on import without changing dates, variants or the source", () => {
  const legacy = {
    version: 1,
    selected: ["oll-1", "pll-T"],
    variants: { "pll-Rb": 2 },
    known: { "pll-T": [0] },
    attempts: [
      { ...attempt, result: "confident" },
      { ...attempt, mode: "rehearsal", at: "2026-10-16T20:00:00Z" },
    ],
  };
  const original = structuredClone(legacy);
  const migrated = validateBackup(legacy, catalog);
  assert.equal(migrated.legacyVersion, 1);
  assert.deepEqual(migrated.progress, {
    ...legacy,
    version: 2,
    attempts: [legacy.attempts[1], legacy.attempts[0]],
  });
  assert.deepEqual(legacy, original);
  assert.equal(migrated.solves, undefined);
  const s = storage();
  restoreBackup(s, migrated);
  assert.equal(s.getItem(SOLVES_KEY), "original solves");
  assert.equal(s.getItem(CUBES_KEY), "original cubes");
  assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).version, 2);
  for (const changes of [
    { attempts: [{ ...attempt, day: "2026-02-30" }] },
    { attempts: [{ ...attempt, at: "2026-10-16T12:00:00" }] },
    { variants: { "pll-T": 999 } },
    { selected: ["unknown"] },
    { attempts: null },
    { version: 3 },
  ])
    assert.throws(() => validateBackup({ ...legacy, ...changes }, catalog));
});
test("legacy attempts receive IDs once; validated IDs survive backups and reject duplicates", () => {
  const p = progress();
  assert.equal(
    identifyAttempts(p, () => "stable-id"),
    true,
  );
  assert.equal(
    identifyAttempts(p, () => {
      throw Error("must not regenerate");
    }),
    false,
  );
  assert.equal(validateProgress(p, catalog).attempts[0].id, "stable-id");
  assert.throws(() =>
    validateProgress(
      { ...p, attempts: [p.attempts[0], p.attempts[0]] },
      catalog,
    ),
  );
  for (const id of ["", 1, null, {}])
    assert.throws(() =>
      validateProgress({ ...p, attempts: [{ ...attempt, id }] }, catalog),
    );
});
test("training backups retain deleted cube names, raw times, penalties, local dates and immutable inputs", () => {
  const backup = trainingBackup(progress(), solves, cubes);
  const restored = validateBackup(JSON.parse(JSON.stringify(backup)), catalog);
  assert.deepEqual(restored, {
    progress: progress(),
    solves,
    cubeCollection: cubes,
  });
  restored.cubeCollection.cubes[0].name = "Changed";
  assert.equal(cubes.cubes[0].name, "Old cube");
  assert.deepEqual(validateBackup(progress(), catalog), {
    progress: progress(),
  });
  assert.throws(() => validateBackup({ ...backup, version: 2 }, catalog));
  assert.throws(() =>
    validateBackup(
      { ...backup, cubeCollection: { cubes: [], defaultId: null } },
      catalog,
    ),
  );
  assert.throws(() =>
    validateBackup(
      { ...backup, solves: [{ ...solves[0], penalty: "bad" }] },
      catalog,
    ),
  );
  for (const date of [
    "2026-02-30T00:00:00Z",
    "2026-10-17",
    "2026-10-17T01:00:00",
  ])
    assert.throws(() => validateSolves([{ ...solves[0], date }]));
  assert.throws(() => validateSolves([{ ...solves[0], day: "2026-02-30" }]));
});
test("complete restore commits together; learning-only restore preserves solves and cubes", () => {
  const s = storage();
  restoreBackup(
    s,
    validateBackup(trainingBackup(progress(), solves, cubes), catalog),
  );
  assert.deepEqual(JSON.parse(s.getItem(SOLVES_KEY)), solves);
  assert.equal(s.getItem(RESTORE_KEY), null);
  restoreBackup(s, { progress: emptyProgress() });
  assert.deepEqual(JSON.parse(s.getItem(SOLVES_KEY)), solves);
  assert.deepEqual(JSON.parse(s.getItem(CUBES_KEY)), cubes);
});
test("each failed restore write rolls back original bytes, including commit failure", () => {
  for (let failure = 1; failure <= 5; failure++) {
    const s = storage(),
      original = new Map(s.data);
    let operations = 0;
    for (const method of ["setItem", "removeItem"]) {
      const real = s[method];
      s[method] = (...args) => {
        if (++operations === failure) throw Error("storage full");
        return real(...args);
      };
    }
    assert.throws(() =>
      restoreBackup(s, {
        progress: emptyProgress(),
        solves,
        cubeCollection: cubes,
      }),
    );
    assert.deepEqual(s.data, original);
  }
});
test("interrupted rollback retains a journal and recovery restores missing keys too", () => {
  const s = storage();
  s.data.delete(CUBES_KEY);
  const original = new Map(s.data),
    write = s.setItem;
  let calls = 0;
  s.setItem = (...args) => {
    if (++calls >= 3) throw Error("unavailable");
    return write(...args);
  };
  assert.throws(() =>
    restoreBackup(s, {
      progress: emptyProgress(),
      solves,
      cubeCollection: cubes,
    }),
  );
  assert.ok(s.getItem(RESTORE_KEY));
  s.setItem = write;
  recoverRestore(s);
  assert.deepEqual(s.data, original);
});

test("imported solves are chronological so timer and dashboard share the same windows; ties keep recorded order", () => {
  const first = { ...solves[0], id: "z", date: "2026-10-15T12:00:00Z" };
  const tied = { ...first, id: "a" };
  const latest = { ...solves[0], id: "latest", date: "2026-10-17T12:00:00Z" };
  const input = [latest, first, tied];
  assert.deepEqual(
    validateSolves(input).map((s) => s.id),
    ["z", "a", "latest"],
  );
  assert.deepEqual(
    input.map((s) => s.id),
    ["latest", "z", "a"],
  );
});

test("training backup notes round-trip through restore and malformed notes preserve stored data", () => {
  const annotated = [
    { ...solves[0], notes: "Cross pause\nTry slower inspection 🧊" },
  ];
  const backup = JSON.parse(
    JSON.stringify(trainingBackup(progress(), annotated, cubes)),
  );
  const validated = validateBackup(backup, catalog);
  assert.deepEqual(validated.solves, annotated);
  const s = storage();
  restoreBackup(s, validated);
  assert.deepEqual(
    validateSolves(JSON.parse(s.getItem(SOLVES_KEY))),
    annotated,
  );
  const before = new Map(s.data);
  for (const notes of [null, 1, "x".repeat(5001)]) {
    assert.throws(() =>
      validateBackup(
        { ...backup, solves: [{ ...annotated[0], notes }] },
        catalog,
      ),
    );
    assert.deepEqual(s.data, before);
  }
});
