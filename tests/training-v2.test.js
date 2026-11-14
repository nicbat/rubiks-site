import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";
import { validateBackup, trainingBackup } from "../src/training-backup.js";
import {
  migrateTrainingBackupV1,
  validateTrainingBackupV2,
  validateSolvesV2,
  validateCubeCollectionV2,
} from "../src/training-v2.js";

const oldScramble = "R U R U R U R U R U R U R U R U R U R U";
const oldSolve = {
  id: "old-solve",
  cubeId: "deleted-cube",
  elapsed: 14723,
  penalty: "+2",
  date: "2026-10-17T01:00:00Z",
  day: "2026-10-16",
  scramble: oldScramble,
  notes: "Keep my notes exactly.\nEven the newline.",
};
function legacy() {
  return trainingBackup(emptyProgress(), [oldSolve], {
    cubes: [
      {
        id: "deleted-cube",
        name: "Former cube",
        description: "historical",
        deleted: true,
      },
      {
        id: "current-cube",
        name: "Current cube",
        description: "",
        deleted: false,
      },
    ],
    defaultId: "current-cube",
  });
}
function solve(eventId = "333", scramble = "R U2 F'") {
  return {
    id: eventId,
    elapsed: 12345,
    date: "2026-10-17T01:00:00Z",
    eventId,
    scramble,
    scrambleGrip: { up: "white", front: "green" },
  };
}
function backup(solves, cubeCollection = { cubes: [], defaultsByEvent: {} }) {
  return {
    format: "last-layer-training",
    version: 2,
    progress: emptyProgress(),
    solves,
    cubeCollection,
  };
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("v1 migration preserves historical solve bytes and local day with explicit legacy orientation", () => {
  const original = freeze(legacy());
  const bytes = JSON.stringify(original);
  const migrated = migrateTrainingBackupV1(original, catalog);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.solves, [
    {
      ...oldSolve,
      eventId: "333",
      scrambleGrip: { up: "yellow", front: "green" },
    },
  ]);
  assert.equal(Object.hasOwn(migrated.solves[0], "scrambleProvenance"), false);
  assert.deepEqual(migrated.cubeCollection.defaultsByEvent, {
    333: "current-cube",
  });
  assert.equal(migrated.cubeCollection.cubes[0].deleted, true);
  assert.equal(migrated.cubeCollection.cubes[0].puzzleId, "3x3");
  assert.deepEqual(
    migrated.progress,
    validateBackup(original, catalog).progress,
  );
  migrated.solves[0].scrambleGrip.up = "red";
  assert.equal(JSON.stringify(original), bytes);
  assert.deepEqual(
    migrateTrainingBackupV1(original, catalog).solves[0].scrambleGrip,
    { up: "yellow", front: "green" },
  );
});

test("migration retains missing local dates and no-equipment defaults without inventing data", () => {
  const original = legacy();
  original.solves = [{ ...oldSolve, cubeId: null }];
  delete original.solves[0].day;
  original.cubeCollection.defaultId = null;
  const result = migrateTrainingBackupV1(original, catalog);
  assert.equal(Object.hasOwn(result.solves[0], "day"), false);
  assert.equal(result.solves[0].cubeId, null);
  assert.deepEqual(result.cubeCollection.defaultsByEvent, {});
});

test("native v2 accepts all ten events without manufacturing generator provenance", () => {
  const eventMoves = [
    ["222", "R U2 F'"],
    ["333", "L2 D B'"],
    ["444", "Rw U Fw2"],
    ["555", "Rw U Fw2"],
    ["666", "3Rw U 3Fw2"],
    ["777", "3Rw U 3Fw2"],
    ["333oh", "R U2 F'"],
    ["333bf", "R U2 F' x y2"],
    ["444bf", "Rw U Fw2 x'"],
    ["555bf", "Rw U Fw2 z"],
  ];
  const input = freeze(
    backup(eventMoves.map(([event, alg]) => solve(event, alg))),
  );
  const result = validateTrainingBackupV2(input, catalog);
  assert.deepEqual(result.solves, input.solves);
  assert.notEqual(result.solves[0].scrambleGrip, input.solves[0].scrambleGrip);
  assert.equal(
    result.solves.some((s) => Object.hasOwn(s, "scrambleProvenance")),
    false,
  );
});

test("native v2 preserves provenance and a non-default grip with detached nested values", () => {
  const input = freeze([
    {
      ...solve(),
      penalty: "dnf",
      scrambleGrip: { up: "red", front: "white" },
      scrambleProvenance: {
        id: "local-engine",
        version: "policy-2.tables-4",
        method: "random-state",
      },
    },
  ]);
  const result = validateSolvesV2(input);
  assert.deepEqual(result, input);
  assert.notEqual(result[0].scrambleProvenance, input[0].scrambleProvenance);
  assert.notEqual(result[0].scrambleGrip, input[0].scrambleGrip);
});

test("native v2 rejects missing or unsupported event/grip metadata instead of defaulting to 333", () => {
  for (const patch of [
    { eventId: undefined },
    { eventId: "333mbf" },
    { eventId: "pyram" },
    { eventId: "toString" },
    { eventId: "__proto__" },
    { scrambleGrip: undefined },
    { scrambleGrip: { up: "white", front: "yellow" } },
    { scrambleGrip: { up: "white", front: "white" } },
    { scrambleGrip: { up: "unknown", front: "green" } },
    { scrambleGrip: { up: "white", front: "green", future: true } },
    {
      scrambleProvenance: {
        id: "x",
        version: "v1",
        method: "random-state",
        future: true,
      },
    },
    { scrambleProvenance: null },
    { scrambleProvenance: { id: "x", version: "v1", method: "official" } },
    { puzzleId: "3x3" },
  ])
    assert.throws(() => validateSolvesV2([{ ...solve(), ...patch }]));
});

test("event notation rejects incompatible layers, rotations and rich syntax without rewriting bytes", () => {
  for (const [eventId, scramble] of [
    ["222", "Rw"],
    ["333", "Rw"],
    ["333oh", "x"],
    ["444", "3Rw"],
    ["555", "3Rw"],
    ["666", "4Rw"],
    ["777", "7Rw"],
    ["444bf", "02Rw"],
    ["333bf", "M"],
    ["333", "[R,U]"],
    ["333", "R  U"],
    ["333", " R"],
    ["333", "R\nU"],
    ["333", "R3"],
    ["333", "r"],
    ["333", ""],
    ["333", Array(513).fill("R").join(" ")],
    ["777", "R".repeat(4097)],
  ])
    assert.throws(
      () => validateSolvesV2([solve(eventId, scramble)]),
      `${eventId}: ${scramble.slice(0, 30)}`,
    );
});

test("v2 keeps chronological penalty semantics and validates legacy scalar fields", () => {
  const later = {
    ...solve(),
    id: "later",
    date: "2026-10-18T01:00:00Z",
    penalty: "+2",
  };
  const earlier = { ...solve(), id: "earlier", penalty: "dnf" };
  assert.deepEqual(validateSolvesV2([later, earlier]), [earlier, later]);
  assert.throws(() => validateSolvesV2([solve(), solve()]));
  assert.throws(() => validateSolvesV2([Object.create(solve())]));
  for (const patch of [
    { elapsed: -1 },
    { elapsed: Infinity },
    { day: "2026-02-30" },
    { date: "yesterday" },
    { penalty: "none" },
    { cubeId: "" },
    { notes: "x".repeat(5001) },
  ])
    assert.throws(() => validateSolvesV2([{ ...solve(), ...patch }]));
});

test("equipment defaults are event-specific, live and puzzle-compatible while history can use deleted equipment", () => {
  const collection = {
    cubes: [
      { id: "small", name: "2 cube", description: "", puzzleId: "2x2" },
      { id: "regular", name: "3 cube", description: "", puzzleId: "3x3" },
      {
        id: "old",
        name: "Old",
        description: "",
        puzzleId: "3x3",
        deleted: true,
      },
    ],
    defaultsByEvent: { 222: "small", 333: "regular", "333oh": "regular" },
  };
  assert.deepEqual(validateCubeCollectionV2(freeze(collection)), collection);
  const result = validateTrainingBackupV2(
    backup([{ ...solve(), cubeId: "old" }], collection),
    catalog,
  );
  assert.equal(result.solves[0].cubeId, "old");
  for (const defaultsByEvent of [
    { 333: "small" },
    { 333: "old" },
    { 333: "missing" },
    { 333: null },
    { pyram: "regular" },
  ])
    assert.throws(() =>
      validateCubeCollectionV2({ ...collection, defaultsByEvent }),
    );
  assert.throws(() =>
    validateCubeCollectionV2({ ...collection, defaultId: "regular" }),
  );
  assert.throws(() =>
    validateCubeCollectionV2({
      ...collection,
      cubes: [collection.cubes[0], collection.cubes[0]],
    }),
  );
  for (const cubeId of ["small", "missing"])
    assert.throws(() =>
      validateTrainingBackupV2(
        backup([{ ...solve(), cubeId }], collection),
        catalog,
      ),
    );
});

test("schema boundaries reject mislabeled, future and unknown data instead of stripping fields", () => {
  const input = legacy();
  assert.throws(() => validateTrainingBackupV2(input, catalog));
  assert.throws(() => migrateTrainingBackupV1(backup([]), catalog));
  assert.throws(() =>
    migrateTrainingBackupV1({ ...input, version: 3 }, catalog),
  );
  assert.throws(() =>
    migrateTrainingBackupV1({ ...input, futureData: true }, catalog),
  );
  assert.throws(() =>
    migrateTrainingBackupV1(
      { ...input, solves: [{ ...oldSolve, eventId: "222" }] },
      catalog,
    ),
  );
  assert.throws(() =>
    validateTrainingBackupV2({ ...backup([]), futureData: true }, catalog),
  );
  assert.throws(() =>
    validateTrainingBackupV2({ ...backup([]), version: 3 }, catalog),
  );
  assert.throws(() =>
    validateCubeCollectionV2({ cubes: [], defaultsByEvent: [] }),
  );
  assert.throws(() =>
    validateCubeCollectionV2({
      cubes: [],
      defaultsByEvent: JSON.parse('{"__proto__":"x"}'),
    }),
  );
});

test("additive v2 foundation leaves current production export and import at v1", () => {
  const input = legacy();
  assert.equal(input.version, 1);
  assert.deepEqual(validateBackup(input, catalog).solves, [oldSolve]);
  assert.throws(
    () => validateBackup(migrateTrainingBackupV1(input, catalog), catalog),
    /Unsupported/,
  );
});
