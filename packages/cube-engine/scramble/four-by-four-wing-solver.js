// Original constructive wing stage. A pure commutator cycles three wings;
// conjugation routes it to every ordered triple without moving any other piece.
// Internal reduction boundary, not a complete 4x4 scramble generator.
import { inverse } from "../core/index.js";
import { createScrambleError } from "./index.js";
import {
  FOUR_BY_FOUR_MOVES,
  FOUR_BY_FOUR_COORDINATES,
  solvedFourByFourState,
  validateFourByFourState,
  applyFourByFourMoves,
  fourByFourCenterMovePermutation,
} from "./four-by-four-state.js";
import { THREE_BY_THREE_COORDINATES } from "./three-by-three.js";
import { reduceFourByFourToThree } from "./four-by-four-reduction.js";
const BASE = "Uw U' R U Uw' L Uw U' R' U Uw' L'";
const TRIPLE = [6, 8, 23];
const SLOTS = 24,
  CAPACITY = SLOTS ** 3,
  TRIPLES = 24 * 23 * 22;
const key = ([a, b, c]) => (a * SLOTS + b) * SLOTS + c;
const decode = (index) => [
  Math.floor(index / 576),
  Math.floor(index / 24) % 24,
  index % 24,
];
const fail = (message) => createScrambleError("GENERATION_FAILED", message);
let routing;
function parity(values) {
  let bit = 0;
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      if (values[i] > values[j]) bit ^= 1;
  return bit;
}
function routes() {
  if (routing) return routing;
  const solved = solvedFourByFourState(),
    effect = applyFourByFourMoves(solved, BASE);
  // Check the stronger labeled-center identity, not just solved visible colors.
  let centers = Array.from({ length: 24 }, (_, i) => i);
  for (const move of BASE.split(" "))
    centers = fourByFourCenterMovePermutation(move).map((i) => centers[i]);
  const expected = Array.from({ length: 24 }, (_, i) => i);
  TRIPLE.forEach((slot, i) => (expected[slot] = TRIPLE[(i + 1) % 3]));
  if (
    centers.some((v, i) => v !== i) ||
    effect.cornerPermutation.some((v, i) => v !== i) ||
    effect.cornerOrientation.some(Boolean) ||
    effect.wingPermutation.some((v, i) => v !== expected[i])
  )
    throw fail("Invalid pure wing-cycle construction");
  const moves = FOUR_BY_FOUR_MOVES.map((move) => {
    const permutation = applyFourByFourMoves(solved, move).wingPermutation;
    const positions = new Uint8Array(24);
    permutation.forEach(
      (source, destination) => (positions[source] = destination),
    );
    return positions;
  });
  const parent = new Int16Array(CAPACITY).fill(-1),
    via = new Uint8Array(CAPACITY),
    depth = new Uint8Array(CAPACITY);
  const queue = new Uint16Array(TRIPLES);
  const root = key(TRIPLE);
  parent[root] = root;
  queue[0] = root;
  let count = 1,
    maximumDepth = 0;
  for (let head = 0; head < count; head++) {
    const previous = queue[head],
      triple = decode(previous);
    for (let m = 0; m < moves.length; m++) {
      const next = key(triple.map((i) => moves[m][i]));
      if (parent[next] !== -1) continue;
      if (count === TRIPLES)
        throw fail("Wing routing exceeded its fixed bound");
      parent[next] = previous;
      via[next] = m;
      depth[next] = depth[previous] + 1;
      maximumDepth = Math.max(maximumDepth, depth[next]);
      queue[count++] = next;
    }
  }
  if (count !== TRIPLES) throw fail("Incomplete wing-cycle routing");
  routing = { parent, via, root, count, maximumDepth };
  return routing;
}
function cycleAlgorithm(triple, table) {
  let index = key(triple);
  const setup = [];
  while (index !== table.root) {
    setup.push(FOUR_BY_FOUR_MOVES[table.via[index]]);
    index = table.parent[index];
  }
  setup.reverse();
  const forward = setup.join(" ");
  return [inverse(forward, 4), BASE, forward].filter(Boolean).join(" ");
}
function appendReduced(output, algorithm) {
  for (const token of algorithm.split(" ")) {
    const face = token.replace(/[2']$/, ""),
      turns = token.endsWith("2") ? 2 : token.endsWith("'") ? 3 : 1;
    const previous = output.at(-1);
    if (previous?.face === face) {
      previous.turns = (previous.turns + turns) % 4;
      if (!previous.turns) output.pop();
    } else output.push({ face, turns });
  }
}
function prepared(state, maxMoves) {
  const current = validateFourByFourState(state),
    solved = solvedFourByFourState();
  if (!Number.isSafeInteger(maxMoves) || maxMoves < 1 || maxMoves > 512)
    throw new TypeError("Wing move budget must be an integer from 1 to 512");
  if (current.centerColors.some((color, i) => color !== solved.centerColors[i]))
    throw new TypeError("Solve centers before solving wings");
  if (parity(current.wingPermutation))
    throw new TypeError("Normalize odd wing parity before solving centers");
  return current;
}
function plan(current, goal, table) {
  // Relabel pieces by the chosen goal, reducing any even relative permutation
  // with the identical constructive cycle algorithm used by the baseline.
  const locations = new Uint8Array(24);
  goal.forEach((piece, slot) => (locations[piece] = slot));
  const permutation = current.wingPermutation.map((piece) => locations[piece]),
    output = [];
  let cycles = 0;
  for (;;) {
    const a = permutation.findIndex((piece, slot) => piece !== slot);
    if (a === -1) break;
    const b = permutation.indexOf(a);
    let c = permutation.indexOf(b);
    if (c === a)
      c = permutation.findIndex(
        (piece, slot) => slot !== a && slot !== b && piece !== slot,
      );
    if (c === -1 || ++cycles > 22) throw fail("Wing cycle bound exhausted");
    appendReduced(output, cycleAlgorithm([a, b, c], table));
    [permutation[a], permutation[b], permutation[c]] = [
      permutation[b],
      permutation[c],
      permutation[a],
    ];
  }
  const algorithm = output
    .map(
      ({ face, turns }) =>
        `${face}${turns === 1 ? "" : turns === 2 ? "2" : "'"}`,
    )
    .join(" ");
  return { algorithm, cycles, moveCount: output.length };
}
function verified(current, goal, result, maxMoves) {
  if (result.moveCount > maxMoves) throw fail("Wing move budget exhausted");
  const after = applyFourByFourMoves(current, result.algorithm);
  if (
    after.wingPermutation.some((v, i) => v !== goal[i]) ||
    after.centerColors.some((v, i) => v !== current.centerColors[i]) ||
    after.cornerPermutation.some(
      (v, i) => v !== current.cornerPermutation[i],
    ) ||
    after.cornerOrientation.some((v, i) => v !== current.cornerOrientation[i])
  )
    throw fail("Wing solution verification failed");
  return after;
}
/** Requires solved center colors and an even wing permutation. The orchestrator
 * must normalize odd wing parity before solving centers; this stage never repairs
 * or resamples a target. Corners and labeled centers are preserved exactly. */
export function solveFourByFourWings(state, { maxMoves = 512 } = {}) {
  const current = prepared(state, maxMoves),
    goal = solvedFourByFourState().wingPermutation;
  const result = plan(current, goal, routes());
  verified(current, goal, result, maxMoves);
  return result;
}

const edgeNames = THREE_BY_THREE_COORDINATES.edges;
const wings = FOUR_BY_FOUR_COORDINATES.wings;
const edgeIdentity = (faces) => [...faces].sort().join("");
const edgeSlots = edgeNames.map((edge) =>
  wings.flatMap((slot, index) =>
    edgeIdentity(slot.faces) === edgeIdentity(edge) ? [index] : [],
  ),
);
// For each destination/source/flip choice, map BOTH ordered sticker colors.
// Unordered matching alone would permit crossed wings and illegal reductions.
const assignments = edgeNames.map((edge, destination) =>
  edgeNames.map((source) =>
    [0, 1].map((flip) =>
      edgeSlots[destination].map((slot) => {
        const colors = wings[slot].faces
          .map((face) => source[(edge.indexOf(face) + flip) % 2])
          .join("");
        const piece = wings.findIndex((wing) => wing.faces.join("") === colors);
        if (piece < 0) throw Error("Incompatible paired-wing coordinates");
        return piece;
      }),
    ),
  ),
);
const popcount = new Uint8Array(1 << 12);
for (let mask = 1; mask < popcount.length; mask++)
  popcount[mask] = popcount[mask >> 1] + (mask & 1);
function pairedGoal(permutation, orientation) {
  const goal = new Array(24);
  permutation.forEach((piece, destination) =>
    edgeSlots[destination].forEach((slot, side) => {
      goal[slot] =
        assignments[destination][piece][orientation[destination]][side];
    }),
  );
  return goal;
}
function assignmentGoal(current, cornerParity, variation) {
  // Bounded 2^12 * 2 permutation parities * 2 flip parities assignment DP.
  // Primary cost preserves as many currently correct wings as possible. Eight
  // fixed integer tie-break portfolios give alternative goals, never new targets.
  const costs = new Uint32Array((1 << 12) * 4).fill(0xffffffff);
  const choices = new Uint8Array(costs.length).fill(255);
  const placement = edgeNames.map((_, destination) =>
    edgeNames.map((__, piece) =>
      [0, 1].map((flip) => {
        const mismatch = edgeSlots[destination].reduce(
          (sum, slot, side) =>
            sum +
            Number(
              current.wingPermutation[slot] !==
                assignments[destination][piece][flip][side],
            ),
          0,
        );
        const tie =
          variation === 0
            ? 0
            : ((Math.imul(destination + 1, 73856093) ^
                Math.imul(piece + 1, 19349663) ^
                Math.imul(flip + 1, 83492791) ^
                Math.imul(variation, 2654435761)) >>>
                ((variation * 3) % 16)) &
              255;
        return mismatch * 4096 + tie;
      }),
    ),
  );
  costs[0] = 0;
  for (let mask = 0; mask < 4095; mask++) {
    const destination = popcount[mask];
    for (let bits = 0; bits < 4; bits++) {
      const previous = costs[mask * 4 + bits];
      if (previous === 0xffffffff) continue;
      for (let piece = 0; piece < 12; piece++) {
        if (mask & (1 << piece)) continue;
        const nextMask = mask | (1 << piece),
          inversion = popcount[mask >>> (piece + 1)] & 1;
        for (let flip = 0; flip < 2; flip++) {
          const next = nextMask * 4 + (bits ^ (inversion * 2) ^ flip);
          const cost = previous + placement[destination][piece][flip];
          if (cost < costs[next]) {
            costs[next] = cost;
            choices[next] = piece * 2 + flip;
          }
        }
      }
    }
  }
  let mask = 4095,
    bits = cornerParity * 2;
  const permutation = new Array(12),
    orientation = new Array(12);
  while (mask) {
    const choice = choices[mask * 4 + bits];
    if (choice === 255) throw fail("No legal paired-wing assignment");
    const piece = choice >> 1,
      flip = choice & 1,
      destination = popcount[mask] - 1;
    permutation[destination] = piece;
    orientation[destination] = flip;
    mask ^= 1 << piece;
    bits ^= ((popcount[mask >>> (piece + 1)] & 1) * 2) ^ flip;
  }
  return pairedGoal(permutation, orientation);
}
/** Pair wings into a legal 3x3 target, preserving the exact corners and centers.
 * Requires even wing parity; unlike the identity stage, odd corner parity is
 * supported by selecting an odd reduced edge permutation. */
export function pairFourByFourWings(state, { maxMoves = 512 } = {}) {
  const current = prepared(state, maxMoves);
  try {
    reduceFourByFourToThree(current);
    return { algorithm: "", cycles: 0, moveCount: 0 };
  } catch (error) {
    if (
      ![
        "WINGS_UNPAIRED",
        "EDGE_FLIP_PARITY",
        "PERMUTATION_PARITY",
        "BOTH_PARITIES",
      ].includes(error.code)
    )
      throw error;
  }
  const cornerParity = parity(current.cornerPermutation),
    edgePermutation = Array.from({ length: 12 }, (_, i) => i);
  if (cornerParity) [edgePermutation[0], edgePermutation[1]] = [1, 0];
  const table = routes();
  let goal = pairedGoal(edgePermutation, new Array(12).fill(0));
  let best = plan(current, goal, table);
  for (let variation = 0; variation < 8; variation++) {
    const candidateGoal = assignmentGoal(current, cornerParity, variation);
    const candidate = plan(current, candidateGoal, table);
    if (candidate.moveCount < best.moveCount) {
      best = candidate;
      goal = candidateGoal;
    }
  }
  const after = verified(current, goal, best, maxMoves);
  reduceFourByFourToThree(after);
  return best;
}
export function fourByFourWingDiagnostics() {
  const table = routes();
  return {
    reachableTriples: table.count,
    maximumSetupDepth: table.maximumDepth,
    retainedBytes: table.parent.byteLength + table.via.byteLength,
    queueBytes: TRIPLES * 2,
  };
}
