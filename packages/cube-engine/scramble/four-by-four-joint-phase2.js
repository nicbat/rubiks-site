// Original bounded joint phase-two search. The center product is an admissible
// projection; actual wing placement is retained and checked at eligible leaves.
import {
  FOUR_BY_FOUR_COORDINATES,
  validateFourByFourState,
  applyFourByFourMoves,
} from "./four-by-four-state.js";
import { FOUR_BY_FOUR_CENTER_PHASE2_MOVES } from "./four-by-four-center-phase2.js";
import {
  FOUR_BY_FOUR_PHASE3_UD_MASKS,
  FOUR_BY_FOUR_PHASE3_WING_ORBITS,
  FOUR_BY_FOUR_JOINT_MOVE_METADATA,
  analyzeFourByFourJointBoundary,
} from "./four-by-four-joint-coordinates.js";
import { checkAbort } from "./random-source.js";
const moves = FOUR_BY_FOUR_CENTER_PHASE2_MOVES;
const moveBases = moves.map((move) => move.replace(/[2']$/, ""));
const orbitA = FOUR_BY_FOUR_PHASE3_WING_ORBITS[0];
const orbitB = new Set(FOUR_BY_FOUR_PHASE3_WING_ORBITS[1]);
const identityNames = FOUR_BY_FOUR_COORDINATES.wings.map((wing) =>
  [...wing.faces].sort().join(""),
);
const uniqueIdentities = [...new Set(identityNames)];
const identityBits = identityNames.map(
  (name) => 1 << uniqueIdentities.indexOf(name),
);
const handednessBits = identityNames.map((_, wing) => Number(orbitB.has(wing)));
/** Internal trusted predicate: input must already be a validated permutation of
 * 0..23. Checks only orbit balance/handedness, not centers or full wing parity.
 * Each identity occurs twice, so one identity in every A slot proves B balance. */
export function fourByFourJointPhase2WingBoundary(wings) {
  let identities = 0,
    handedness = 0;
  for (const slot of orbitA) {
    const wing = wings[slot];
    identities |= identityBits[wing];
    handedness ^= handednessBits[wing];
  }
  return identities === 4095 && handedness === 0;
}
const count = 12870 * 70 * 2;
const centerSlots = FOUR_BY_FOUR_COORDINATES.centers;
const inside = centerSlots.flatMap((s, i) =>
  ["U", "D"].includes(s.faces[0]) ? [i] : [],
);
const outside = centerSlots.flatMap((s, i) =>
  ["U", "D"].includes(s.faces[0]) ? [] : [i],
);
const bits = (n) => {
  let count = 0;
  for (; n; n &= n - 1) count++;
  return count;
};
const parity = (p) => {
  let bit = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) bit ^= 1;
  return bit;
};
const fail = (code, message) => Object.assign(new Error(message), { code });
let table;
function initialize(signal) {
  checkAbort(signal);
  if (table) return table;
  const metadata = moves.map((move) =>
    FOUR_BY_FOUR_JOINT_MOVE_METADATA.find((entry) => entry.move === move),
  );
  const masks16 = [],
    ranks16 = new Uint16Array(65536).fill(65535),
    masks8 = [],
    ranks8 = new Uint8Array(256).fill(255);
  for (let mask = 0; mask < 65536; mask++)
    if (bits(mask) === 8) {
      ranks16[mask] = masks16.length;
      masks16.push(mask);
    }
  for (let mask = 0; mask < 256; mask++)
    if (bits(mask) === 4) {
      ranks8[mask] = masks8.length;
      masks8.push(mask);
    }
  const makeTransitions = (indices, masks, ranks, Type) => {
    const result = new Type(masks.length * moves.length);
    metadata.forEach((entry, m) => {
      const local = indices.map((destination) =>
        indices.indexOf(entry.centers[destination]),
      );
      if (local.includes(-1))
        throw Error("Joint phase2 move violates UD grouping");
      masks.forEach((mask, rank) => {
        let next = 0;
        local.forEach((source, destination) => {
          if (mask & (1 << source)) next |= 1 << destination;
        });
        result[rank * moves.length + m] = ranks[next];
      });
    });
    return result;
  };
  const rlMoves = makeTransitions(outside, masks16, ranks16, Uint16Array),
    udMoves = makeTransitions(inside, masks8, ranks8, Uint8Array);
  const parityMoves = Uint8Array.from(metadata, (entry) => parity(entry.wings));
  const rlGoal =
    ranks16[
      outside.reduce(
        (mask, slot, i) =>
          mask | (["R", "L"].includes(centerSlots[slot].faces[0]) ? 1 << i : 0),
        0,
      )
    ];
  const distance = new Uint8Array(count).fill(255),
    queue = new Uint32Array(count);
  let tail = 0,
    maxDistance = 0;
  for (const mask of FOUR_BY_FOUR_PHASE3_UD_MASKS) {
    const goal = (rlGoal * 70 + ranks8[mask]) * 2;
    distance[goal] = 0;
    queue[tail++] = goal;
  }
  const next = (coordinate, m) => {
    const parity = coordinate & 1,
      product = coordinate >>> 1,
      ud = product % 70,
      rl = Math.floor(product / 70);
    return (
      (rlMoves[rl * moves.length + m] * 70 + udMoves[ud * moves.length + m]) *
        2 +
      (parity ^ parityMoves[m])
    );
  };
  for (let head = 0; head < tail; head++) {
    if ((head & 1023) === 0) checkAbort(signal);
    const current = queue[head];
    for (let m = 0; m < moves.length; m++) {
      const child = next(current, m);
      if (distance[child] !== 255) continue;
      distance[child] = distance[current] + 1;
      maxDistance = Math.max(maxDistance, distance[child]);
      queue[tail++] = child;
    }
  }
  checkAbort(signal);
  table = {
    metadata,
    ranks16,
    ranks8,
    rlMoves,
    udMoves,
    parityMoves,
    distance,
    next,
    maxDistance,
    reached: tail,
  };
  return table;
}
function coordinate(state, t) {
  if (
    state.centerColors.some(
      (color, i) => inside.includes(i) !== (color === 0 || color === 3),
    )
  )
    throw new TypeError("Joint phase2 requires grouped UD centers");
  let rl = 0,
    u = 0;
  outside.forEach((slot, i) => {
    if ([1, 4].includes(state.centerColors[slot])) rl |= 1 << i;
  });
  inside.forEach((slot, i) => {
    if (state.centerColors[slot] === 0) u |= 1 << i;
  });
  return (t.ranks16[rl] * 70 + t.ranks8[u]) * 2 + parity(state.wingPermutation);
}
/** Finite IDA* search; shared budget counts expanded nodes across caller stages.
 * Every returned candidate passes the actual full-state phase-three boundary.
 * Budget exhaustion throws; targets are never resampled or silently repaired.
 */
export function searchFourByFourJointPhase2(
  value,
  { budget, maxDepth = 16, maxCandidates = 8, signal } = {},
) {
  checkAbort(signal);
  if (
    !budget ||
    !Number.isSafeInteger(budget.nodes) ||
    budget.nodes < 0 ||
    !Number.isSafeInteger(budget.maxNodes) ||
    budget.maxNodes < 1 ||
    budget.nodes > budget.maxNodes
  )
    throw new TypeError("Explicit shared node budget required");
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > 32 ||
    !Number.isInteger(maxCandidates) ||
    maxCandidates < 1 ||
    maxCandidates > 32
  )
    throw new TypeError("Invalid bounded search options");
  const state = validateFourByFourState(value);
  if (
    state.centerColors.some(
      (color, i) => inside.includes(i) !== (color === 0 || color === 3),
    )
  )
    throw new TypeError("Joint phase2 requires grouped UD centers");
  const t = initialize(signal),
    root = coordinate(state, t),
    started = budget.nodes;
  if (t.distance[root] === 255)
    throw fail(
      "JOINT_PHASE2_UNREACHABLE",
      "Center projection is outside phase2 goal component",
    );
  const candidates = [],
    seen = new Set(),
    path = [];
  const wingStack = Array.from(
    { length: maxDepth + 1 },
    () => new Uint8Array(24),
  );
  wingStack[0].set(state.wingPermutation);
  function visit(coord, remaining, depth, previous) {
    if ((budget.nodes & 1023) === 0) checkAbort(signal);
    if (t.distance[coord] > remaining) return false;
    if (budget.nodes >= budget.maxNodes)
      throw fail(
        "JOINT_PHASE2_SEARCH_LIMIT",
        "Joint phase2 exhausted shared node budget; retain target",
      );
    budget.nodes++;
    if (remaining === 0) {
      if (t.distance[coord] !== 0) return false;
      if (!fourByFourJointPhase2WingBoundary(wingStack[depth])) return false;
      const algorithm = path.map((m) => moves[m]).join(" "),
        endpoint = applyFourByFourMoves(state, algorithm);
      // Check actual wings propagated through every node, independently of center projection.
      if (endpoint.wingPermutation.some((v, i) => v !== wingStack[depth][i]))
        throw Error("Joint phase2 wing propagation invariant failed");
      if (!analyzeFourByFourJointBoundary(endpoint).eligible) return false;
      const key =
        endpoint.centerColors.join(",") +
        "|" +
        endpoint.wingPermutation.join(",") +
        "|" +
        endpoint.cornerPermutation.join(",") +
        "|" +
        endpoint.cornerOrientation.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ algorithm, state: endpoint, moveCount: depth });
      }
      return candidates.length >= maxCandidates;
    }
    for (let m = 0; m < moves.length; m++) {
      const face = moveBases[m];
      if (face === previous) continue;
      const next = t.next(coord, m);
      if (t.distance[next] > remaining - 1) continue;
      const permutation = t.metadata[m].wings;
      for (let i = 0; i < 24; i++)
        wingStack[depth + 1][i] = wingStack[depth][permutation[i]];
      path.push(m);
      const done = visit(next, remaining - 1, depth + 1, face);
      path.pop();
      if (done) return true;
    }
    return false;
  }
  let depth = t.distance[root];
  for (; depth <= maxDepth; depth++) if (visit(root, depth, 0, null)) break;
  checkAbort(signal);
  return {
    candidates,
    nodes: budget.nodes - started,
    complete: candidates.length === maxCandidates,
    stopReason: candidates.length === maxCandidates ? "count" : "depth",
  };
}
export function fourByFourJointPhase2Diagnostics({ signal } = {}) {
  const t = initialize(signal);
  return {
    coordinates: count,
    reached: t.reached,
    maximumDistance: t.maxDistance,
    retainedTypedBytes:
      t.distance.byteLength +
      t.rlMoves.byteLength +
      t.udMoves.byteLength +
      t.parityMoves.byteLength +
      t.ranks16.byteLength +
      t.ranks8.byteLength,
    queueBytes: count * 4,
  };
}
