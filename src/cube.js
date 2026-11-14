// Learning-specific helpers stay in the application; mechanics live in the engine.
import {
  solvedCube,
  applyAlg,
  inverse,
  centers,
  normals,
} from "@last-layer/cube-engine/core";
export {
  solvedCube,
  applyAlg,
  tokens,
  inverse,
  colorAt,
  centers,
  isSolved,
  moveGeometry,
  inMove,
  normals,
} from "@last-layer/cube-engine/core";

const eq = (a, b) => a.every((v, i) => v === b[i]);
export function caseCube(alg) {
  // Match the solved destination's center orientation before undoing the alg.
  const endCenters = centers(applyAlg(solvedCube(), alg));
  return applyAlg(
    solvedCube().map((s) => ({ ...s, color: endCenters[s.color] })),
    inverse(alg),
  );
}
export function f2lSolved(cube) {
  const c = centers(cube);
  return cube
    .filter((s) => s.p[1] < 1)
    .every(
      (s) =>
        s.color === c[Object.keys(normals).find((f) => eq(normals[f], s.n))],
    );
}
export function topOriented(cube) {
  const c = centers(cube);
  return cube.filter((s) => s.n[1] === 1).every((s) => s.color === c.U);
}
export function signature(cube, section) {
  const c = centers(cube),
    colors = Object.fromEntries(Object.entries(c).map(([k, v]) => [v, k]));
  return cube
    .filter((s) => s.p[1] === 1)
    .sort((a, b) =>
      JSON.stringify([a.p, a.n]).localeCompare(JSON.stringify([b.p, b.n])),
    )
    .map((s) =>
      section === "OLL" ? (s.color === c.U ? "1" : "0") : colors[s.color],
    )
    .join("");
}
export function caseSignature(cube, section) {
  const candidates = [];
  for (let y = 0; y < 4; y++)
    for (let u = 0; u < 4; u++)
      candidates.push(
        signature(
          applyAlg(cube, `${"y ".repeat(y)}${"U ".repeat(u)}`),
          section,
        ),
      );
  return candidates.sort()[0];
}
