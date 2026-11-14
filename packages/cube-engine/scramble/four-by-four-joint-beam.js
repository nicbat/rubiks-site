// Original incomplete, bounded beam search. Failure never changes the target.
import { fourByFourJointCenterContext } from "./four-by-four-joint-centers.js";
import { createFourByFourJointWingSearch } from "./four-by-four-joint-wings.js";
import {
  validateFourByFourState,
  applyFourByFourMoves,
} from "./four-by-four-state.js";
import { analyzeFourByFourJointBoundary } from "./four-by-four-joint-coordinates.js";
import { reduceFourByFourToThree } from "./four-by-four-reduction.js";
import { checkAbort } from "./random-source.js";
const failure = (code, message, budget) =>
  Object.assign(new Error(message), { code, nodes: budget.nodes });
/** Budget counts generated children (including duplicates), not expanded parents.
 * Fixed typed arrays hold current/next layers and at most beamWidth*20 candidates.
 * Exact packed keys and collision-checked hashing avoid per-child allocations.
 * Synchronous worker-only search; worker termination handles mid-call cancellation.
 */
export function searchFourByFourJointBeam(
  value,
  { budget, maxDepth = 32, beamWidth = 1024, wingPairs = 4, signal } = {},
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
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 32)
    throw new TypeError("Beam maxDepth must be an integer from 0 to 32");
  if (!Number.isInteger(beamWidth) || beamWidth < 1 || beamWidth > 4096)
    throw new TypeError("Beam width must be an integer from 1 to 4096");
  if (wingPairs !== 3 && wingPairs !== 4)
    throw new TypeError("Wing pattern size must be 3 or 4");
  const state = validateFourByFourState(value);
  if (!analyzeFourByFourJointBoundary(state).eligible)
    throw new TypeError("Joint beam requires an eligible phase2 boundary");
  const centers = fourByFourJointCenterContext(signal),
    wings = createFourByFourJointWingSearch({ signal, pairs: wingPairs });
  const moves = wings.moves,
    bases = moves.map((move) => move.replace(/[2']/g, ""));
  const initialNodes = budget.nodes;
  let expandedParents = 0;
  const layout = fourByFourJointBeamWorkspace(beamWidth, maxDepth),
    capacity = layout.candidateCapacity;
  const candidateCenter = new Uint32Array(capacity),
    candidateKey = new Float64Array(capacity),
    candidateParent = new Uint16Array(capacity),
    candidateMove = new Uint8Array(capacity),
    candidateMax = new Uint8Array(capacity),
    candidateSum = new Uint8Array(capacity),
    ranked = new Uint32Array(capacity),
    hash = new Uint32Array(layout.hashCapacity),
    visitedCenter = new Uint32Array(layout.visitedCapacity),
    visitedKey = new Float64Array(layout.visitedCapacity);
  const visitSlot = (center, key) => {
    let slot = keyHash(center, key) & (layout.visitedCapacity - 1);
    while (
      visitedCenter[slot] !== 0 &&
      (visitedCenter[slot] !== center + 1 || visitedKey[slot] !== key)
    )
      slot = (slot + 1) & (layout.visitedCapacity - 1);
    return slot;
  };
  const makeLayer = () => ({
    center: new Uint32Array(beamWidth),
    relative: new Uint8Array(beamWidth * 12),
    path: new Uint8Array(beamWidth * 32),
    last: new Int8Array(beamWidth),
  });
  let layer = makeLayer(),
    nextLayer = makeLayer(),
    layerCount = 1;
  layer.center[0] = centers.coordinate(state);
  layer.relative.set(wings.coordinate(state));
  layer.last[0] = -1;
  let rootKey = 0;
  for (let j = 0; j < 12; j++) rootKey = rootKey * 16 + layer.relative[j];
  const rootSlot = visitSlot(layer.center[0], rootKey);
  visitedCenter[rootSlot] = layer.center[0] + 1;
  visitedKey[rootSlot] = rootKey;
  const parentRelative = new Uint8Array(12),
    scratch = new Uint8Array(12);
  const finish = (parent, depth, move = -1) => {
    const path = [];
    for (let i = 0; i < depth; i++)
      path.push(moves[layer.path[parent * 32 + i]]);
    if (move >= 0) path.push(moves[move]);
    const algorithm = path.join(" "),
      endpoint = applyFourByFourMoves(state, algorithm),
      target = reduceFourByFourToThree(endpoint);
    return {
      algorithm,
      state: endpoint,
      target,
      moveCount: path.length,
      nodes: budget.nodes - initialNodes,
      expandedParents,
    };
  };
  for (let depth = 0; depth <= maxDepth; depth++) {
    checkAbort(signal);
    for (let i = 0; i < layerCount; i++) {
      let paired = true;
      for (let j = 0; j < 12; j++)
        if (layer.relative[i * 12 + j] !== j) {
          paired = false;
          break;
        }
      if (layer.center[i] === centers.goal && paired) return finish(i, depth);
    }
    if (depth === maxDepth) break;
    // Hash slots contain candidate index+1. Clearing each layer prevents stale
    // references when candidate slots are reused; exact keys resolve collisions.
    hash.fill(0);
    let count = 0;
    for (let parent = 0; parent < layerCount; parent++) {
      expandedParents++;
      for (let j = 0; j < 12; j++)
        parentRelative[j] = layer.relative[parent * 12 + j];
      for (let move = 0; move < moves.length; move++) {
        if (
          layer.last[parent] >= 0 &&
          bases[layer.last[parent]] === bases[move]
        )
          continue;
        if (budget.nodes >= budget.maxNodes)
          throw failure(
            "JOINT_PHASE3_SEARCH_LIMIT",
            "Joint beam generated-child budget exhausted",
            budget,
          );
        budget.nodes++;
        if ((budget.nodes & 4095) === 0) checkAbort(signal);
        const center = centers.move(layer.center[parent], move);
        wings.moveInto(parentRelative, move, scratch);
        let key = 0,
          paired = true;
        for (let j = 0; j < 12; j++) {
          key = key * 16 + scratch[j];
          if (scratch[j] !== j) paired = false;
        }
        if (center === centers.goal && paired)
          return finish(parent, depth, move);
        if (visitedCenter[visitSlot(center, key)] !== 0) continue;
        // Twelve four-bit entries fit exactly in a Number's 53-bit significand.
        // Hashing may collide; equality always compares all 48 bits and center.
        let slot =
          (Math.imul((key >>> 0) ^ Math.floor(key / 4294967296), 0x9e3779b1) ^
            Math.imul(center, 0x85ebca6b)) &
          (hash.length - 1);
        while (hash[slot] !== 0) {
          const index = hash[slot] - 1;
          if (candidateCenter[index] === center && candidateKey[index] === key)
            break;
          slot = (slot + 1) & (hash.length - 1);
        }
        if (hash[slot] !== 0) continue;
        hash[slot] = count + 1;
        const a = centers.distance(center),
          b = wings.heuristic(scratch);
        candidateCenter[count] = center;
        candidateKey[count] = key;
        candidateParent[count] = parent;
        candidateMove[count] = move;
        candidateMax[count] = Math.max(a, b);
        candidateSum[count] = a + b;
        ranked[count] = count;
        count++;
      }
    }
    const order = ranked.subarray(0, count);
    order.sort(
      (a, b) =>
        candidateMax[a] - candidateMax[b] ||
        candidateSum[a] - candidateSum[b] ||
        a - b,
    );
    const nextCount = Math.min(count, beamWidth);
    for (let i = 0; i < nextCount; i++) {
      const index = order[i],
        parent = candidateParent[index];
      nextLayer.center[i] = candidateCenter[index];
      const selectedSlot = visitSlot(
        candidateCenter[index],
        candidateKey[index],
      );
      visitedCenter[selectedSlot] = candidateCenter[index] + 1;
      visitedKey[selectedSlot] = candidateKey[index];
      nextLayer.last[i] = candidateMove[index];
      let key = candidateKey[index];
      for (let j = 11; j >= 0; j--) {
        nextLayer.relative[i * 12 + j] = key % 16;
        key = Math.floor(key / 16);
      }
      for (let j = 0; j < depth; j++)
        nextLayer.path[i * 32 + j] = layer.path[parent * 32 + j];
      nextLayer.path[i * 32 + depth] = candidateMove[index];
    }
    const previous = layer;
    layer = nextLayer;
    nextLayer = previous;
    layerCount = nextCount;
  }
  throw failure(
    "JOINT_PHASE3_DEPTH_LIMIT",
    "Incomplete joint beam exhausted its depth bound",
    budget,
  );
}

/** Exact typed-array search workspace; excludes shared heuristic tables, small
 * metadata/closures and transient sort implementation storage. */
export function fourByFourJointBeamWorkspace(beamWidth = 1024, maxDepth = 32) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 32)
    throw new TypeError("Beam maxDepth must be an integer from 0 to 32");
  if (!Number.isInteger(beamWidth) || beamWidth < 1 || beamWidth > 4096)
    throw new TypeError("Beam width must be an integer from 1 to 4096");
  const candidateCapacity = beamWidth * 20;
  let hashCapacity = 1;
  while (hashCapacity < candidateCapacity * 2) hashCapacity *= 2;
  const visitedEntries = 1 + maxDepth * beamWidth;
  let visitedCapacity = 1;
  while (visitedCapacity < visitedEntries * 2) visitedCapacity *= 2;
  const visitedBytes = visitedCapacity * 12;
  const layerBytes = beamWidth * 98,
    candidateBytes = candidateCapacity * 21,
    hashBytes = hashCapacity * 4,
    scratchBytes = 24;
  return {
    beamWidth,
    candidateCapacity,
    hashCapacity,
    visitedEntries,
    visitedCapacity,
    visitedBytes,
    layerBytes,
    candidateBytes,
    hashBytes,
    scratchBytes,
    typedWorkspaceBytes:
      layerBytes + candidateBytes + hashBytes + scratchBytes + visitedBytes,
  };
}

function keyHash(center, key) {
  return (
    Math.imul((key >>> 0) ^ Math.floor(key / 4294967296), 0x9e3779b1) ^
    Math.imul(center, 0x85ebca6b)
  );
}
