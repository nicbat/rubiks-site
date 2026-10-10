// A facelet model: positions and outward normals in right/up/front coordinates.
// It handles face, slice, wide and whole-cube moves without a rendering dependency.
export const normals = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};
const eq = (a, b) => a.every((v, i) => v === b[i]);
export function solvedCube() {
  const stickers = [];
  for (const [color, n] of Object.entries(normals))
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const p = n.map((v) => v);
        const axes = [0, 1, 2].filter((i) => n[i] === 0);
        p[axes[0]] = a;
        p[axes[1]] = b;
        stickers.push({ p, n: [...n], color });
      }
  return stickers;
}
export function tokens(alg) {
  const clean = alg.replace(/[()]/g, " ").trim();
  if (!clean) return [];
  const moves = clean.split(/\s+/);
  if (
    moves.some((m) => !/^([URFDLBMESxyzurfdlb]|[URFDLB]w)([23]?)(\'?)$/.test(m))
  )
    throw new Error("Invalid move notation");
  return moves;
}
export function inverse(alg) {
  return tokens(alg)
    .reverse()
    .map((m) =>
      m.endsWith("'") ? m.slice(0, -1) : m.endsWith("2") ? m : m + "'",
    )
    .join(" ");
}
function rotate(v, axis, turn) {
  const o = [...v],
    a = (axis + 1) % 3,
    b = (axis + 2) % 3;
  o[a] = -turn * v[b];
  o[b] = turn * v[a];
  return o;
}
export function applyAlg(cube, alg) {
  let out = cube.map((s) => ({ ...s, p: [...s.p], n: [...s.n] }));
  const spec = {
    R: [0, 1, -1],
    L: [0, -1, 1],
    U: [1, 1, -1],
    D: [1, -1, 1],
    F: [2, 1, -1],
    B: [2, -1, 1],
    M: [0, 0, 1],
    E: [1, 0, 1],
    S: [2, 0, -1],
    x: [0, 2, -1],
    y: [1, 2, -1],
    z: [2, 2, -1],
  };
  for (const move of tokens(alg)) {
    const raw = move[0],
      wide = /[urfdlb]/.test(raw) || move.includes("w");
    const key = wide ? raw.toUpperCase() : raw;
    const [axis, layer, dir] = spec[key];
    const turns = move.includes("2") ? 2 : move.includes("3") ? 3 : 1;
    const sign = move.endsWith("'") ? -dir : dir;
    for (let t = 0; t < turns; t++)
      out = out.map((s) =>
        layer === 2 || (wide ? s.p[axis] * layer >= 0 : s.p[axis] === layer)
          ? { ...s, p: rotate(s.p, axis, sign), n: rotate(s.n, axis, sign) }
          : s,
      );
  }
  return out;
}
export function colorAt(cube, p, n) {
  return cube.find((s) => eq(s.p, p) && eq(s.n, n)).color;
}
export function centers(cube) {
  return Object.fromEntries(
    Object.entries(normals).map(([f, n]) => [f, colorAt(cube, n, n)]),
  );
}
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
export function isSolved(cube) {
  const c = centers(cube);
  return cube.every(
    (s) => s.color === c[Object.keys(normals).find((f) => eq(normals[f], s.n))],
  );
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
