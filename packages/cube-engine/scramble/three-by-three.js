// Original implementation of the mathematical two-phase method described at
// https://www.kociemba.org/math/twophase.htm . No solver source was copied.
// Worker-only: lazy table construction and bounded CPU search are substantial.
import {
  solvedCube,
  applyAlg,
  colorAt,
  normals,
  inverse,
} from "../core/index.js";
import { createScrambleError } from "./index.js";
const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const EDGES = [
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
];
const FACES = ["U", "D", "R", "L", "F", "B"];
const MOVES = FACES.flatMap((face) => [face, `${face}2`, `${face}'`]);
const SECOND = [0, 1, 2, 3, 4, 5, 7, 10, 13, 16];
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
export const THREE_BY_THREE_GENERATOR = Object.freeze({
  id: "last-layer-333-two-phase",
  version: "1",
  method: "random-state",
});
let pendingTables;
function fail(message) {
  return createScrambleError("GENERATION_FAILED", message);
}
function aborted(signal) {
  if (signal?.aborted) throw createScrambleError("ABORTED");
}
function cryptoUint32() {
  if (!globalThis.crypto?.getRandomValues)
    throw fail("Secure randomness unavailable");
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
function uniform(limit, randomUint32, signal) {
  const cutoff = Math.floor(2 ** 32 / limit) * limit;
  for (;;) {
    aborted(signal);
    let word;
    try {
      word = randomUint32();
    } catch {
      throw fail("Secure random source failed");
    }
    if (!Number.isInteger(word) || word < 0 || word >= 2 ** 32)
      throw fail("Invalid random uint32");
    if (word < cutoff) return word % limit;
  }
}
function permutation(size, randomUint32, signal) {
  const values = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = uniform(i + 1, randomUint32, signal);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
function parity(values) {
  let bit = 0;
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      if (values[i] > values[j]) bit ^= 1;
  return bit;
}
function sample(randomUint32, signal) {
  const cp = permutation(8, randomUint32, signal),
    ep = permutation(12, randomUint32, signal);
  // Each parity-matched permutation has exactly two equally likely preimages.
  if (parity(cp) !== parity(ep)) [ep[0], ep[1]] = [ep[1], ep[0]];
  const co = Array.from({ length: 7 }, () => uniform(3, randomUint32, signal));
  co.push((3 - (co.reduce((a, b) => a + b, 0) % 3)) % 3);
  const eo = Array.from({ length: 11 }, () => uniform(2, randomUint32, signal));
  eo.push(eo.reduce((a, b) => a ^ b, 0));
  return { cp, co, ep, eo };
}
function rankPermutation(values) {
  let rank = 0;
  for (let i = 0; i < values.length - 1; i++) {
    let smaller = 0;
    for (let j = i + 1; j < values.length; j++)
      if (values[j] < values[i]) smaller++;
    rank += smaller * FACTORIAL[values.length - 1 - i];
  }
  return rank;
}
function decodePermutation(rank, size) {
  const pool = Array.from({ length: size }, (_, i) => i),
    result = [];
  for (let i = size - 1; i >= 0; i--) {
    const digit = Math.floor(rank / FACTORIAL[i]);
    rank %= FACTORIAL[i];
    result.push(pool.splice(digit, 1)[0]);
  }
  return result;
}
function rankOrientation(values, base) {
  let rank = 0;
  for (let i = 0; i < values.length - 1; i++) rank = rank * base + values[i];
  return rank;
}
function decodeOrientation(rank, size, base) {
  const values = new Array(size).fill(0);
  let sum = 0;
  for (let i = size - 2; i >= 0; i--) {
    values[i] = rank % base;
    rank = Math.floor(rank / base);
    sum += values[i];
  }
  values[size - 1] = (base - (sum % base)) % base;
  return values;
}
function fromFacelets(cube) {
  const read = (pieces) => {
    const permutation = [],
      orientation = [];
    for (const faces of pieces) {
      const p = [...faces].reduce(
        (p, face) => p.map((v, i) => v + normals[face][i]),
        [0, 0, 0],
      );
      const colors = [...faces]
        .map((face) => colorAt(cube, p, normals[face]))
        .join("");
      const original = pieces.findIndex((piece) =>
        [...colors].every((face) => piece.includes(face)),
      );
      permutation.push(original);
      orientation.push(
        (faces.length - pieces[original].indexOf(colors[0])) % faces.length,
      );
    }
    return [permutation, orientation];
  };
  const [cp, co] = read(CORNERS),
    [ep, eo] = read(EDGES);
  return { cp, co, ep, eo };
}
function apply(state, move) {
  return {
    cp: move.cp.map((source) => state.cp[source]),
    co: move.cp.map((source, i) => (state.co[source] + move.co[i]) % 3),
    ep: move.ep.map((source) => state.ep[source]),
    eo: move.ep.map((source, i) => (state.eo[source] + move.eo[i]) % 2),
  };
}
const stateKey = (state) => [state.cp, state.co, state.ep, state.eo].join("/");
const SOLVED = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: new Array(8).fill(0),
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: new Array(12).fill(0),
};
// Move effects come from our exact facelet mechanics, independently checked in tests.
function moveDefinitions() {
  return MOVES.map((move) => fromFacelets(applyAlg(solvedCube(), move)));
}

async function pairedDistances(left, right, leftCount, rightCount, width) {
  const count = leftCount * rightCount,
    distances = new Uint8Array(count).fill(255),
    queue = new Uint32Array(count);
  distances[0] = 0;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const state = queue[head],
      a = Math.floor(state / rightCount) * width,
      b = (state % rightCount) * width,
      nextDepth = distances[state] + 1;
    for (let move = 0; move < width; move++) {
      const next = left[a + move] * rightCount + right[b + move];
      if (distances[next] !== 255) continue;
      distances[next] = nextDepth;
      queue[tail++] = next;
    }
    if (head % 131072 === 131071)
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (tail !== count) throw fail("Incomplete 3x3 pruning graph");
  return distances;
}
async function buildTables() {
  const moves = moveDefinitions();
  const masks = [3840];
  for (let mask = 0; mask < 4096; mask++)
    if (mask !== 3840 && mask.toString(2).replaceAll("0", "").length === 4)
      masks.push(mask);
  const maskIndex = new Uint16Array(4096);
  masks.forEach((mask, i) => {
    maskIndex[mask] = i;
  });
  const twist = new Uint16Array(2187 * 18),
    flip = new Uint16Array(2048 * 18),
    slice = new Uint16Array(495 * 18);
  for (let rank = 0; rank < 2187; rank++) {
    const state = decodeOrientation(rank, 8, 3);
    for (let m = 0; m < 18; m++)
      twist[rank * 18 + m] = rankOrientation(
        moves[m].cp.map((source, i) => (state[source] + moves[m].co[i]) % 3),
        3,
      );
  }
  for (let rank = 0; rank < 2048; rank++) {
    const state = decodeOrientation(rank, 12, 2);
    for (let m = 0; m < 18; m++)
      flip[rank * 18 + m] = rankOrientation(
        moves[m].ep.map((source, i) => (state[source] + moves[m].eo[i]) % 2),
        2,
      );
  }
  for (let rank = 0; rank < 495; rank++)
    for (let m = 0; m < 18; m++) {
      let mask = 0;
      for (let i = 0; i < 12; i++)
        if (masks[rank] & (1 << moves[m].ep[i])) mask |= 1 << i;
      slice[rank * 18 + m] = maskIndex[mask];
    }
  const corners = new Uint16Array(40320 * 10),
    edges = new Uint16Array(40320 * 10),
    slicePermutation = new Uint8Array(24 * 10);
  for (let rank = 0; rank < 40320; rank++) {
    const state = decodePermutation(rank, 8);
    for (let m = 0; m < 10; m++) {
      const move = moves[SECOND[m]];
      corners[rank * 10 + m] = rankPermutation(
        move.cp.map((source) => state[source]),
      );
      edges[rank * 10 + m] = rankPermutation(
        move.ep.slice(0, 8).map((source) => state[source]),
      );
    }
    if (rank % 8192 === 8191)
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  for (let rank = 0; rank < 24; rank++) {
    const state = decodePermutation(rank, 4);
    for (let m = 0; m < 10; m++)
      slicePermutation[rank * 10 + m] = rankPermutation(
        moves[SECOND[m]].ep.slice(8).map((source) => state[source - 8]),
      );
  }
  const twistSlice = await pairedDistances(twist, slice, 2187, 495, 18);
  const flipSlice = await pairedDistances(flip, slice, 2048, 495, 18);
  const cornerSlice = await pairedDistances(
    corners,
    slicePermutation,
    40320,
    24,
    10,
  );
  const edgeSlice = await pairedDistances(
    edges,
    slicePermutation,
    40320,
    24,
    10,
  );
  return {
    moves,
    maskIndex,
    twist,
    flip,
    slice,
    corners,
    edges,
    slicePermutation,
    twistSlice,
    flipSlice,
    cornerSlice,
    edgeSlice,
  };
}
function tables() {
  return (pendingTables ||= buildTables().catch((error) => {
    pendingTables = undefined;
    throw error;
  }));
}
function allowed(face, previous) {
  return face !== previous && !(face === (previous ^ 1) && face < previous);
}
function searchCoordinates(
  start,
  first,
  second,
  third,
  pruneFirst,
  pruneSecond,
  thirdCount,
  moves,
  maxDepth,
  budget,
) {
  const width = moves.length,
    path = [];
  function visit(a, b, c, left, previous) {
    budget.nodes++;
    if (budget.nodes > budget.limit)
      throw fail("3x3 search node budget exhausted");
    if ((budget.nodes & 1023) === 0) aborted(budget.signal);
    if (
      pruneFirst[a * thirdCount + c] > left ||
      pruneSecond[b * thirdCount + c] > left
    )
      return false;
    if (left === 0) return a === 0 && b === 0 && c === 0;
    for (let m = 0; m < width; m++) {
      const face = Math.floor(moves[m] / 3);
      if (!allowed(face, previous)) continue;
      path.push(moves[m]);
      if (
        visit(
          first[a * width + m],
          second[b * width + m],
          third[c * width + m],
          left - 1,
          face,
        )
      )
        return true;
      path.pop();
    }
    return false;
  }
  const [a, b, c] = start;
  for (
    let depth = Math.max(
      pruneFirst[a * thirdCount + c],
      pruneSecond[b * thirdCount + c],
    );
    depth <= maxDepth;
    depth++
  )
    if (visit(a, b, c, depth, -1)) return path;
  throw fail("3x3 phase search failed");
}
async function solve(target, { signal, maxNodes = 50000000 } = {}) {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1)
    throw fail("Invalid search node budget");
  aborted(signal);
  const t = await tables();
  aborted(signal);
  const budget = { nodes: 0, limit: maxNodes, signal };
  let mask = 0;
  target.ep.forEach((piece, i) => {
    if (piece >= 8) mask |= 1 << i;
  });
  const first = searchCoordinates(
    [
      rankOrientation(target.co, 3),
      rankOrientation(target.eo, 2),
      t.maskIndex[mask],
    ],
    t.twist,
    t.flip,
    t.slice,
    t.twistSlice,
    t.flipSlice,
    495,
    Array.from({ length: 18 }, (_, i) => i),
    12,
    budget,
  );
  const subgroup = first.reduce(
    (state, move) => apply(state, t.moves[move]),
    target,
  );
  const second = searchCoordinates(
    [
      rankPermutation(subgroup.cp),
      rankPermutation(subgroup.ep.slice(0, 8)),
      rankPermutation(subgroup.ep.slice(8).map((piece) => piece - 8)),
    ],
    t.corners,
    t.edges,
    t.slicePermutation,
    t.cornerSlice,
    t.edgeSlice,
    24,
    SECOND,
    18,
    budget,
  );
  const solution = [...first, ...second];
  if (
    stateKey(
      solution.reduce((state, move) => apply(state, t.moves[move]), target),
    ) !== stateKey(SOLVED)
  )
    throw fail("3x3 solution verification failed");
  return {
    algorithm: solution
      .reverse()
      .map((move) => MOVES[Math.floor(move / 3) * 3 + 2 - (move % 3)])
      .join(" "),
    nodes: budget.nodes,
    phaseLengths: [first.length, second.length],
  };
}

function targetState(value) {
  const fields = [
    ["cornerPermutation", "cp", 8, 8],
    ["cornerOrientation", "co", 8, 3],
    ["edgePermutation", "ep", 12, 12],
    ["edgeOrientation", "eo", 12, 2],
  ];
  if (
    !value ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).length !== fields.length
  )
    throw new TypeError("Invalid 3x3 target fields");
  const state = {};
  for (const [name, key, size, bound] of fields) {
    // Read data properties only and detach before any table-initialization await.
    const values = Object.getOwnPropertyDescriptor(value, name)?.value;
    if (
      !Array.isArray(values) ||
      values.length !== size ||
      Reflect.ownKeys(values).length !== size + 1
    )
      throw new TypeError(`Invalid 3x3 target ${name}`);
    state[key] = Array.from({ length: size }, (_, index) => {
      const item = Object.getOwnPropertyDescriptor(values, index)?.value;
      if (!Number.isInteger(item) || item < 0 || item >= bound)
        throw new TypeError(`Invalid 3x3 target ${name}`);
      return item;
    });
    if ((key === "cp" || key === "ep") && new Set(state[key]).size !== size)
      throw new TypeError(`Invalid 3x3 target ${name}`);
  }
  if (state.co.reduce((sum, value) => sum + value, 0) % 3 !== 0)
    throw new TypeError("Invalid 3x3 corner orientation sum");
  if (state.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0)
    throw new TypeError("Invalid 3x3 edge orientation sum");
  if (parity(state.cp) !== parity(state.ep))
    throw new TypeError("Invalid 3x3 permutation parity");
  return state;
}

/** Solve an exact fixed-center target, not a sampled scramble. Worker-only CPU
 * search: maxNodes excludes bounded table initialization; terminate the worker
 * for mid-search cancellation. Never repair, resample, or mutate the target. */
export async function solveThreeByThree(target, options) {
  const state = targetState(target);
  if (
    !options ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(options)) ||
    Reflect.ownKeys(options).length !== 1 ||
    !Object.hasOwn(options, "maxNodes")
  )
    throw new TypeError("An explicit maxNodes search budget is required");
  const maxNodes = Object.getOwnPropertyDescriptor(options, "maxNodes")?.value;
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1)
    throw fail("Invalid search node budget");
  const result = await solve(state, { maxNodes });
  return { ...result, algorithm: inverse(result.algorithm) };
}

/** Deterministic entropy/search options are test controls, not worker message inputs. */
export async function generateThreeByThree({
  signal,
  randomUint32 = cryptoUint32,
  maxNodes,
} = {}) {
  aborted(signal);
  if (randomUint32 === cryptoUint32 && !globalThis.crypto?.getRandomValues)
    throw fail("Secure randomness unavailable");
  const moves = moveDefinitions(),
    excluded = new Set([stateKey(SOLVED), ...moves.map(stateKey)]);
  let target;
  do {
    target = sample(randomUint32, signal);
  } while (excluded.has(stateKey(target)));
  const solved = await solve(target, { signal, maxNodes });
  aborted(signal);
  return {
    ...solved,
    target: {
      cornerPermutation: [...target.cp],
      cornerOrientation: [...target.co],
      edgePermutation: [...target.ep],
      edgeOrientation: [...target.eo],
    },
  };
}
/** Detached diagnostics, never shared mutable tables. */
export async function threeByThreeDiagnostics() {
  const t = await tables();
  const arrays = Object.values(t).filter((value) => ArrayBuffer.isView(value));
  return {
    retainedBytes: arrays.reduce((sum, array) => sum + array.byteLength, 0),
    largestQueueBytes: 2187 * 495 * 4,
    pruningSizes: [
      t.twistSlice.length,
      t.flipSlice.length,
      t.cornerSlice.length,
      t.edgeSlice.length,
    ],
    pruningMaximums: [
      t.twistSlice,
      t.flipSlice,
      t.cornerSlice,
      t.edgeSlice,
    ].map((array) => array.reduce((max, value) => Math.max(max, value), 0)),
  };
}
