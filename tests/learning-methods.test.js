import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cube3x3x3 } from "cubing/puzzles";
import {
  methodGroups,
  learningMethods,
  recommendedVariant,
} from "../src/learning-methods.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const auf = ["", "U", "U2", "U'"];
const topOriented = (pattern) =>
  ["CORNERS", "EDGES"].every((orbit) =>
    pattern.patternData[orbit].orientation.slice(0, 4).every((o) => o === 0),
  );
const crossOriented = (pattern) =>
  pattern.patternData.EDGES.orientation.slice(0, 4).every((o) => o === 0);
const cornersPlaced = (pattern) =>
  pattern.patternData.CORNERS.pieces.every((p, i) => p === i);
const solved = (pattern) =>
  ["CORNERS", "EDGES"].every((orbit) =>
    pattern.patternData[orbit].pieces.every((p, i) => p === i),
  ) && topOriented(pattern);
function assertF2L(pattern, context) {
  for (const orbit of ["CORNERS", "EDGES"])
    for (let i = 4; i < pattern.patternData[orbit].pieces.length; i++) {
      assert.equal(pattern.patternData[orbit].pieces[i], i, context);
      assert.equal(pattern.patternData[orbit].orientation[i], 0, context);
    }
}
function normalizeSideColors(pattern) {
  for (const rotation of ["", "y", "y2", "y'"]) {
    const candidate = pattern.applyAlg(rotation);
    if (candidate.patternData.CENTERS.pieces.every((p, i) => p === i))
      return candidate;
  }
  assert.fail("A two-look algorithm must leave yellow on top");
}
// Search only the legal recognition adjustments and selected curriculum. This
// checks arbitrary catalog scrambles, never an algorithm against its inverse.
function doStep(pattern, cases, goal) {
  for (const before of auf) {
    const aligned = pattern.applyAlg(before);
    if (goal(aligned)) return aligned;
    for (const c of cases) {
      const result = normalizeSideColors(
        aligned.applyAlg(c.algorithms[recommendedVariant(c, "two-look")].moves),
      );
      for (const after of auf) {
        const adjusted = result.applyAlg(after);
        if (goal(adjusted)) return adjusted;
      }
    }
  }
  return null;
}

test("two-look curricula reuse stable cases, variants and practice setups", () => {
  assert.deepEqual(
    learningMethods.map((m) => m.value),
    ["full", "two-look"],
  );
  for (const [section, count] of [
    ["OLL", 10],
    ["PLL", 6],
  ]) {
    const groups = methodGroups(catalog, section, "two-look");
    assert.equal(groups.length, 2);
    const cases = groups.flatMap((g) => g.cases);
    assert.equal(cases.length, count);
    assert.equal(new Set(cases.map((c) => c.id)).size, count);
    for (const c of cases) {
      assert.equal(
        c,
        catalog.find((entry) => entry.id === c.id),
      );
      assert.ok(c.setups.length);
    }
    assert.equal(
      methodGroups(catalog, section).flatMap((g) => g.cases).length,
      section === "OLL" ? 57 : 21,
    );
  }
  assert.deepEqual(methodGroups(catalog, "F2L", "two-look"), []);
  const dot = catalog.find((c) => c.id === "oll-2");
  assert.equal(recommendedVariant(dot, "two-look"), 1);
  assert.equal(recommendedVariant(dot), dot.preferredVariant);
  assert.equal(methodGroups(catalog, "OLL", "two-look")[0].mask, "edges");
  assert.equal(methodGroups(catalog, "PLL", "two-look")[0].mask, "corners");
});

test("two-look OLL orients all 912 catalog setups in at most two stages (independent oracle)", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const [edges, corners] = methodGroups(catalog, "OLL", "two-look");
  for (const c of catalog.filter((c) => c.section === "OLL"))
    for (const setup of c.setups) {
      const first = doStep(
        puzzle.defaultPattern().applyAlg(setup),
        edges.cases,
        crossOriented,
      );
      assert.ok(first, `${c.id}: no cross algorithm`);
      assertF2L(first, `${c.id}: cross disturbed F2L`);
      const second = doStep(first, corners.cases, topOriented);
      assert.ok(second, `${c.id}: no corner algorithm`);
      assertF2L(second, `${c.id}: corners disturbed F2L`);
    }
});

test("two-look PLL solves all 336 catalog setups in at most two stages (independent oracle)", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const [corners, edges] = methodGroups(catalog, "PLL", "two-look");
  for (const c of catalog.filter((c) => c.section === "PLL"))
    for (const setup of c.setups) {
      const first = doStep(
        puzzle.defaultPattern().applyAlg(setup),
        corners.cases,
        cornersPlaced,
      );
      assert.ok(first, `${c.id}: no corner permutation`);
      assert.ok(topOriented(first), `${c.id}: corners disturbed orientation`);
      assertF2L(first, `${c.id}: corners disturbed F2L`);
      const second = doStep(first, edges.cases, solved);
      assert.ok(second, `${c.id}: no edge permutation`);
      assertF2L(second, `${c.id}: edges disturbed F2L`);
    }
});
