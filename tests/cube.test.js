import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  solvedCube,
  applyAlg,
  caseCube,
  inverse,
  isSolved,
  f2lSolved,
  topOriented,
  caseSignature,
} from "../src/cube.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
test("face, slice, wide and rotation moves have valid inverses", () => {
  for (const m of [
    "R",
    "L",
    "U",
    "D",
    "F",
    "B",
    "M",
    "E",
    "S",
    "x",
    "y",
    "z",
    "r",
    "l",
    "u",
    "d",
    "f",
    "b",
  ]) {
    assert.ok(isSolved(applyAlg(solvedCube(), `${m} ${m} ${m} ${m}`)), m);
    assert.ok(isSolved(applyAlg(solvedCube(), `${m} ${inverse(m)}`)), m);
  }
});
test("catalog covers every OLL and PLL case", () => {
  assert.equal(catalog.filter((c) => c.section === "OLL").length, 57);
  assert.equal(catalog.filter((c) => c.section === "PLL").length, 21);
  assert.equal(new Set(catalog.map((c) => c.id)).size, 78);
});
for (const c of catalog)
  test(`${c.name}: all variants and hidden setups match the case`, () => {
    const expected = caseSignature(caseCube(c.algorithms[0].moves), c.section);
    for (const { moves } of c.algorithms) {
      const cube = caseCube(moves);
      assert.ok(f2lSolved(cube), moves);
      assert.ok(isSolved(applyAlg(cube, moves)), moves);
      assert.equal(caseSignature(cube, c.section), expected, moves);
    }
    for (const setup of c.setups) {
      const cube = applyAlg(solvedCube(), setup);
      assert.ok(f2lSolved(cube), setup);
      if (c.section === "PLL") assert.ok(topOriented(cube), setup);
      assert.equal(caseSignature(cube, c.section), expected, setup);
    }
  });
