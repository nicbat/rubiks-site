import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cube3x3x3 } from "cubing/puzzles";
import { generateSetup, rotateSetup, randomIndex } from "../src/practice.js";
import {
  applyAlg,
  solvedCube,
  caseCube,
  caseSignature,
  signature,
  f2lSolved,
  topOriented,
} from "../src/cube.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);

test("side remapping equals cube conjugation in independent cubing.js engine", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const c of catalog) {
    for (let side = 0; side < 4; side++) {
      const rotations = "y ".repeat(side);
      const undo = "y' ".repeat(side);
      assert.ok(
        puzzle
          .algToTransformation(rotateSetup(c.setups[0], side))
          .isIdentical(
            puzzle.algToTransformation(`${rotations}${c.setups[0]} ${undo}`),
          ),
        c.id,
      );
    }
  }
});

test("all four practice sides preserve each case, F2L, and PLL orientation", () => {
  for (const c of catalog) {
    const expected = caseSignature(caseCube(c.algorithms[0].moves), c.section);
    for (let side = 0; side < 4; side++) {
      const choices = [0, 0, side];
      const setup = generateSetup(c, { randomSide: true }, () =>
        choices.shift(),
      );
      const cube = applyAlg(solvedCube(), setup);
      assert.ok(f2lSolved(cube), c.id);
      if (c.section === "PLL") assert.ok(topOriented(cube), c.id);
      assert.equal(caseSignature(cube, c.section), expected, c.id);
    }
  }
});

test("random side changes PLL color assignment beyond an AUF", () => {
  const c = catalog.find((c) => c.id === "pll-T");
  const fixed = applyAlg(solvedCube(), c.setups[0]);
  const rotated = applyAlg(solvedCube(), rotateSetup(c.setups[0], 1));
  assert.ok(
    ["", "U", "U2", "U'"].every(
      (auf) =>
        signature(applyAlg(fixed, auf), "PLL") !== signature(rotated, "PLL"),
    ),
  );
});

test("fixed-side practice keeps random setup and AUF selection", () => {
  const c = catalog[0];
  const choices = [3, 2];
  assert.equal(
    generateSetup(c, {}, () => choices.shift()),
    `${c.setups[3]} U'`,
  );
  assert.deepEqual(choices, []);
});

test("invalid random bounds and unsupported setup notation fail explicitly", () => {
  for (const n of [0, -1, 1.5, Infinity])
    assert.throws(() => randomIndex(n), RangeError);
  assert.equal(randomIndex(1), 0);
  assert.throws(() => rotateSetup("M U M'", 1), /face turns/);
});
