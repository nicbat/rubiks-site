import { solvedCube, applyAlg, centers } from "./cube.js";

export const displayColors = {
  U: "Yellow",
  D: "White",
  F: "Green",
  B: "Blue",
  R: "Orange",
  L: "Red",
};
const schemes = Object.fromEntries(
  ["", "x2", "x", "x'", "z", "z'"].map((rotation) => {
    const scheme = centers(applyAlg(solvedCube(), rotation));
    return [scheme.U, scheme];
  }),
);
// Relabel colors through a proper cube rotation, preserving case geometry and moves.
export function displayCube(cube, top = "U") {
  const scheme = schemes[top] || schemes.U;
  return cube.map((sticker) => ({
    ...sticker,
    p: [...sticker.p],
    n: [...sticker.n],
    color: scheme[sticker.color],
  }));
}
