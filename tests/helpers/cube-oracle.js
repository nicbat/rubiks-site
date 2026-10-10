import assert from "node:assert/strict";
import { colorAt } from "../../src/cube.js";

// cubing.js's documented 3x3 SVG sticker IDs define orbit order and orientation.
// Kept separate from the application's move tables and coordinate transforms.
export const orbitFaces = {
  CORNERS: ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"],
  EDGES: [
    "UF",
    "UR",
    "UB",
    "UL",
    "DF",
    "DR",
    "DB",
    "DL",
    "FR",
    "FL",
    "BR",
    "BL",
  ],
  CENTERS: ["U", "L", "F", "R", "B", "D"],
};
const normal = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};
export function assertOracleFacelets(cube, pattern, context) {
  for (const [orbit, pieces] of Object.entries(orbitFaces)) {
    const data = pattern.patternData[orbit];
    pieces.forEach((faces, i) => {
      const p = [...faces].reduce(
        (v, f) => v.map((x, j) => x + normal[f][j]),
        [0, 0, 0],
      );
      [...faces].forEach((face, sticker) => {
        const orientation = orbit === "CENTERS" ? 0 : data.orientation[i];
        const color =
          pieces[data.pieces[i]][
            (sticker - orientation + faces.length) % faces.length
          ];
        assert.equal(
          colorAt(cube, p, normal[face]),
          color,
          `${context}: ${orbit}[${i}] ${face}`,
        );
      });
    });
  }
}
export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
