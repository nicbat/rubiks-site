// Original observable-state model. See four-by-four-state.md for legality proof.
import { solvedCube, applyAlg, normals } from "../core/index.js";
import { uniformInteger, secureUint32, checkAbort } from "./random-source.js";
const faces = ["U", "R", "F", "D", "L", "B"];
const corners = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const key = (p, n) => `${p}/${n}`;
const solved = solvedCube(4);
const groups = new Map();
for (const sticker of solved) {
  const k = String(sticker.p);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(sticker);
}
const cornerSlots = corners.map((name) => {
  const p = [0, 0, 0];
  for (const face of name) normals[face].forEach((v, i) => (p[i] += v * 1.5));
  return { p, faces: [...name] };
});
const wingSlots = [...groups.values()]
  .filter((g) => g.length === 2)
  .sort((a, b) => (String(a[0].p) < String(b[0].p) ? -1 : 1))
  .map((g) => {
    const fs = g
      .map((s) => s.color)
      .sort((a, b) => faces.indexOf(a) - faces.indexOf(b));
    const p = g[0].p.slice();
    // Order the two normals so the signed triple product is positive. Proper
    // rotations preserve it; this removes any independent wing flip coordinate.
    if (dot(p, cross(normals[fs[0]], normals[fs[1]])) < 0) fs.reverse();
    return { p, faces: fs };
  });
const centerSlots = [...groups.values()]
  .filter((g) => g.length === 1)
  .sort((a, b) => (String(a[0].p) < String(b[0].p) ? -1 : 1))
  .map((g) => ({ p: g[0].p.slice(), faces: [g[0].color] }));
const freezeSlots = (slots) =>
  Object.freeze(
    slots.map((s) =>
      Object.freeze({
        position: Object.freeze(s.p.slice()),
        faces: Object.freeze(s.faces.slice()),
      }),
    ),
  );
export const FOUR_BY_FOUR_COORDINATES = Object.freeze({
  faces: Object.freeze(faces.slice()),
  corners: freezeSlots(cornerSlots),
  wings: freezeSlots(wingSlots),
  centers: freezeSlots(centerSlots),
});
export function solvedFourByFourState() {
  return {
    cornerPermutation: corners.map((_, i) => i),
    cornerOrientation: new Array(8).fill(0),
    wingPermutation: wingSlots.map((_, i) => i),
    centerColors: centerSlots.map((s) => faces.indexOf(s.faces[0])),
  };
}
function ints(value, length, bound) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    Array.from(value).every((v) => Number.isInteger(v) && v >= 0 && v < bound)
  );
}
export function validateFourByFourState(state) {
  if (
    !state ||
    Object.getPrototypeOf(state) !== Object.prototype ||
    Object.keys(state).length !== 4
  )
    throw new TypeError("Invalid 4x4 state");
  const {
    cornerPermutation: cp,
    cornerOrientation: co,
    wingPermutation: wp,
    centerColors: ct,
  } = state;
  if (
    !ints(cp, 8, 8) ||
    new Set(cp).size !== 8 ||
    !ints(co, 8, 3) ||
    co.reduce((a, b) => a + b, 0) % 3 ||
    !ints(wp, 24, 24) ||
    new Set(wp).size !== 24 ||
    !ints(ct, 24, 6) ||
    faces.some((_, i) => ct.filter((v) => v === i).length !== 4)
  )
    throw new TypeError("Invalid 4x4 state coordinates");
  return {
    cornerPermutation: cp.slice(),
    cornerOrientation: co.slice(),
    wingPermutation: wp.slice(),
    centerColors: ct.slice(),
  };
}
export function sampleFourByFourState({
  randomUint32 = secureUint32,
  signal,
} = {}) {
  checkAbort(signal);
  const shuffle = (values) => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = uniformInteger(i + 1, randomUint32, signal);
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  const state = solvedFourByFourState();
  shuffle(state.cornerPermutation);
  shuffle(state.wingPermutation);
  shuffle(state.centerColors);
  for (let i = 0; i < 7; i++)
    state.cornerOrientation[i] = uniformInteger(3, randomUint32, signal);
  state.cornerOrientation[7] =
    (3 - (state.cornerOrientation.reduce((a, b) => a + b, 0) % 3)) % 3;
  return state;
}
function stickersFor(state, labels = false) {
  const result = [];
  const add = (slot, colors) =>
    slot.faces.forEach((face, i) =>
      result.push({
        p: slot.p.slice(),
        n: normals[face].slice(),
        color: colors[i],
      }),
    );
  cornerSlots.forEach((slot, i) =>
    add(
      slot,
      slot.faces.map((_, j) =>
        labels
          ? `c:${i}:${j}`
          : corners[state.cornerPermutation[i]][
              (j - state.cornerOrientation[i] + 3) % 3
            ],
      ),
    ),
  );
  wingSlots.forEach((slot, i) =>
    add(
      slot,
      slot.faces.map((_, j) =>
        labels ? `w:${i}:${j}` : wingSlots[state.wingPermutation[i]].faces[j],
      ),
    ),
  );
  centerSlots.forEach((slot, i) =>
    add(slot, [labels ? `t:${i}:0` : faces[state.centerColors[i]]]),
  );
  return result;
}
export function fourByFourStateToFacelets(state) {
  return stickersFor(validateFourByFourState(state));
}
const effects = new Map(); // 36 legal face/block moves, bounded by grammar.
function effect(move) {
  if (effects.has(move)) return effects.get(move);
  const moved = applyAlg(stickersFor(solvedFourByFourState(), true), move);
  const lookup = new Map(moved.map((s) => [key(s.p, s.n), s.color]));
  const read = (slots) =>
    slots.map((slot) =>
      slot.faces.map((f) =>
        lookup.get(key(slot.p, normals[f])).split(":").slice(1).map(Number),
      ),
    );
  const e = { c: read(cornerSlots), w: read(wingSlots), t: read(centerSlots) };
  effects.set(move, e);
  return e;
}
export function applyFourByFourMoves(state, algorithm) {
  let current = validateFourByFourState(state);
  if (
    typeof algorithm !== "string" ||
    algorithm.length > 4096 ||
    (algorithm !== "" &&
      !/^[URFDLB]w?(?:2|')?(?: [URFDLB]w?(?:2|')?)*$/.test(algorithm))
  )
    throw new TypeError("Invalid 4x4 move sequence");
  const moves = algorithm ? algorithm.split(" ") : [];
  if (moves.length > 512) throw new TypeError("Too many 4x4 moves");
  for (const move of moves) {
    const e = effect(move);
    const next = {
      cornerPermutation: [],
      cornerOrientation: [],
      wingPermutation: [],
      centerColors: [],
    };
    e.c.forEach((stickers, i) => {
      const [source, side] = stickers[0];
      next.cornerPermutation[i] = current.cornerPermutation[source];
      next.cornerOrientation[i] =
        (current.cornerOrientation[source] - side + 3) % 3;
    });
    e.w.forEach((stickers, i) => {
      if (stickers[0][1] !== 0) throw Error("Wing chirality invariant failed");
      next.wingPermutation[i] = current.wingPermutation[stickers[0][0]];
    });
    e.t.forEach(
      (stickers, i) =>
        (next.centerColors[i] = current.centerColors[stickers[0][0]]),
    );
    current = next;
  }
  return current;
}
export const FOUR_BY_FOUR_MOVES = Object.freeze(
  faces.flatMap((face) => [
    face,
    `${face}2`,
    `${face}'`,
    `${face}w`,
    `${face}w2`,
    `${face}w'`,
  ]),
);
/** Destination-to-source center slot indices; immutable, independent of target. */
export function fourByFourCenterMovePermutation(move) {
  if (!FOUR_BY_FOUR_MOVES.includes(move))
    throw new TypeError("Invalid 4x4 move");
  return Object.freeze(effect(move).t.map((stickers) => stickers[0][0]));
}
