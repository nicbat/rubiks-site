import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { renderNotation } from "../src/notation-view.js";
import { orbitFaces } from "./helpers/cube-oracle.js";

// Hand-authored positions in an unfolded net, viewed from outside each face.
const facePositions = {
  U: "ULB UB UBR UL U UR UFL UF URF",
  L: "ULB UL UFL BL L FL DBL DL DLF",
  F: "UFL UF URF FL F FR DLF DF DFR",
  R: "URF UR UBR FR R BR DFR DR DRB",
  B: "UBR UB ULB BR B BL DRB DB DBL",
  D: "DLF DF DFR DL D DR DBL DB DRB",
};
const moves = "U D R L F B r l u d f b M E S x y z".split(" ");
test("notation demos render every sticker in its correct net position for all 54 moves", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const move of moves)
    for (const suffix of ["", "'", "2"]) {
      const token = move + suffix;
      const html = renderNotation(move, suffix);
      const nets = [...html.matchAll(/<svg class="cube-net"[^]*?<\/svg>/g)];
      assert.equal(nets.length, 2);
      for (const [i, net] of nets.entries()) {
        const pattern = puzzle
          .defaultPattern()
          .applyAlg(i ? token : "").patternData;
        const stickers = [
          ...net[0].matchAll(
            /data-face="([URFDLB])" data-row="(\d)" data-col="(\d)" data-color="([URFDLB])"/g,
          ),
        ];
        assert.equal(stickers.length, 54);
        assert.equal(
          new Set(stickers.map((s) => s.slice(1, 4).join(""))).size,
          54,
        );
        for (const [, face, row, col, color] of stickers) {
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
          const orientation =
            orbit === "CENTERS" ? 0 : pattern[orbit].orientation[index];
          const sticker = pieces[index].indexOf(face);
          const expected =
            pieces[pattern[orbit].pieces[index]][
              (sticker - orientation + position.length) % position.length
            ];
          assert.equal(
            color,
            expected,
            `${i ? token : "solved"}: ${face}[${row},${col}]`,
          );
        }
      }
    }
});
