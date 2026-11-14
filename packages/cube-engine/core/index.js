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
export function validateSize(size) {
  if (!Number.isInteger(size) || size < 2 || size > 7)
    throw new Error("Cube size must be an integer from 2 to 7");
  return size;
}
export function cubeSize(cube) {
  return validateSize(Math.sqrt(cube.length / 6));
}
export function solvedCube(size = 3) {
  validateSize(size);
  const extent = (size - 1) / 2;
  const stickers = [];
  for (const [color, n] of Object.entries(normals))
    for (let a = -extent; a <= extent; a++)
      for (let b = -extent; b <= extent; b++) {
        const p = n.map((v) => v * extent);
        const axes = [0, 1, 2].filter((i) => n[i] === 0);
        p[axes[0]] = a;
        p[axes[1]] = b;
        stickers.push({ p, n: [...n], color });
      }
  return stickers;
}
const notation = /^(?:(\d+)?([URFDLB])w|([URFDLBMESxyzurfdlb]))([23]?)('?)$/;
export function tokens(alg, size = 3) {
  validateSize(size);
  const clean = alg.replace(/[()]/g, " ").trim();
  if (!clean) return [];
  const moves = clean.split(/\s+/);
  for (const move of moves) moveGeometry(move, size);
  return moves;
}
export function inverse(alg, size = 3) {
  return tokens(alg, size)
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
  const size = cubeSize(cube);
  for (const move of tokens(alg, size)) {
    const geometry = moveGeometry(move, size);
    const { axis, turns, sign } = geometry;
    for (let t = 0; t < turns; t++)
      out = out.map((s) =>
        inMove(s.p, geometry)
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
  const size = cubeSize(cube);
  if (size % 2 === 0) throw new Error("Even cubes have no fixed face centers");
  const extent = (size - 1) / 2;
  return Object.fromEntries(
    Object.entries(normals).map(([f, n]) => [
      f,
      colorAt(
        cube,
        n.map((v) => v * extent),
        n,
      ),
    ]),
  );
}
export function isSolved(cube) {
  cubeSize(cube);
  const colors = new Map();
  return cube.every(({ n, color }) => {
    const key = n.join(",");
    if (!colors.has(key)) colors.set(key, color);
    return colors.get(key) === color;
  });
}
// Shared by exact mechanics and visual interpolation; no DOM dependency.
export function moveGeometry(move, size = 3) {
  validateSize(size);
  const match = notation.exec(move);
  if (!match) throw new Error("Invalid move notation");
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
  const raw = match[2] || match[3];
  const wide = Boolean(match[2]) || /[urfdlb]/.test(raw);
  const width = wide ? Number(match[1] || 2) : 1;
  if ((width < 2 && wide) || width > size || match[1]?.startsWith("0"))
    throw new Error("Wide move exceeds cube size");
  if (/[MES]/.test(raw) && size % 2 === 0)
    throw new Error("Slice moves require an odd cube size");
  const [axis, layer, dir] = spec[wide ? raw.toUpperCase() : raw];
  const extent = (size - 1) / 2;
  const all = /[xyz]/.test(raw);
  const outer = /[URFDLBurfdlb]/.test(raw);
  const low = all
    ? -extent
    : outer
      ? layer > 0
        ? extent - width + 1
        : -extent
      : 0;
  const high = all
    ? extent
    : outer
      ? layer > 0
        ? extent
        : -extent + width - 1
      : 0;
  return {
    axis,
    layer,
    wide,
    turns: Number(match[4] || 1),
    sign: match[5] ? -dir : dir,
    low,
    high,
  };
}
export function inMove(p, { axis, layer, wide, low, high }) {
  if (low !== undefined) return p[axis] >= low && p[axis] <= high;
  return layer === 2 || (wide ? p[axis] * layer >= 0 : p[axis] === layer);
}
