// Original admissible three-pair pattern database for joint phase-three search.
// Fixed subsets of a relative permutation are NOT closed under left/right action.
// Track both physical endpoints instead: each move independently permutes their
// A/B positions. Dropping all other pairs and centers gives an exact relaxation.
import {
  FOUR_BY_FOUR_JOINT_MOVE_METADATA,
  FOUR_BY_FOUR_PHASE3_MOVES,
  FOUR_BY_FOUR_PHASE3_WING_ORBITS,
  analyzeFourByFourJointBoundary,
} from "./four-by-four-joint-coordinates.js";
import {
  FOUR_BY_FOUR_COORDINATES,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { checkAbort } from "./random-source.js";
const identity = (faces) => [...faces].sort().join("");
const wingIds = FOUR_BY_FOUR_COORDINATES.wings.map((wing) =>
  identity(wing.faces),
);
const orbitA = FOUR_BY_FOUR_PHASE3_WING_ORBITS[0];
// Align both local position orders so a geometrically paired state is r[i]=i.
const orbitB = Object.freeze(
  orbitA.map((slot) => {
    const mate = FOUR_BY_FOUR_PHASE3_WING_ORBITS[1].find(
      (other) => wingIds[other] === wingIds[slot],
    );
    if (mate === undefined) throw Error("Missing paired phase-three wing slot");
    return mate;
  }),
);
const moves = FOUR_BY_FOUR_PHASE3_MOVES;
const pA = new Uint8Array(moves.length * 12),
  qA = new Uint8Array(moves.length * 12),
  qB = new Uint8Array(moves.length * 12);
for (let m = 0; m < moves.length; m++) {
  const effect = FOUR_BY_FOUR_JOINT_MOVE_METADATA.find(
    (entry) => entry.move === moves[m],
  ).wings;
  for (let destination = 0; destination < 12; destination++) {
    const a = orbitA.indexOf(effect[orbitA[destination]]),
      b = orbitB.indexOf(effect[orbitB[destination]]);
    if (a < 0 || b < 0) throw Error("Move leaves a phase-three wing orbit");
    pA[m * 12 + destination] = a;
    qA[m * 12 + a] = destination;
    qB[m * 12 + b] = destination;
  }
}
const PARTIALS = 12 * 11 * 10,
  COORDINATES = PARTIALS ** 2;
function rank3(a, b, c) {
  return a * 110 + (b - Number(b > a)) * 10 + c - Number(c > a) - Number(c > b);
}
function unrank3(rank) {
  const a = Math.floor(rank / 110);
  let b = Math.floor((rank % 110) / 10),
    c = rank % 10;
  if (b >= a) b++;
  if (c >= Math.min(a, b)) c++;
  if (c >= Math.max(a, b)) c++;
  return [a, b, c];
}
let table;
function initialize(signal) {
  checkAbort(signal);
  if (table) return table;
  const transitionA = new Uint16Array(PARTIALS * moves.length),
    transitionB = new Uint16Array(PARTIALS * moves.length);
  for (let rank = 0; rank < PARTIALS; rank++) {
    const [a, b, c] = unrank3(rank);
    for (let m = 0; m < moves.length; m++) {
      const offset = m * 12;
      transitionA[rank * moves.length + m] = rank3(
        qA[offset + a],
        qA[offset + b],
        qA[offset + c],
      );
      transitionB[rank * moves.length + m] = rank3(
        qB[offset + a],
        qB[offset + b],
        qB[offset + c],
      );
    }
  }
  const distance = new Uint8Array(COORDINATES).fill(255),
    queue = new Uint32Array(COORDINATES);
  let count = 0,
    maximumDistance = 0;
  // Any placement of the three paired edge identities is a valid relaxed goal.
  for (let rank = 0; rank < PARTIALS; rank++) {
    const index = rank * PARTIALS + rank;
    distance[index] = 0;
    queue[count++] = index;
  }
  for (let head = 0; head < count; head++) {
    if ((head & 1023) === 0) checkAbort(signal);
    const index = queue[head],
      a = Math.floor(index / PARTIALS) * moves.length,
      b = (index % PARTIALS) * moves.length;
    const nextDistance = distance[index] + 1;
    for (let m = 0; m < moves.length; m++) {
      const next = transitionA[a + m] * PARTIALS + transitionB[b + m];
      if (distance[next] !== 255) continue;
      distance[next] = nextDistance;
      maximumDistance = Math.max(maximumDistance, nextDistance);
      queue[count++] = next;
    }
  }
  if (count !== COORDINATES)
    throw Error("Incomplete joint wing pattern database");
  checkAbort(signal);
  table = { distance, maximumDistance, count };
  return table;
}
function validateRelative(relative) {
  if (
    (!Array.isArray(relative) && !(relative instanceof Uint8Array)) ||
    relative.length !== 12
  )
    throw new TypeError("Expected twelve relative wing positions");
  let seen = 0,
    parity = 0;
  for (let i = 0; i < 12; i++) {
    const value = relative[i];
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value >= 12 ||
      seen & (1 << value)
    )
      throw new TypeError("Invalid relative wing permutation");
    seen |= 1 << value;
    for (let j = 0; j < i; j++) if (relative[j] > value) parity ^= 1;
  }
  if (parity) throw new TypeError("Relative wing permutation must be even");
}
/** Relative r[A slot]=B slot containing the matching edge identity. No center
 * conditions are imposed here; joint search must validate its center boundary. */
export function relativeFourByFourWings(state) {
  const valid = validateFourByFourState(state),
    analysis = analyzeFourByFourJointBoundary(valid);
  if (
    !analysis.orbitIdentityBalance ||
    !analysis.evenWingPermutation ||
    !analysis.evenHandedness
  )
    throw new TypeError(
      "Phase-three wings require balanced orbits, even permutation and even handedness",
    );
  const positions = new Map(
    orbitB.map((slot, index) => [wingIds[valid.wingPermutation[slot]], index]),
  );
  const relative = Uint8Array.from(orbitA, (slot) =>
    positions.get(wingIds[valid.wingPermutation[slot]]),
  );
  validateRelative(relative);
  return relative;
}
function moveInto(relative, moveIndex, output) {
  if (relative === output)
    throw new TypeError("Relative wing output must use a separate buffer");
  const offset = moveIndex * 12;
  for (let i = 0; i < 12; i++)
    output[i] = qB[offset + relative[pA[offset + i]]];
  return output;
}
export function moveFourByFourRelativeWings(relative, moveIndex) {
  validateRelative(relative);
  if (
    !Number.isInteger(moveIndex) ||
    moveIndex < 0 ||
    moveIndex >= moves.length
  )
    throw new TypeError("Invalid phase-three move index");
  return moveInto(relative, moveIndex, new Uint8Array(12));
}
const patterns = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
].map(([a, b, c]) => [a, b, c, rank3(a, b, c) * PARTIALS]);
function lowerBound(relative, distance) {
  let result = 0;
  for (let p = 0; p < patterns.length; p++) {
    const [a, b, c, offset] = patterns[p];
    result = Math.max(
      result,
      distance[offset + rank3(relative[a], relative[b], relative[c])],
    );
  }
  return result;
}
export function fourByFourWingPairingHeuristic(relative, { signal } = {}) {
  validateRelative(relative);
  return lowerBound(relative, initialize(signal).distance);
}
/** Validate once through coordinate(). The hot methods require a valid even
 * Uint8Array(12), a move index in 0..19 and distinct Uint8Array(12) output. They
 * allocate no arrays, retain no caller buffers and expose no mutable tables. */
export function createFourByFourJointWingSearch({ signal } = {}) {
  const { distance } = initialize(signal);
  return Object.freeze({
    moves,
    orbitA,
    orbitB,
    coordinate: relativeFourByFourWings,
    moveInto,
    heuristic: (relative) => lowerBound(relative, distance),
  });
}
export function fourByFourJointWingDiagnostics({ signal } = {}) {
  const t = initialize(signal);
  return {
    partialCoordinates: PARTIALS,
    coordinates: t.count,
    goalCoordinates: PARTIALS,
    maximumDistance: t.maximumDistance,
    retainedBytes:
      t.distance.byteLength + pA.byteLength + qA.byteLength + qB.byteLength,
    queueBytes: COORDINATES * 4,
    transitionBytes: PARTIALS * moves.length * 2 * 2,
  };
}
