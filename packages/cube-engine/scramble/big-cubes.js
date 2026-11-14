import { solvedCube, applyAlg, cubeSize, inverse } from "../core/index.js";
import { createScrambleError } from "./index.js";
import { uniformInteger, secureUint32, checkAbort } from "./random-source.js";
import { CUBE_ORIENTATIONS } from "./orientation.js";
// Length/move-inventory comparison: TNoodle-lib d01a947 CubePuzzle.java.
// These are original policies, not a claim of identical TNoodle sequence output.
const policies = Object.freeze({
  555: Object.freeze({ size: 5, length: 60 }),
  666: Object.freeze({ size: 6, length: 80 }),
  777: Object.freeze({ size: 7, length: 100 }),
});
const faces = ["R", "U", "F", "L", "D", "B"];
const cache = new Map(); // Exactly three supported sizes, never target-keyed.
let corrections;

function cornerOrientation(cube, extent) {
  for (const d of cube) {
    if (d.color !== "D" || !d.p.every((v) => Math.abs(v) === extent)) continue;
    const b = cube.find(
      (s) => s.color === "B" && s.p.every((v, i) => v === d.p[i]),
    );
    const l = cube.find(
      (s) => s.color === "L" && s.p.every((v, i) => v === d.p[i]),
    );
    if (b && l) return `${d.n}/${b.n}`;
  }
  throw createScrambleError("GENERATION_FAILED", "Invalid cube corner");
}
function canonical(cube, size) {
  if (!corrections) {
    corrections = new Map(
      CUBE_ORIENTATIONS.map((rotation) => [
        cornerOrientation(applyAlg(solvedCube(3), rotation), 1),
        inverse(rotation),
      ]),
    );
    if (corrections.size !== 24)
      throw createScrambleError(
        "GENERATION_FAILED",
        "Invalid orientation group",
      );
  }
  const extent = (size - 1) / 2;
  const correction = corrections.get(cornerOrientation(cube, extent));
  if (correction === undefined)
    throw createScrambleError("GENERATION_FAILED", "Invalid cube orientation");
  const colors = new Array(size ** 3 * 7).fill("");
  for (const { p, n, color } of applyAlg(cube, correction)) {
    const position =
      ((p[0] + extent) * size + p[1] + extent) * size + p[2] + extent;
    colors[position * 7 + n[0] + 2 * n[1] + 3 * n[2] + 3] = color;
  }
  return colors.join("");
}
function geometry(size) {
  if (cache.has(size)) return cache.get(size);
  const moves = [];
  for (let width = 1; width <= Math.floor(size / 2); width++)
    for (const [faceIndex, face] of faces.entries()) {
      if (size % 2 === 0 && width === size / 2 && faceIndex >= 3) continue;
      const prefix =
        width === 1 ? face : width === 2 ? `${face}w` : `${width}${face}w`;
      for (const suffix of ["", "2", "'"])
        moves.push({
          token: prefix + suffix,
          axis: faceIndex % 3,
          basis: prefix,
        });
    }
  // Wider blocks are complementary narrower blocks plus a whole-cube rotation;
  // this inventory therefore covers every one-OBTM state modulo orientation.
  const solved = solvedCube(size);
  const shallow = new Set([
    canonical(solved, size),
    ...moves.map(({ token }) => canonical(applyAlg(solved, token), size)),
  ]);
  const result = { moves, shallow };
  cache.set(size, result);
  return result;
}
/** Exact0/1 outer-block-turn exclusion modulo whole-puzzle rotations. */
export function isWithinOneTurn(cube) {
  const size = cubeSize(cube);
  if (![5, 6, 7].includes(size)) throw createScrambleError("UNSUPPORTED_EVENT");
  return geometry(size).shallow.has(canonical(cube, size));
}
/** Test entropy injection is not accepted by worker messages. */
export async function generateBigCube({
  eventId,
  signal,
  randomUint32 = secureUint32,
} = {}) {
  const policy =
    typeof eventId === "string" && Object.hasOwn(policies, eventId)
      ? policies[eventId]
      : null;
  if (!policy) throw createScrambleError("UNSUPPORTED_EVENT");
  checkAbort(signal);
  const { moves } = geometry(policy.size);
  for (;;) {
    let axis = -1;
    const used = new Set(),
      sequence = [];
    for (let count = 0; count < policy.length; count++) {
      checkAbort(signal);
      // Distinct block boundaries on one axis are independent modulo rotation.
      // Repeating a boundary could merge/cancel after commuting adjacent moves.
      const allowed = moves.filter(
        (move) => move.axis !== axis || !used.has(move.basis),
      );
      const move =
        allowed[uniformInteger(allowed.length, randomUint32, signal)];
      if (move.axis !== axis) {
        axis = move.axis;
        used.clear();
      }
      used.add(move.basis);
      sequence.push(move.token);
    }
    const algorithm = sequence.join(" "),
      cube = applyAlg(solvedCube(policy.size), algorithm);
    if (isWithinOneTurn(cube)) continue; // Only the mandated distance exclusion resamples.
    checkAbort(signal);
    return {
      algorithm,
      cube,
      generator: {
        id: `last-layer-${eventId}-random-move`,
        version: "1",
        method: "random-move",
      },
    };
  }
}
