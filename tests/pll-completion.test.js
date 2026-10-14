import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { caseCube } from "../src/cube.js";
import { pllDestinations } from "../src/pll-arrows.js";
import { assertOracleFacelets, orbitFaces } from "./helpers/cube-oracle.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const counts = {
  H: [0, 4],
  Z: [0, 4],
  Ua: [0, 3],
  Ub: [0, 3],
  Aa: [3, 0],
  Ab: [3, 0],
  E: [4, 0],
  F: [2, 2],
  Ja: [2, 2],
  Jb: [2, 2],
  Ra: [2, 2],
  Rb: [2, 2],
  T: [2, 2],
  Y: [2, 2],
  V: [2, 2],
  Na: [2, 2],
  Nb: [2, 2],
  Ga: [3, 3],
  Gb: [3, 3],
  Gc: [3, 3],
  Gd: [3, 3],
};
const sameCenters = (a, b) =>
  a.patternData.CENTERS.pieces.every(
    (piece, i) => piece === b.patternData.CENTERS.pieces[i],
  );
const position = (faces) => [
  Number(faces.includes("R")) - Number(faces.includes("L")),
  Number(faces.includes("F")) - Number(faces.includes("B")),
];
const sorted = (moves) =>
  moves.map(({ kind, from, to }) => `${kind}:${from}:${to}`).sort();

// These fixed physical cases are authored as cubie swaps, never as an algorithm
// followed by its inverse: Z swaps UF/UL and UR/UB; Ra swaps URF/UBR and UB/UL;
// Rb swaps URF/UBR and UF/UL. All other cubies and centers are already solved.
test("Z and R algorithms finish independent physical permutation fixtures without an unlisted AUF", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const [id, corners, edges, final] of [
    ["pll-Z", [0, 1, 2, 3], [3, 2, 1, 0], "U'"],
    ["pll-Ra", [1, 0, 2, 3], [0, 1, 3, 2], "U'"],
    ["pll-Rb", [1, 0, 2, 3], [3, 1, 2, 0], "U"],
  ]) {
    const data = structuredClone(puzzle.defaultPattern().patternData);
    data.CORNERS.pieces.splice(0, 4, ...corners);
    data.EDGES.pieces.splice(0, 4, ...edges);
    const fixture = new KPattern(puzzle, data);
    const moves = catalog.find((c) => c.id === id).algorithms[0].moves;
    assert.ok(
      moves.endsWith(` ${final}`),
      `${id}: final adjustment must be visible`,
    );
    const beforeFinal = fixture.applyAlg(moves.slice(0, -final.length).trim());
    assert.equal(
      beforeFinal.isIdentical(puzzle.defaultPattern()),
      false,
      `${id}: old algorithm stops short`,
    );
    assert.equal(
      fixture.applyAlg(moves).isIdentical(puzzle.defaultPattern()),
      true,
      `${id}: no final AUF remains`,
    );
    assertOracleFacelets(
      caseCube(moves),
      fixture,
      `${id}: preview matches the physical case`,
    );
  }
});

test("every PLL variant shows its actual minimal permutation and solves to its ending grip", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const solved = puzzle.defaultPattern();
  const rotations = [solved];
  for (let i = 0; i < rotations.length; i++)
    for (const move of ["x", "y", "z"]) {
      const next = rotations[i].applyAlg(move);
      if (!rotations.some((rotation) => sameCenters(rotation, next)))
        rotations.push(next);
    }
  assert.equal(rotations.length, 24);
  for (const c of catalog.filter((c) => c.section === "PLL"))
    for (const a of c.algorithms) {
      const context = `${c.id}: ${a.label}`;
      const grip = rotations.find((rotation) =>
        sameCenters(rotation, solved.applyAlg(a.moves)),
      );
      const start = grip.applyAlg(new Alg(a.moves).invert());
      assertOracleFacelets(caseCube(a.moves), start, context);
      const actual = [];
      const moved = ["CORNERS", "EDGES"].map((orbit) => {
        const { pieces, orientation } = start.patternData[orbit];
        assert.ok(
          orientation.every((o) => o === 0),
          context,
        );
        assert.ok(
          pieces.slice(4).every((piece, i) => piece === i + 4),
          `${context}: F2L`,
        );
        for (let i = 0; i < 4; i++)
          if (pieces[i] !== i)
            actual.push({
              kind: orbit === "CORNERS" ? "corner" : "edge",
              from: position(orbitFaces[orbit][i]),
              to: position(orbitFaces[orbit][pieces[i]]),
            });
        return pieces.slice(0, 4).filter((piece, i) => piece !== i).length;
      });
      assert.deepEqual(
        moved,
        counts[c.id.slice(4)],
        `${context}: actual cubies, without ignoring AUF`,
      );
      assert.deepEqual(
        sorted(pllDestinations(caseCube(a.moves))),
        sorted(actual),
        `${context}: arrows identify exact destinations`,
      );
      assert.equal(
        start.applyAlg(a.moves).isIdentical(grip),
        true,
        `${context}: all stickers solved in ending grip`,
      );
      if (c.id.startsWith("pll-G")) {
        const corner = start.patternData.CORNERS.pieces
          .slice(0, 4)
          .findIndex((piece, i) => piece === i);
        const edge = start.patternData.EDGES.pieces
          .slice(0, 4)
          .findIndex((piece, i) => piece === i);
        assert.ok(
          [...orbitFaces.EDGES[edge]].every((face) =>
            orbitFaces.CORNERS[corner].includes(face),
          ),
          `${context}: matching block stays fixed`,
        );
      }
    }
});
