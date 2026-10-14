import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import catalog from "../data/algorithms.json" with { type: "json" };
import { removeLeadingY } from "../scripts/normalize-algorithms.mjs";
import { caseCube, colorAt, normals, tokens } from "../src/cube.js";
import { assertOracleFacelets, orbitFaces } from "./helpers/cube-oracle.js";

test("catalog algorithms start in their displayed grip without a leading y regrip", () => {
  for (const c of catalog)
    for (const a of c.algorithms)
      assert.doesNotMatch(tokens(a.moves)[0], /^y/, `${c.id}: ${a.label}`);
});

test("offline normalization removes only leading y turns and retains finger-trick grouping", () => {
  assert.equal(removeLeadingY("y2 R (U R' U')"), "R (U R' U')");
  assert.equal(removeLeadingY(" y' y2 R U y R' "), "R U y R'");
  assert.equal(removeLeadingY("y x' L' U L"), "x' L' U L");
  assert.equal(removeLeadingY("R y' R'"), "R y' R'");
  assert.equal(removeLeadingY("x R U R'"), "x R U R'");
  assert.throws(() => removeLeadingY("y invalid"), /Invalid move/);
});

test("regripped PLL variants match independent physical setups at every sticker", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  // Fixed setups from the catalog, oriented independently of each solution.
  // Ua fixes UF and cycles UR/UB/UL; Aa fixes UBR and cycles the other corners.
  const fixtures = [
    ["pll-Ua", 2, "y2", "y2 F2 D F2 R2 F2 D R2 F2 D2 F2 B2 L2 B2 R2 D2 R2 y2"],
    [
      "pll-Aa",
      1,
      "y'",
      "U R L U2 R L' U F2 U2 R2 F2 R2 U' B2 U' F2 U R2 B2 U'",
    ],
  ];
  for (const [id, index, oldRegrip, setup] of fixtures) {
    const moves = catalog.find((c) => c.id === id).algorithms[index].moves;
    const expected = puzzle.defaultPattern().applyAlg(setup);
    // The old displayed grip fails this concrete sticker-state contract.
    assert.throws(() =>
      assertOracleFacelets(caseCube(`${oldRegrip} ${moves}`), expected, id),
    );
    assertOracleFacelets(
      caseCube(moves),
      expected,
      `${id} variant ${index}: new starting grip`,
    );
  }
});

test("regripped OLL 5 displays the independently set up orientation pattern", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const pattern = puzzle
    .defaultPattern()
    .applyAlg("R' F' L F' R' D2 L F2 R2 U2 L2 B2 L2 U2 L2 U2");
  const moves = catalog.find((c) => c.id === "oll-5").algorithms[1].moves;
  const cube = caseCube(moves);
  // OLL solutions may leave different permutations, but every yellow sticker
  // must occupy the same face/position as this independently generated setup.
  for (const [orbit, pieces] of Object.entries(orbitFaces)) {
    const data = pattern.patternData[orbit];
    pieces.forEach((faces, i) => {
      const p = [...faces].reduce(
        (v, f) => v.map((x, j) => x + normals[f][j]),
        [0, 0, 0],
      );
      [...faces].forEach((face, sticker) => {
        const orientation = orbit === "CENTERS" ? 0 : data.orientation[i];
        const color =
          pieces[data.pieces[i]][
            (sticker - orientation + faces.length) % faces.length
          ];
        assert.equal(
          colorAt(cube, p, normals[face]) === "U",
          color === "U",
          `${orbit}[${i}] ${face}`,
        );
      });
    });
  }
});
