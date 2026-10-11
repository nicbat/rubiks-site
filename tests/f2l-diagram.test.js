import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { applyAlg, solvedCube } from "../src/cube.js";
import { f2lDiagram } from "../src/f2l-diagram.js";
import { palette } from "../src/diagram.js";
import { orbitFaces } from "./helpers/cube-oracle.js";

const facePositions = {
  U: "ULB UB UBR UL U UR UFL UF URF",
  F: "UFL UF URF FL F FR DLF DF DFR",
  R: "URF UR UBR FR R BR DFR DR DRB",
};

test("static F2L previews show oracle U/F/R stickers and follow the target pair", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const setup of [
    "",
    "R U R'",
    "F' U' F",
    "U R U' R'",
    "R U2 R' U' R U R'",
  ]) {
    const cube = applyAlg(solvedCube(), setup);
    const before = structuredClone(cube);
    const html = f2lDiagram(cube);
    const pattern = puzzle.defaultPattern().applyAlg(setup).patternData;
    const stickers = [
      ...html.matchAll(
        /data-face="([UFR])" data-row="(\d)" data-col="(\d)" data-color="([URFDLB])" data-target="(true|false)" points="([^"]+)" fill="([^"]+)"/g,
      ),
    ];
    assert.equal(stickers.length, 27);
    for (const [, face, row, col, color, target, points, fill] of stickers) {
      const position =
        facePositions[face].split(" ")[Number(row) * 3 + Number(col)];
      const orbit =
        position.length === 3
          ? "CORNERS"
          : position.length === 2
            ? "EDGES"
            : "CENTERS";
      const pieces = orbitFaces[orbit];
      const index = pieces.findIndex((p) =>
        [...position].every((f) => p.includes(f)),
      );
      const piece = pieces[pattern[orbit].pieces[index]];
      const orientation =
        orbit === "CENTERS" ? 0 : pattern[orbit].orientation[index];
      const expected =
        piece[
          (pieces[index].indexOf(face) - orientation + position.length) %
            position.length
        ];
      const isTarget = piece === "DFR" || piece === "FR";
      assert.equal(color, expected, `${setup}: ${face}[${row},${col}]`);
      assert.equal(
        target,
        String(isTarget),
        `${setup}: highlighted ${position}`,
      );
      assert.equal(
        fill,
        isTarget || orbit === "CENTERS"
          ? palette[expected]
          : "var(--diagram-muted, #c8d2dc)",
      );
      assert.equal(points.split(" ").length, 4);
    }
    assert.deepEqual(
      cube,
      before,
      "rendering does not mutate the supplied cube",
    );
  }
});

test("static preview has a fixed isometric orientation and escaped accessible label", () => {
  const html = f2lDiagram(solvedCube(), 'Pair "<one>');
  assert.match(html, /aria-label="Pair &quot;&lt;one&gt;"/);
  assert.match(
    html,
    /data-face="U" data-row="0" data-col="0"[^>]*points="72,6 90,15 72,24 54,15"/,
  );
  assert.match(
    html,
    /data-face="F" data-row="2" data-col="2"[^>]*data-target="true"[^>]*points="54,91 72,100 72,120 54,111"/,
  );
  assert.match(
    html,
    /data-face="R" data-row="2" data-col="0"[^>]*data-target="true"[^>]*points="72,100 90,91 90,111 72,120"/,
  );
  assert.doesNotMatch(html, /cube-player|cube-stage|<animate|<script/);
});
