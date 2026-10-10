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

test("every configured algorithm variant matches the oracle at all 54 stickers", async () => {
  const { applyAlg, solvedCube } = await import("../src/cube.js");
  const { assertOracleFacelets } = await import("./helpers/cube-oracle.js");
  const puzzle = await cube3x3x3.kpuzzle();
  for (const c of catalog)
    for (const a of c.algorithms)
      assertOracleFacelets(
        applyAlg(solvedCube(), a.moves),
        puzzle.defaultPattern().applyAlg(a.moves),
        `${c.id}: ${a.label}`,
      );
});

test("catalog defaults and configurable metadata reference usable algorithms", async () => {
  const { tokens } = await import("../src/cube.js");
  for (const c of catalog) {
    assert.ok(
      Number.isInteger(c.preferredVariant) && c.preferredVariant >= 0,
      c.id,
    );
    assert.ok(c.algorithms[c.preferredVariant], `${c.id}: missing default`);
    assert.ok(c.setups.length > 0, `${c.id}: missing setups`);
    for (const field of ["id", "name", "group", "source"])
      assert.ok(
        typeof c[field] === "string" && c[field].trim(),
        `${c.id}: ${field}`,
      );
    assert.equal(new URL(c.source).protocol, "https:");
    assert.equal(
      new Set(c.algorithms.map((a) => a.label)).size,
      c.algorithms.length,
      `${c.id}: duplicate variant labels`,
    );
    for (const a of c.algorithms) {
      assert.ok(a.label.trim(), c.id);
      assert.ok(tokens(a.moves).length > 0, `${c.id}: empty algorithm`);
    }
  }
});
