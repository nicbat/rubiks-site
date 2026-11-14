import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { solvedCube, applyAlg } from "@last-layer/cube-engine/core";
import { createCubePlayback } from "@last-layer/cube-engine/playback";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";

test("standalone core accepts frozen inputs and returns detached sticker state", async () => {
  const initial = solvedCube();
  const original = structuredClone(initial);
  for (const sticker of initial) {
    Object.freeze(sticker.p);
    Object.freeze(sticker.n);
    Object.freeze(sticker);
  }
  Object.freeze(initial);
  const algorithm = "Rw U2 M' x F S2 y'";
  const result = applyAlg(initial, algorithm);
  const puzzle = await cube3x3x3.kpuzzle();
  assertOracleFacelets(
    result,
    puzzle.defaultPattern().applyAlg(algorithm),
    "package core",
  );
  assert.deepEqual(initial, original);
  for (const [index, sticker] of result.entries()) {
    assert.notEqual(sticker, initial[index]);
    assert.notEqual(sticker.p, initial[index].p);
    assert.notEqual(sticker.n, initial[index].n);
  }
  result[0].p[0] = 99;
  assert.deepEqual(solvedCube(), original);
  assert.deepEqual(applyAlg(initial, ""), original);
});

test("standalone playback isolates its input, snapshots and simultaneous instances", async () => {
  const initial = solvedCube();
  const first = createCubePlayback(initial, "R U F2");
  const second = createCubePlayback(initial, "L D");
  initial[0].color = "B";
  initial[0].p[0] = 99;
  first.seek(2);
  const exposed = first.snapshot();
  exposed.cube[0].color = "D";
  exposed.cube[0].n[0] = 99;
  const puzzle = await cube3x3x3.kpuzzle();
  assertOracleFacelets(
    first.snapshot().cube,
    puzzle.defaultPattern().applyAlg("R U"),
    "first player",
  );
  assertOracleFacelets(
    second.snapshot().cube,
    puzzle.defaultPattern(),
    "second player",
  );
  second.seek(1);
  first.reset();
  assertOracleFacelets(
    first.snapshot().cube,
    puzzle.defaultPattern(),
    "reset player",
  );
  assertOracleFacelets(
    second.snapshot().cube,
    puzzle.defaultPattern().applyAlg("L"),
    "independent player",
  );
});
