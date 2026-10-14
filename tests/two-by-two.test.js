import { test } from "node:test";
import assert from "node:assert/strict";
import { puzzles } from "cubing/puzzles";
import { KPattern } from "cubing/kpuzzle";
import {
  twoByTwoAlgorithms,
  twoByTwoLessons,
  twoByTwoSetup,
} from "../src/two-by-two.js";
import { renderTwoByTwo } from "../src/two-by-two-view.js";

const permutations = (xs) =>
  xs.length
    ? xs.flatMap((x, i) =>
        permutations(xs.filter((_, j) => i !== j)).map((rest) => [x, ...rest]),
      )
    : [[]];
const adjustments = ["", "U", "U2", "U'"];

test("seven Ortega OLL algorithms cover all 26 non-solved corner orientations with any bottom permutation", async () => {
  const puzzle = await puzzles["2x2x2"].kpuzzle();
  const algorithms = twoByTwoAlgorithms.filter((a) => a.stage === "OLL");
  assert.equal(algorithms.length, 7);
  let states = 0;
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++)
      for (let c = 0; c < 3; c++) {
        const d = (6 - a - b - c) % 3;
        if (a + b + c + d === 0) continue;
        for (const bottom of permutations([4, 5, 6, 7])) {
          const pattern = new KPattern(puzzle, {
            CORNERS: {
              pieces: [0, 1, 2, 3, ...bottom],
              orientation: [a, b, c, d, 0, 0, 0, 0],
            },
          });
          assert.ok(
            algorithms.some((algorithm) =>
              adjustments.some((auf) => {
                const result = pattern.applyAlg(`${auf} ${algorithm.moves}`)
                  .patternData.CORNERS;
                return (
                  result.orientation.every((o) => o === 0) &&
                  result.pieces.slice(0, 4).every((p) => p < 4) &&
                  result.pieces.slice(4).every((p) => p >= 4)
                );
              }),
            ),
            `Uncovered orientation ${a},${b},${c},${d}; bottom ${bottom}`,
          );
          states++;
        }
      }
  assert.equal(states, 26 * 24);
});

test("PBL algorithms solve independently specified adjacent and diagonal swaps on both layers", async () => {
  const puzzle = await puzzles["2x2x2"].kpuzzle();
  // URF, UBR, ULB, UFL, DFR, DLF, DBL, DRB orbit order.
  // These fixtures specify swaps geometrically, independently of algorithm inversion.
  const swaps = {
    "2x2-pbl-adj": [[0, 1]],
    "2x2-pbl-diag": [[0, 2]],
    "2x2-pbl-adj-adj": [
      [1, 2],
      [6, 7],
    ],
    "2x2-pbl-adj-diag": [
      [1, 2],
      [5, 7],
    ],
    "2x2-pbl-diag-diag": [
      [1, 3],
      [5, 7],
    ],
  };
  for (const algorithm of twoByTwoAlgorithms.filter((a) => a.stage === "PBL")) {
    const pieces = [0, 1, 2, 3, 4, 5, 6, 7];
    for (const [a, b] of swaps[algorithm.id])
      [pieces[a], pieces[b]] = [pieces[b], pieces[a]];
    const pattern = new KPattern(puzzle, {
      CORNERS: { pieces, orientation: Array(8).fill(0) },
    });
    assert.deepEqual(
      pattern.applyAlg(algorithm.moves).patternData,
      puzzle.defaultPattern().patternData,
      algorithm.id,
    );
    assert.deepEqual(
      puzzle.defaultPattern().applyAlg(twoByTwoSetup(algorithm)).patternData,
      pattern.patternData,
      `${algorithm.id} teaching setup`,
    );
  }
  assert.equal(twoByTwoAlgorithms.filter((a) => a.stage === "PBL").length, 5);
});

test("OLL examples show the advertised number of oriented top corners and a completed bottom face", async () => {
  const puzzle = await puzzles["2x2x2"].kpuzzle();
  const oriented = { L: 2, U: 2, T: 2, Pi: 0, H: 0, Antisune: 1, Sune: 1 };
  for (const algorithm of twoByTwoAlgorithms.filter((a) => a.stage === "OLL")) {
    const { pieces, orientation } = puzzle
      .defaultPattern()
      .applyAlg(twoByTwoSetup(algorithm)).patternData.CORNERS;
    assert.equal(
      orientation.slice(0, 4).filter((o) => o === 0).length,
      oriented[algorithm.name],
    );
    assert.deepEqual(orientation.slice(4), [0, 0, 0, 0]);
    assert.ok(pieces.slice(4).every((p) => p >= 4));
  }
});

test("reference offers local review toggles and all 12 examples without fabricating mastery or a 3D player", () => {
  const progress = { reviewed: ["ortega-face"] };
  const before = structuredClone(progress);
  const html = renderTwoByTwo(progress, (moves) => `<code>${moves}</code>`);
  assert.equal(twoByTwoLessons.length, 3);
  assert.equal(new Set(twoByTwoAlgorithms.map((a) => a.id)).size, 12);
  assert.equal((html.match(/data-action="review-lesson"/g) || []).length, 3);
  assert.equal((html.match(/<summary>Build /g) || []).length, 12);
  assert.match(html, /data-id="ortega-face" aria-pressed="true"/);
  assert.match(html, /data-id="ortega-oll" aria-pressed="false"/);
  assert.doesNotMatch(html, /data-action="(?:known|practice)|data-cube-player/);
  assert.deepEqual(progress, before);
});
