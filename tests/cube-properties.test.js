import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { applyAlg, solvedCube, inverse, tokens } from "../src/cube.js";
import { assertOracleFacelets, seededRandom } from "./helpers/cube-oracle.js";

const moves = "U R F D L B M E S x y z u r f d l b Uw Rw Fw Dw Lw Bw".split(
  " ",
);
const suffixes = ["", "'", "2", "2'", "3", "3'"];
const facelets = (cube) =>
  cube.map(({ p, n, color }) => `${p}:${n}:${color}`).sort();

test("every supported move and suffix matches cubing.js at all 54 stickers", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const move of moves)
    for (const suffix of suffixes) {
      const alg = move + suffix;
      assertOracleFacelets(
        applyAlg(solvedCube(), alg),
        puzzle.defaultPattern().applyAlg(alg),
        alg,
      );
      assert.deepEqual(
        facelets(applyAlg(solvedCube(), `${alg} ${inverse(alg)}`)),
        facelets(solvedCube()),
        alg,
      );
    }
});

test("seed 0xc0ffee mixed sequences match an independent engine and preserve cube geometry", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const random = seededRandom(0xc0ffee);
  for (let sample = 0; sample < 64; sample++) {
    const alg = Array.from(
      { length: 32 },
      () =>
        moves[Math.floor(random() * moves.length)] +
        suffixes[Math.floor(random() * suffixes.length)],
    ).join(" ");
    const start = solvedCube();
    const before = structuredClone(start);
    const cube = applyAlg(start, alg);
    assert.deepEqual(start, before, "applyAlg must not mutate its caller");
    assertOracleFacelets(
      cube,
      puzzle.defaultPattern().applyAlg(alg),
      `sample ${sample}: ${alg}`,
    );
    assert.equal(cube.length, 54);
    assert.equal(new Set(cube.map((s) => `${s.p}:${s.n}`)).size, 54);
    for (const color of "URFDLB")
      assert.equal(cube.filter((s) => s.color === color).length, 9);
    assert.deepEqual(facelets(applyAlg(cube, inverse(alg))), facelets(start));
    const split = tokens(alg);
    assert.deepEqual(
      facelets(
        applyAlg(
          applyAlg(start, split.slice(0, 16).join(" ")),
          split.slice(16).join(" "),
        ),
      ),
      facelets(cube),
    );
  }
});

test("move aliases and whole rotations have exact, fixed-frame facelet identities", () => {
  for (const [a, b] of [
    ["x", "R M' L'"],
    ["y", "U E' D'"],
    ["z", "F S B'"],
    ["r", "R M'"],
    ["l", "L M"],
    ["u", "U E'"],
    ["d", "D E"],
    ["f", "F S"],
    ["b", "B S'"],
  ]) {
    assert.deepEqual(
      facelets(applyAlg(solvedCube(), a)),
      facelets(applyAlg(solvedCube(), b)),
      `${a} = ${b}`,
    );
  }
});
