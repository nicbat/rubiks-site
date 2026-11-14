import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";
import { trainingBackup } from "../src/training-backup.js";
import { normalizeTrainingSnapshot } from "../src/training-schema.js";
import {
  prepareBackupImport,
  mergeBackup,
  guestTransferPreview,
} from "../src/backup-import.js";

const legacy = () =>
  trainingBackup(emptyProgress(), [], { cubes: [], defaultId: null });
const empty = () => normalizeTrainingSnapshot(legacy(), catalog);
const solve = (id, eventId = "222", cubeId) => ({
  id,
  eventId,
  ...(cubeId ? { cubeId } : {}),
  elapsed: 8000,
  date: "2026-10-20T12:00:00Z",
  scramble: "R U F2",
  scrambleGrip: { up: "white", front: "green" },
  scrambleProvenance: { id: "generator", version: "1", method: "random-state" },
});
const options = { version: 2 };

test("v2 account exports restore training without copying account metadata into storage", async () => {
  const payload = empty();
  payload.solves.push(solve("account-two"));
  const exported = {
    ...payload,
    account: {
      username: "learner",
      email: "learner@example.test",
      is_public: false,
    },
  };
  const original = structuredClone(exported);
  const prepared = await prepareBackupImport(exported, catalog, options);
  const merged = mergeBackup(empty(), prepared, catalog, options);
  assert.deepEqual(merged.backup, payload);
  assert.equal(Object.hasOwn(prepared, "account"), false);
  assert.deepEqual(exported, original);
  assert.throws(() => normalizeTrainingSnapshot(exported, catalog));
  await assert.rejects(
    prepareBackupImport({ ...exported, unexpected: true }, catalog, options),
  );
  for (const account of [null, [], "profile"])
    await assert.rejects(
      prepareBackupImport({ ...payload, account }, catalog, options),
      /account backup metadata/,
    );
});

test("v2 import is explicit, pure, and retains event metadata through preparation and merging", async () => {
  const incoming = empty();
  incoming.solves.push(solve("two"), solve("oh", "333oh"));
  const original = structuredClone(incoming);
  await assert.rejects(prepareBackupImport(incoming, catalog), /Unsupported/);
  const prepared = await prepareBackupImport(incoming, catalog, options);
  assert.equal(prepared.version, 2);
  const merged = mergeBackup(empty(), prepared, catalog, options);
  assert.equal(merged.backup.version, 2);
  assert.deepEqual(merged.backup.solves, incoming.solves);
  assert.equal(merged.summary.added.solves, 2);
  assert.equal("defaultId" in merged.backup.cubeCollection, false);
  assert.deepEqual(incoming, original);
});

test("legacy full imports migrate exactly once and preserve unknown generator provenance", async () => {
  const incoming = legacy();
  incoming.solves.push({
    id: "legacy",
    elapsed: 12000,
    date: "2026-10-20T12:00:00Z",
    scramble: Array(10).fill("R U").join(" "),
  });
  const prepared = await prepareBackupImport(incoming, catalog, options);
  const once = mergeBackup(empty(), prepared, catalog, options);
  const twice = mergeBackup(once.backup, prepared, catalog, options);
  assert.equal(twice.backup.solves.length, 1);
  assert.equal(twice.summary.added.solves, 0);
  assert.equal(twice.backup.solves[0].eventId, "333");
  assert.deepEqual(twice.backup.solves[0].scrambleGrip, {
    up: "yellow",
    front: "green",
  });
  assert.equal("scrambleProvenance" in twice.backup.solves[0], false);
  assert.equal(twice.backup.solves[0].scramble, incoming.solves[0].scramble);
});

test("learning-only v2-mode imports do not supply replacement timer data", async () => {
  const current = empty(),
    progress = emptyProgress();
  current.solves.push(solve("kept"));
  progress.selected = ["pll-T"];
  const prepared = await prepareBackupImport(progress, catalog, options);
  const merged = mergeBackup(current, prepared, catalog, options);
  assert.deepEqual(merged.backup.progress.selected, ["pll-T"]);
  assert.equal(merged.backup.solves, undefined);
  assert.equal(merged.summary.added.solves, 0);
  assert.equal(current.solves.length, 1);
});

test("current records/defaults win additive imports and conflicting equipment cannot relabel a solve", () => {
  const current = empty(),
    incoming = empty();
  current.cubeCollection = {
    cubes: [{ id: "same", name: "3x3", description: "", puzzleId: "3x3" }],
    defaultsByEvent: { 333: "same" },
  };
  incoming.cubeCollection = {
    cubes: [{ id: "same", name: "2x2", description: "", puzzleId: "2x2" }],
    defaultsByEvent: { 222: "same" },
  };
  incoming.solves.push(solve("two", "222", "same"));
  const before = structuredClone([current, incoming]);
  assert.throws(
    () => mergeBackup(current, incoming, catalog, options),
    /incompatible equipment/,
  );
  assert.deepEqual([current, incoming], before);
  incoming.cubeCollection = structuredClone(current.cubeCollection);
  incoming.solves = [solve("oh", "333oh", "same")];
  const merged = mergeBackup(current, incoming, catalog, options);
  assert.deepEqual(
    merged.backup.cubeCollection.defaultsByEvent,
    current.cubeCollection.defaultsByEvent,
  );
});

test("v2 guest transfer detects new event solves and remains idempotent", () => {
  const guest = empty();
  guest.solves.push(solve("guest"));
  const first = guestTransferPreview(empty(), guest, catalog, options);
  assert.equal(first.hasChanges, true);
  assert.equal(first.summary.added.solves, 1);
  assert.equal(
    guestTransferPreview(first.backup, guest, catalog, options).hasChanges,
    false,
  );
});
