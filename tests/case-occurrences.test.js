import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cube3x3x3 } from "cubing/puzzles";
import { occurrenceFor, occurrenceStage } from "../src/case-occurrences.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);

test("occurrence data covers exactly the stable catalog IDs and includes skip mass", () => {
  for (const [section, denominator, count] of [
    ["OLL", 216, 57],
    ["PLL", 72, 21],
  ]) {
    const stage = occurrenceStage(section);
    const cases = catalog.filter((c) => c.section === section);
    assert.equal(cases.length, count);
    assert.deepEqual(
      Object.keys(stage.weights).sort(),
      cases.map((c) => c.id).sort(),
    );
    assert.equal(stage.denominator, denominator);
    assert.equal(stage.skipWeight, 1);
    const total = cases.reduce((sum, c) => sum + stage.weights[c.id], 0);
    assert.equal(total, denominator - 1, `${section}: non-skip total`);
    assert.equal(total + stage.skipWeight, denominator);
    for (const c of cases) {
      const probability = occurrenceFor(c);
      assert.equal(probability.numerator, 1, `${c.id}: reduced fraction`);
      assert.equal(
        probability.denominator * stage.weights[c.id],
        denominator,
        c.id,
      );
      assert.equal(probability.fraction, `1/${probability.denominator}`);
    }
  }
  assert.equal(
    occurrenceStage("OLL").source.url,
    "https://speedcubing.org/pages/full-oll",
  );
  assert.equal(
    occurrenceStage("PLL").source.url,
    "https://www.cubeskills.com/uploads/pdf/tutorials/pll-algorithms.pdf",
  );
});

test("every occurrence matches the independent cube oracle's rotational case multiplicity", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const c of catalog) {
    const patterns = new Set();
    for (let before = 0; before < (c.section === "PLL" ? 4 : 1); before++) {
      for (let after = 0; after < 4; after++) {
        const pattern = puzzle
          .defaultPattern()
          .applyAlg(
            `${"U ".repeat(before)}${c.setups[0]} ${"U ".repeat(after)}`,
          ).patternData;
        patterns.add(
          JSON.stringify(
            ["CORNERS", "EDGES"].map((orbit) =>
              c.section === "OLL"
                ? pattern[orbit].orientation.slice(0, 4)
                : pattern[orbit].pieces.slice(0, 4),
            ),
          ),
        );
      }
    }
    // OLL: 3^3 corner twists × 2^3 edge flips = 216 orientations.
    // PLL: 4! corner × 4! edge permutations / 2 (matching parity) = 288.
    // PLL probabilities count all four final U adjustments as the same case.
    const stateCount = c.section === "OLL" ? 216 : 288;
    const probability = occurrenceFor(c);
    assert.equal(
      probability.numerator * stateCount,
      patterns.size * probability.denominator,
      `${c.id}: ${patterns.size} equally likely states of ${stateCount}`,
    );
  }
});

test("unknown cases and sections do not acquire a guessed occurrence", () => {
  assert.equal(occurrenceFor({ id: "oll-58", section: "OLL" }), null);
  assert.equal(occurrenceFor({ id: "pll-A", section: "PLL" }), null);
  assert.equal(occurrenceFor({ id: "pll-H", section: "OLL" }), null);
  assert.equal(occurrenceFor({ id: "f2l-1", section: "F2L" }), null);
  assert.equal(occurrenceStage("F2L"), null);
});
