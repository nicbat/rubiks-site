import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { readFileSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
test("cubing.js independently confirms all 1,248 setups preserve F2L and all PLL tops stay oriented", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const c of catalog)
    for (const setup of c.setups) {
      const pattern = puzzle.defaultPattern().applyAlg(setup).patternData;
      for (const orbit of ["EDGES", "CORNERS"]) {
        for (let i = 4; i < pattern[orbit].pieces.length; i++) {
          assert.equal(
            pattern[orbit].pieces[i],
            i,
            `${c.id}: ${orbit} permutation`,
          );
          assert.equal(
            pattern[orbit].orientation[i],
            0,
            `${c.id}: ${orbit} orientation`,
          );
        }
        if (c.section === "PLL")
          assert.ok(
            pattern[orbit].orientation.every((o) => o === 0),
            c.id,
          );
      }
    }
});
