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

test("every catalog setup, side, and AUF remains the intended hidden case", async () => {
  const { assertOracleFacelets } = await import("./helpers/cube-oracle.js");
  const puzzle = await cube3x3x3.kpuzzle();
  const aufs = ["", "U", "U'", "U2"];
  for (const c of catalog) {
    const expected = new Set();
    const reference = caseCube(c.algorithms[0].moves);
    for (let y = 0; y < 4; y++)
      for (const auf of aufs)
        expected.add(
          signature(applyAlg(reference, `${"y ".repeat(y)}${auf}`), c.section),
        );
    for (let index = 0; index < c.setups.length; index++)
      for (let side = 0; side < 4; side++) {
        const rotated = rotateSetup(c.setups[index], side);
        assertOracleFacelets(
          applyAlg(solvedCube(), rotated),
          puzzle.defaultPattern().applyAlg(rotated),
          `${c.id} setup ${index} side ${side}`,
        );
        for (let aufIndex = 0; aufIndex < 4; aufIndex++) {
          const choices = [index, aufIndex, side];
          const setup = generateSetup(c, { randomSide: true }, (bound) => {
            const choice = choices.shift();
            assert.ok(choice >= 0 && choice < bound);
            return choice;
          });
          assert.deepEqual(choices, []);
          const cube = applyAlg(solvedCube(), setup);
          const context = `${c.id} setup ${index} side ${side} AUF ${aufs[aufIndex]}`;
          assert.ok(f2lSolved(cube), context);
          if (c.section === "PLL") assert.ok(topOriented(cube), context);
          assert.ok(expected.has(signature(cube, c.section)), context);
        }
      }
  }
});

test("randomIndex retries rejected values to avoid modulo bias", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const values = [0xffffffff, 5];
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(array) {
        array[0] = values.shift();
        return array;
      },
    },
  });
  t.after(() => Object.defineProperty(globalThis, "crypto", original));
  assert.equal(randomIndex(3), 2);
  assert.deepEqual(values, [], "2^32 - 1 must be rejected for three options");
});
