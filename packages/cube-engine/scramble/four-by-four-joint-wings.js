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
export function fourByFourWingPairingHeuristic(
  relative,
  { signal, pairs = 3 } = {},
) {
  validateRelative(relative);
  const selected = selectTable(pairs, signal);
  return selected.bound(relative, selected.table.distance);
}
/** Validate once through coordinate(). The hot methods require a valid even
 * Uint8Array(12), a move index in 0..19 and distinct Uint8Array(12) output. They
 * allocate no arrays, retain no caller buffers and expose no mutable tables. */
export function createFourByFourJointWingSearch({ signal, pairs = 3 } = {}) {
  const selected = selectTable(pairs, signal);
  const { distance } = selected.table;
  return Object.freeze({
    moves,
    orbitA,
    orbitB,
    coordinate: relativeFourByFourWings,
    moveInto,
    heuristic: (relative) => selected.bound(relative, distance),
  });
}
export function fourByFourJointWingDiagnostics({ signal, pairs = 3 } = {}) {
  const { table: t } = selectTable(pairs, signal);
  if (pairs === 4)
    return {
      partialCoordinates: PARTIALS4,
      coordinates: t.count,
      goalCoordinates: 495,
      maximumDistance: t.maximumDistance,
      retainedBytes:
        t.distance.byteLength +
        pA.byteLength +
        qA.byteLength +
        qB.byteLength +
        masks4.byteLength,
      queueBytes: COORDINATES4 * 4,
      transitionBytes: PARTIALS4 * (20 + 24) * 2 + 495 * 20 * 3,
    };
  return {
    partialCoordinates: PARTIALS,
    coordinates: t.count,
    goalCoordinates: PARTIALS,
    maximumDistance: t.maximumDistance,
    retainedBytes:
      t.distance.byteLength +
      pA.byteLength +
      qA.byteLength +
      qB.byteLength +
      masks4.byteLength,
    queueBytes: COORDINATES * 4,
    transitionBytes: PARTIALS * moves.length * 2 * 2,
  };
}

// Quotient simultaneous relabeling of four tracked identities: sort A endpoints,
// and carry their partners through the same permutation. Each orbit has one
// canonical representative; this preserves both transitions and paired goals.
const PARTIALS4 = 12 * 11 * 10 * 9,
  COORDINATES4 = 495 * PARTIALS4;
const masks4 = new Int16Array(4096).fill(-1),
  combinations4 = [];
for (let a = 0; a < 9; a++)
  for (let b = a + 1; b < 10; b++)
    for (let c = b + 1; c < 11; c++)
      for (let d = c + 1; d < 12; d++) {
        masks4[(1 << a) | (1 << b) | (1 << c) | (1 << d)] =
          combinations4.length;
        combinations4.push([a, b, c, d]);
      }
function rank4(a, b, c, d) {
  return rank3(a, b, c) * 9 + d - Number(d > a) - Number(d > b) - Number(d > c);
}
let table4;
function initialize4(signal) {
  checkAbort(signal);
  if (table4) return table4;
  const tuples = [],
    permutations = [];
  for (let a = 0; a < 12; a++)
    for (let b = 0; b < 12; b++)
      if (b !== a)
        for (let c = 0; c < 12; c++)
          if (c !== a && c !== b)
            for (let d = 0; d < 12; d++)
              if (d !== a && d !== b && d !== c)
                tuples[rank4(a, b, c, d)] = [a, b, c, d];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++)
      if (b !== a)
        for (let c = 0; c < 4; c++)
          if (c !== a && c !== b) permutations.push([a, b, c, 6 - a - b - c]);
  const reorder = new Uint16Array(PARTIALS4 * 24),
    moveB = new Uint16Array(PARTIALS4 * 20);
  for (let rank = 0; rank < PARTIALS4; rank++) {
    const t = tuples[rank];
    for (let p = 0; p < 24; p++) {
      const order = permutations[p];
      reorder[p * PARTIALS4 + rank] = rank4(
        t[order[0]],
        t[order[1]],
        t[order[2]],
        t[order[3]],
      );
    }
    for (let m = 0; m < 20; m++) {
      const o = m * 12;
      moveB[rank * 20 + m] = rank4(
        qB[o + t[0]],
        qB[o + t[1]],
        qB[o + t[2]],
        qB[o + t[3]],
      );
    }
  }
  const moveA = new Uint16Array(495 * 20),
    orders = new Uint8Array(495 * 20);
  for (let a = 0; a < 495; a++)
    for (let m = 0; m < 20; m++) {
      const t = combinations4[a].map((v) => qA[m * 12 + v]),
        order = [0, 1, 2, 3].sort((i, j) => t[i] - t[j]);
      moveA[a * 20 + m] = masks4[t.reduce((mask, v) => mask | (1 << v), 0)];
      orders[a * 20 + m] = permutations.findIndex((p) =>
        p.every((v, i) => v === order[i]),
      );
    }
  const distance = new Uint8Array(COORDINATES4).fill(255),
    queue = new Uint32Array(COORDINATES4);
  let count = 0,
    maximumDistance = 0;
  for (let a = 0; a < 495; a++) {
    const index = a * PARTIALS4 + rank4(...combinations4[a]);
    distance[index] = 0;
    queue[count++] = index;
  }
  for (let head = 0; head < count; head++) {
    if ((head & 1023) === 0) checkAbort(signal);
    const index = queue[head],
      a = Math.floor(index / PARTIALS4) * 20,
      b = (index % PARTIALS4) * 20,
      nextDistance = distance[index] + 1;
    for (let m = 0; m < 20; m++) {
      const next =
        moveA[a + m] * PARTIALS4 +
        reorder[orders[a + m] * PARTIALS4 + moveB[b + m]];
      if (distance[next] !== 255) continue;
      distance[next] = nextDistance;
      maximumDistance = Math.max(maximumDistance, nextDistance);
      queue[count++] = next;
    }
  }
  if (count !== COORDINATES4)
    throw Error("Incomplete four-pair wing pattern database");
  checkAbort(signal);
  table4 = { distance, count, maximumDistance };
  return table4;
}
// Each original three-pair pattern is contained in one of these four patterns,
// so this maximum dominates the original bound without retaining both tables.
const patterns4 = [
  [0, 1, 2, 3],
  [3, 4, 5, 6],
  [6, 7, 8, 9],
  [0, 9, 10, 11],
].map((t) => [
  ...t,
  masks4[t.reduce((mask, v) => mask | (1 << v), 0)] * PARTIALS4,
]);
function lowerBound4(relative, distance) {
  let result = 0;
  for (let p = 0; p < patterns4.length; p++) {
    const [a, b, c, d, offset] = patterns4[p];
    result = Math.max(
      result,
      distance[
        offset + rank4(relative[a], relative[b], relative[c], relative[d])
      ],
    );
  }
  return result;
}
function selectTable(pairs, signal) {
  if (pairs === 3) return { table: initialize(signal), bound: lowerBound };
  if (pairs === 4) return { table: initialize4(signal), bound: lowerBound4 };
  throw new TypeError("Wing pattern size must be 3 or 4");
}
