// Original constructive wing stage. A pure commutator cycles three wings;
// conjugation routes it to every ordered triple without moving any other piece.
// Internal reduction boundary, not a complete 4x4 scramble generator.
import { inverse } from "../core/index.js";
import { createScrambleError } from "./index.js";
import {
  FOUR_BY_FOUR_MOVES,
  solvedFourByFourState,
  validateFourByFourState,
  applyFourByFourMoves,
  fourByFourCenterMovePermutation,
} from "./four-by-four-state.js";
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
/** Requires solved center colors and an even wing permutation. The orchestrator
 * must normalize odd wing parity before solving centers; this stage never repairs
 * or resamples a target. Corners and labeled centers are preserved exactly. */
export function solveFourByFourWings(state, { maxMoves = 512 } = {}) {
  const current = validateFourByFourState(state),
    solved = solvedFourByFourState();
  if (!Number.isSafeInteger(maxMoves) || maxMoves < 1 || maxMoves > 512)
    throw new TypeError("Wing move budget must be an integer from 1 to 512");
  if (current.centerColors.some((color, i) => color !== solved.centerColors[i]))
    throw new TypeError("Solve centers before solving wings");
  if (parity(current.wingPermutation))
    throw new TypeError("Normalize odd wing parity before solving centers");
  const table = routes(),
    permutation = [...current.wingPermutation],
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
  if (output.length > maxMoves) throw fail("Wing move budget exhausted");
  const algorithm = output
    .map(
      ({ face, turns }) =>
        `${face}${turns === 1 ? "" : turns === 2 ? "2" : "'"}`,
    )
    .join(" ");
  const result = applyFourByFourMoves(current, algorithm);
  if (
    result.wingPermutation.some((v, i) => v !== i) ||
    result.centerColors.some((v, i) => v !== current.centerColors[i]) ||
    result.cornerPermutation.some(
      (v, i) => v !== current.cornerPermutation[i],
    ) ||
    result.cornerOrientation.some((v, i) => v !== current.cornerOrientation[i])
  )
    throw fail("Wing solution verification failed");
  return { algorithm, cycles, moveCount: output.length };
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
