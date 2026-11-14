import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTraining } from "../src/training-merge.js";
import { validateTrainingBackupV2 } from "../src/training-v2.js";
import { emptyProgress } from "../src/progress.js";
import catalog from "../data/algorithms.json" with { type: "json" };

const cube = (id, puzzleId = "3x3") => ({
  id,
  puzzleId,
  name: id,
  description: "",
});
const solve = (id, eventId = "333", cubeId) => ({
  id,
  eventId,
  ...(cubeId ? { cubeId } : {}),
  elapsed: 12000,
  date: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
  scramble: "R U F2",
  scrambleGrip: { up: "white", front: "green" },
  scrambleProvenance: { id: "generator", version: "1", method: "random-state" },
});
const backup = () => ({
  format: "last-layer-training",
  version: 2,
  progress: emptyProgress(),
  solves: [],
  cubeCollection: {
    cubes: [cube("two", "2x2"), cube("three")],
    defaultsByEvent: {},
  },
});
const validate = (value) => validateTrainingBackupV2(value, catalog);

test("v2 merges independent event defaults and metadata without adding a v1 default", () => {
  const base = backup(),
    device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.defaultsByEvent["222"] = "two";
  cloud.cubeCollection.defaultsByEvent["333oh"] = "three";
  device.solves.push(solve("two-solve", "222", "two"));
  cloud.solves.push(solve("oh-solve", "333oh", "three"));
  const before = structuredClone([base, device, cloud]);
  const merged = mergeTraining(base, device, cloud);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.value.cubeCollection.defaultsByEvent, {
    222: "two",
    "333oh": "three",
  });
  assert.equal("defaultId" in merged.value.cubeCollection, false);
  assert.deepEqual(merged.value.solves, [cloud.solves[0], device.solves[0]]);
  validate(merged.value);
  assert.deepEqual([base, device, cloud], before);
  assert.deepEqual(mergeTraining(base, cloud, device).value, merged.value);
});

test("conflicting event defaults resolve independently while other event defaults survive", () => {
  const base = backup();
  base.cubeCollection.cubes.push(cube("other"));
  const device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.defaultsByEvent["333"] = "three";
  device.cubeCollection.defaultsByEvent["222"] = "two";
  cloud.cubeCollection.defaultsByEvent["333"] = "other";
  cloud.cubeCollection.defaultsByEvent["333oh"] = "other";
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, device, cloud, choice);
    assert.deepEqual(merged.conflicts, ["cubeCollection.defaultsByEvent.333"]);
    assert.equal(
      merged.value.cubeCollection.defaultsByEvent["333"],
      choice === "device" ? "three" : "other",
    );
    assert.equal(merged.value.cubeCollection.defaultsByEvent["222"], "two");
    assert.equal(merged.value.cubeCollection.defaultsByEvent["333oh"], "other");
    validate(merged.value);
  }
});

test("ordinary deletion removes defaults while independently added history retains typed tombstones", () => {
  const base = backup();
  base.cubeCollection.defaultsByEvent = {
    333: "three",
    "333oh": "three",
    222: "two",
  };
  const device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.cubes = [cube("two", "2x2")];
  device.cubeCollection.defaultsByEvent = { 222: "two" };
  cloud.solves.push(solve("historic", "333oh", "three"));
  const merged = mergeTraining(base, device, cloud);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.value.cubeCollection.defaultsByEvent, { 222: "two" });
  assert.deepEqual(
    merged.value.cubeCollection.cubes.find((item) => item.id === "three"),
    { ...cube("three"), deleted: true },
  );
  assert.equal(merged.value.solves[0].cubeId, "three");
  validate(merged.value);
});

test("reclassification versus an independently added solve needs a scoped conflict choice", () => {
  const base = backup(),
    device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.cubes.find((item) => item.id === "three").puzzleId =
    "2x2";
  device.solves.push(solve("device-unrelated", "222", "two"));
  cloud.solves.push(
    solve("cloud-linked", "333", "three"),
    solve("cloud-unrelated", "222", "two"),
  );
  const before = structuredClone([base, device, cloud]);
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, device, cloud, choice);
    assert.ok(merged.conflicts.includes("solves[cloud-linked].cubeId"));
    assert.ok(
      merged.conflicts.includes("cubeCollection.cubes[three].puzzleId"),
    );
    assert.equal(
      merged.value.solves.some((item) => item.id === "cloud-linked"),
      choice === "cloud",
    );
    assert.equal(
      merged.value.cubeCollection.cubes.find((item) => item.id === "three")
        .puzzleId,
      choice === "cloud" ? "3x3" : "2x2",
    );
    assert.ok(
      merged.value.solves.some((item) => item.id === "device-unrelated"),
    );
    assert.ok(
      merged.value.solves.some((item) => item.id === "cloud-unrelated"),
    );
    validate(merged.value);
  }
  assert.deepEqual([base, device, cloud], before);
});

test("reclassification against a new default reports a conflict instead of silently clearing it", () => {
  const base = backup(),
    device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.cubes.find((item) => item.id === "three").puzzleId =
    "2x2";
  cloud.cubeCollection.defaultsByEvent["333"] = "three";
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, device, cloud, choice);
    assert.ok(merged.conflicts.includes("cubeCollection.defaultsByEvent.333"));
    assert.equal(
      merged.value.cubeCollection.defaultsByEvent["333"],
      choice === "cloud" ? "three" : undefined,
    );
    validate(merged.value);
  }
});

test("alternate equipment references remain valid through linked conflict resolution", () => {
  const base = backup();
  base.cubeCollection.cubes.push(cube("other"));
  base.solves.push(solve("shared", "333", "three"));
  const device = structuredClone(base),
    cloud = structuredClone(base);
  // Device moves its old solve to another cube, freeing the first for reclassification.
  device.solves[0].cubeId = "other";
  device.cubeCollection.cubes.find((item) => item.id === "three").puzzleId =
    "2x2";
  cloud.solves.push(solve("cloud-new", "333", "three"));
  cloud.cubeCollection.defaultsByEvent["333"] = "three";
  for (const choice of ["device", "cloud"])
    validate(mergeTraining(base, device, cloud, choice).value);
});

test("provenance and grip conflicts do not fabricate a generator revision or orientation", () => {
  const base = backup();
  base.solves.push(solve("shared"));
  const device = structuredClone(base),
    cloud = structuredClone(base);
  device.solves[0].scrambleProvenance.id = "different-generator";
  cloud.solves[0].scrambleProvenance.version = "2";
  device.solves[0].scrambleGrip.up = "yellow";
  cloud.solves[0].scrambleGrip.front = "blue";
  device.solves[0].notes = "independent note";
  cloud.solves[0].penalty = "+2";
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, device, cloud, choice);
    const selected = choice === "device" ? device : cloud;
    assert.ok(merged.conflicts.includes("solves[shared].scrambleIdentity"));

    assert.deepEqual(
      merged.value.solves[0].scrambleProvenance,
      selected.solves[0].scrambleProvenance,
    );
    assert.deepEqual(
      merged.value.solves[0].scrambleGrip,
      selected.solves[0].scrambleGrip,
    );
    assert.equal(merged.value.solves[0].notes, "independent note");
    assert.equal(merged.value.solves[0].penalty, "+2");
    validate(merged.value);
  }
});

test("mixed or unsupported schema versions are rejected before merging", () => {
  const v2 = backup(),
    v1 = { ...backup(), version: 1 };
  for (const inputs of [
    [v1, v2, v2],
    [v2, v1, v2],
    [v2, v2, v1],
  ])
    assert.throws(
      () => mergeTraining(...inputs),
      /Normalize training versions/,
    );
  const unsupported = { ...backup(), version: 3 };
  assert.throws(
    () => mergeTraining(unsupported, unsupported, unsupported),
    /Normalize training versions/,
  );
});

test("event and scramble changes are one observation while notes and penalties merge", () => {
  const base = backup();
  base.solves.push(solve("shared"));
  const device = structuredClone(base),
    cloud = structuredClone(base);
  device.solves[0].eventId = "333oh";
  device.solves[0].notes = "phone note";
  cloud.solves[0].scramble = "F R2 U";
  cloud.solves[0].penalty = "+2";
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, device, cloud, choice);
    assert.deepEqual(merged.conflicts, ["solves[shared].scrambleIdentity"]);
    const selected = choice === "device" ? device : cloud;
    assert.equal(merged.value.solves[0].eventId, selected.solves[0].eventId);
    assert.equal(merged.value.solves[0].scramble, selected.solves[0].scramble);
    assert.equal(merged.value.solves[0].notes, "phone note");
    assert.equal(merged.value.solves[0].penalty, "+2");
    validate(merged.value);
  }
});

test("reclassification resolution keeps compatible independent solves on alternate default equipment", () => {
  const base = backup();
  base.cubeCollection.cubes.push(cube("other"));
  base.cubeCollection.defaultsByEvent["333"] = "three";
  const device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.cubes.find((item) => item.id === "three").puzzleId =
    "2x2";
  device.cubeCollection.defaultsByEvent["333"] = "other";
  cloud.solves.push(
    solve("needs-choice", "333", "three"),
    solve("independent-other", "333", "other"),
  );
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, device, cloud, choice);
    assert.ok(
      merged.value.solves.some((item) => item.id === "independent-other"),
    );
    validate(merged.value);
  }
});

test("resolving one equipment conflict preserves separately added compatible equipment and history", () => {
  const base = backup();
  base.cubeCollection.defaultsByEvent["333"] = "three";
  const device = structuredClone(base),
    cloud = structuredClone(base);
  device.cubeCollection.cubes.find((item) => item.id === "three").puzzleId =
    "2x2";
  device.cubeCollection.defaultsByEvent = {};
  cloud.cubeCollection.cubes.push(cube("new-other"));
  cloud.cubeCollection.defaultsByEvent["333"] = "new-other";
  cloud.solves.push(
    solve("needs-choice", "333", "three"),
    solve("new-independent", "333", "new-other"),
  );
  const merged = mergeTraining(base, device, cloud, "device");
  assert.ok(merged.value.solves.some((item) => item.id === "new-independent"));
  // The direct default conflict follows the requested device choice, but the
  // independently introduced equipment and solve must survive it.
  assert.ok(
    merged.value.cubeCollection.cubes.some((item) => item.id === "new-other"),
  );
  validate(merged.value);
});
