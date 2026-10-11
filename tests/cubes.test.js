import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCubes } from "../src/cubes.js";
import { validateSolves } from "../src/solve-history.js";

test("cube collection validates default references and independent records", () => {
  const value = {
    cubes: [{ id: "a", name: "Main", description: "Fast" }],
    defaultId: "a",
  };
  assert.deepEqual(validateCubes(value), value);
  assert.notEqual(validateCubes(value).cubes[0], value.cubes[0]);
  for (const invalid of [
    null,
    {},
    { ...value, defaultId: "missing" },
    { ...value, cubes: [...value.cubes, ...value.cubes] },
    { cubes: [{ id: "a", name: " ", description: "" }], defaultId: "a" },
  ])
    assert.throws(() => validateCubes(invalid));
});
test("solve cube assignments round trip without requiring a current collection; legacy solves stay unassigned", () => {
  const solve = {
    id: "s",
    elapsed: 1000,
    date: "2026-10-10T12:00:00Z",
    scramble: Array(10).fill("R U").join(" "),
  };
  assert.equal(validateSolves([solve])[0].cubeId, undefined);
  for (const cubeId of [null, "cube-a"])
    assert.equal(validateSolves([{ ...solve, cubeId }])[0].cubeId, cubeId);
  for (const cubeId of [42, {}, ""])
    assert.throws(() => validateSolves([{ ...solve, cubeId }]));
});

test("deleting cubes preserves history references and replaces only a deleted default", async () => {
  const { deleteCube } = await import("../src/cubes.js");
  const collection = {
    cubes: [
      { id: "a", name: "Main", description: "" },
      { id: "b", name: "Travel", description: "" },
    ],
    defaultId: "a",
  };
  const removed = deleteCube(collection, "a");
  assert.equal(removed.defaultId, "b");
  assert.equal(removed.cubes[0].name, "Main");
  assert.equal(removed.cubes[0].deleted, true);
  assert.equal(collection.cubes[0].deleted, undefined);
  assert.deepEqual(validateCubes(removed), removed);
  assert.equal(deleteCube(collection, "b").defaultId, "a");
  assert.equal(deleteCube(removed, "b").defaultId, null);
  assert.throws(() => validateCubes({ ...removed, defaultId: "a" }));
});
