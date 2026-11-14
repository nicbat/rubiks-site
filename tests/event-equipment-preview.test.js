import test from "node:test";
import assert from "node:assert/strict";
import {
  cubesForEvent,
  setEventDefault,
  deleteEventCube,
  saveEventCube,
  withEventSolveEquipment,
} from "../src/event-equipment.js";
import { scramblePalette } from "../src/scramble-preview.js";
import { palette } from "../src/diagram.js";
import { createPlayerPlayback } from "../src/cube-player.js";
import { solvedCube, applyAlg } from "../src/cube.js";
const equipment = () => ({
  cubes: [
    { id: "small", puzzleId: "2x2", name: "Small", description: "" },
    { id: "regular", puzzleId: "3x3", name: "Regular", description: "" },
  ],
  defaultsByEvent: { 222: "small", 333: "regular", "333oh": "regular" },
});
test("defaults are event-specific and deleted equipment never silently selects a replacement", () => {
  const original = equipment();
  assert.deepEqual(
    cubesForEvent(original.cubes, "222").map((cube) => cube.id),
    ["small"],
  );
  assert.throws(() => setEventDefault(original, "333", "small"));
  const changed = setEventDefault(original, "333oh", null);
  assert.equal(changed.defaultsByEvent["333"], "regular");
  assert.equal(changed.defaultsByEvent["333oh"], undefined);
  const removed = deleteEventCube(original, "regular");
  assert.deepEqual(removed.defaultsByEvent, { 222: "small" });
  assert.equal(
    removed.cubes.find((cube) => cube.id === "regular").deleted,
    true,
  );
  assert.equal(original.cubes[1].deleted, undefined);
});
test("equipment changes cannot reclassify referenced solves or cross event puzzle boundaries", () => {
  const collection = equipment();
  const solves = [
    { id: "a", eventId: "222", cubeId: "small" },
    { id: "b", eventId: "333", cubeId: "regular" },
  ];
  assert.throws(() =>
    saveEventCube(
      collection,
      { ...collection.cubes[0], puzzleId: "3x3" },
      solves,
    ),
  );
  assert.throws(() =>
    withEventSolveEquipment(solves, ["a", "b"], "small", collection),
  );
  assert.deepEqual(withEventSolveEquipment(solves, ["a"], null, collection), [
    { ...solves[0], cubeId: null },
    solves[1],
  ]);
  assert.equal(solves[0].cubeId, "small");
  const changed = saveEventCube(
    collection,
    { ...collection.cubes[0], puzzleId: "4x4" },
    [],
  );
  assert.equal(changed.defaultsByEvent["222"], undefined);
});
test("scramble previews retain legacy colors and use proper rotations for recorded grips", () => {
  assert.deepEqual(scramblePalette({ up: "yellow", front: "green" }), palette);
  assert.deepEqual(scramblePalette({ up: "white", front: "green" }), {
    U: palette.D,
    D: palette.U,
    F: palette.F,
    B: palette.B,
    R: palette.L,
    L: palette.R,
  });
  const colors = ["white", "yellow", "green", "blue", "red", "orange"];
  const orientations = new Set();
  for (const up of colors)
    for (const front of colors) {
      let result;
      try {
        result = scramblePalette({ up, front });
      } catch {
        continue;
      }
      assert.equal(new Set(Object.values(result)).size, 6);
      orientations.add(JSON.stringify(result));
    }
  assert.equal(orientations.size, 24);
  assert.throws(() => scramblePalette({ up: "white", front: "yellow" }));
  for (const size of [2, 4, 7]) {
    const player = createPlayerPlayback({
      mode: "scramble",
      size,
      algorithm: "R U F2",
    });
    assert.deepEqual(
      player.snapshot().cube,
      applyAlg(solvedCube(size), "R U F2"),
    );
    assert.equal(player.snapshot().cube.length, 6 * size * size);
  }
});
