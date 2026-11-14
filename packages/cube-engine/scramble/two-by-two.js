// Original exhaustive 2x2 solver. R/U/F fix DBL, giving one representative of
// each state modulo whole-cube rotation: 7! permutations × 3^6 orientations.
// Targets the distribution/minimum-distance rules at:
// https://www.worldcubeassociation.org/regulations/#4b3b
// This is not WCA-approved competition software.
// Initialization belongs in a worker: async API does not make its CPU work free.
import { solvedCube, applyAlg, colorAt, normals } from "../core/index.js";
import { createScrambleError } from "./index.js";

const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const FREE = [0, 1, 2, 3, 4, 5, 7];
const MOVES = ["R", "R2", "R'", "U", "U2", "U'", "F", "F2", "F'"];
export const TWO_BY_TWO_GENERATOR = Object.freeze({
  id: "last-layer-222-fixed-dbl",
  version: "1",
  method: "random-state",
});
const ORIENTATIONS = 729;
const PERMUTATIONS = 5040;
export const TWO_BY_TWO_STATE_COUNT = PERMUTATIONS * ORIENTATIONS;
const factorial = [1, 1, 2, 6, 24, 120, 720, 5040];
let pendingTables;

function decodePermutation(rank) {
  const pool = [0, 1, 2, 3, 4, 5, 6],
    result = [];
  for (let left = 6; left >= 0; left--) {
    const digit = Math.floor(rank / factorial[left]);
    rank %= factorial[left];
    result.push(pool.splice(digit, 1)[0]);
  }
  return result;
}
function rankPermutation(permutation) {
  let rank = 0;
  for (let i = 0; i < 6; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 7; j++)
      if (permutation[j] < permutation[i]) smaller++;
    rank += smaller * factorial[6 - i];
  }
  return rank;
}
function decodeOrientation(rank) {
  const result = new Array(7).fill(0);
  let sum = 0;
  for (let i = 5; i >= 0; i--) {
    result[i] = rank % 3;
    rank = Math.floor(rank / 3);
    sum += result[i];
  }
  result[6] = (3 - (sum % 3)) % 3;
  return result;
}
function rankOrientation(values) {
  let rank = 0;
  for (let i = 0; i < 6; i++) rank = rank * 3 + values[i];
  return rank;
}
function moveCorners(move) {
  const cube = applyAlg(solvedCube(2), move);
  const permutation = [],
    orientation = [];
  for (const index of FREE) {
    const faces = CORNERS[index];
    const position = [...faces].reduce(
      (p, face) => p.map((v, i) => v + normals[face][i] / 2),
      [0, 0, 0],
    );
    const colors = [...faces]
      .map((face) => colorAt(cube, position, normals[face]))
      .join("");
    const original = CORNERS.findIndex((corner) =>
      [...colors].every((face) => corner.includes(face)),
    );
    permutation.push(FREE.indexOf(original));
    orientation.push((3 - CORNERS[original].indexOf(colors[0])) % 3);
  }
  return { permutation, orientation };
}
async function buildTables() {
  const moveData = MOVES.map(moveCorners);
  const permutationMoves = new Uint16Array(PERMUTATIONS * 9);
  const orientationMoves = new Uint16Array(ORIENTATIONS * 9);
  for (let rank = 0; rank < PERMUTATIONS; rank++) {
    const state = decodePermutation(rank);
    for (let move = 0; move < 9; move++)
      permutationMoves[rank * 9 + move] = rankPermutation(
        moveData[move].permutation.map((source) => state[source]),
      );
  }
  for (let rank = 0; rank < ORIENTATIONS; rank++) {
    const state = decodeOrientation(rank);
    for (let move = 0; move < 9; move++)
      orientationMoves[rank * 9 + move] = rankOrientation(
        moveData[move].permutation.map(
          (source, i) => (state[source] + moveData[move].orientation[i]) % 3,
        ),
      );
  }
  const distances = new Uint8Array(TWO_BY_TWO_STATE_COUNT).fill(255);
  const queue = new Uint32Array(TWO_BY_TWO_STATE_COUNT);
  const histogram = [1];
  distances[0] = 0;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const state = queue[head];
    const permutation = Math.floor(state / ORIENTATIONS) * 9;
    const orientation = (state % ORIENTATIONS) * 9;
    const distance = distances[state] + 1;
    for (let move = 0; move < 9; move++) {
      const next =
        permutationMoves[permutation + move] * ORIENTATIONS +
        orientationMoves[orientation + move];
      if (distances[next] !== 255) continue;
      distances[next] = distance;
      histogram[distance] = (histogram[distance] || 0) + 1;
      queue[tail++] = next;
    }
    // Let cancellation messages reach a hosting worker while sharing one build.
    if (head % 131072 === 131071)
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (tail !== TWO_BY_TWO_STATE_COUNT)
    throw createScrambleError(
      "GENERATION_FAILED",
      "Incomplete 2x2 state graph",
    );
  return { permutationMoves, orientationMoves, distances, histogram };
}
function tables() {
  return (pendingTables ||= buildTables().catch((error) => {
    pendingTables = undefined;
    throw error;
  }));
}
function checkAbort(signal) {
  if (signal?.aborted) throw createScrambleError("ABORTED");
}
function cryptoUint32() {
  if (!globalThis.crypto?.getRandomValues)
    throw createScrambleError(
      "GENERATION_FAILED",
      "Secure randomness unavailable",
    );
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
function uniformRank(randomUint32, signal) {
  const limit =
    Math.floor(2 ** 32 / TWO_BY_TWO_STATE_COUNT) * TWO_BY_TWO_STATE_COUNT;
  while (true) {
    checkAbort(signal);
    let value;
    try {
      value = randomUint32();
    } catch (error) {
      throw createScrambleError(
        "GENERATION_FAILED",
        "Secure random source failed",
      );
    }
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** 32)
      throw createScrambleError("GENERATION_FAILED", "Invalid random uint32");
    if (value < limit) return value % TWO_BY_TWO_STATE_COUNT;
  }
}
function targetAt(index) {
  const freePermutation = decodePermutation(Math.floor(index / ORIENTATIONS));
  const freeOrientation = decodeOrientation(index % ORIENTATIONS);
  const permutation = [0, 1, 2, 3, 4, 5, 6, 7],
    orientation = new Array(8).fill(0);
  for (const [i, position] of FREE.entries()) {
    permutation[position] = FREE[freePermutation[i]];
    orientation[position] = freeOrientation[i];
  }
  return { permutation, orientation };
}

/** Internal provider for worker integration. randomUint32 is for deterministic tests only. */
export async function generateTwoByTwo({
  signal,
  randomUint32 = cryptoUint32,
} = {}) {
  checkAbort(signal);
  // Fail before expensive initialization if secure randomness is unavailable.
  if (randomUint32 === cryptoUint32 && !globalThis.crypto?.getRandomValues)
    throw createScrambleError(
      "GENERATION_FAILED",
      "Secure randomness unavailable",
    );
  const { permutationMoves, orientationMoves, distances } = await tables();
  checkAbort(signal);
  let target;
  do {
    target = uniformRank(randomUint32, signal);
  } while (distances[target] < 4);
  let state = target;
  const solution = [];
  while (distances[state]) {
    checkAbort(signal);
    const permutation = Math.floor(state / ORIENTATIONS) * 9,
      orientation = (state % ORIENTATIONS) * 9;
    let found = false;
    for (let move = 0; move < 9; move++) {
      const next =
        permutationMoves[permutation + move] * ORIENTATIONS +
        orientationMoves[orientation + move];
      if (distances[next] !== distances[state] - 1) continue;
      solution.push(move);
      state = next;
      found = true;
      break;
    }
    if (!found)
      throw createScrambleError(
        "GENERATION_FAILED",
        "2x2 distance descent failed",
      );
  }
  return {
    algorithm: solution
      .reverse()
      .map((move) => MOVES[Math.floor(move / 3) * 3 + (2 - (move % 3))])
      .join(" "),
    targetIndex: target,
    target: targetAt(target),
    distance: distances[target],
  };
}

/** Detached diagnostics: never expose the shared solver tables. */
export async function twoByTwoDiagnostics() {
  const { permutationMoves, orientationMoves, distances, histogram } =
    await tables();
  return {
    stateCount: TWO_BY_TWO_STATE_COUNT,
    histogram: [...histogram],
    retainedBytes:
      permutationMoves.byteLength +
      orientationMoves.byteLength +
      distances.byteLength,
    initializationQueueBytes: TWO_BY_TWO_STATE_COUNT * 4,
  };
}
