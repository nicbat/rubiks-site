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
 * Only current/next layers survive: at most beamWidth*20 candidates with 12-byte
 * relative permutations and at most beamWidth paths of length32 per layer.
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
  let layer = [
    {
      center: centers.coordinate(state),
      relative: wings.coordinate(state),
      path: [],
      last: -1,
    },
  ];
  const scratch = new Uint8Array(12);
  for (let depth = 0; depth <= maxDepth; depth++) {
    checkAbort(signal);
    for (const node of layer)
      if (
        node.center === centers.goal &&
        node.relative.every((v, i) => v === i)
      ) {
        const algorithm = node.path.map((i) => moves[i]).join(" "),
          endpoint = applyFourByFourMoves(state, algorithm),
          target = reduceFourByFourToThree(endpoint);
        return {
          algorithm,
          state: endpoint,
          target,
          moveCount: node.path.length,
          nodes: budget.nodes - initialNodes,
          expandedParents,
        };
      }
    if (depth === maxDepth) break;
    const next = new Map();
    for (let parentIndex = 0; parentIndex < layer.length; parentIndex++) {
      const parent = layer[parentIndex];
      expandedParents++;
      for (let move = 0; move < moves.length; move++) {
        if (parent.last >= 0 && bases[parent.last] === bases[move]) continue;
        if (budget.nodes >= budget.maxNodes)
          throw failure(
            "JOINT_PHASE3_SEARCH_LIMIT",
            "Joint beam generated-child budget exhausted",
            budget,
          );
        budget.nodes++;
        if ((budget.nodes & 4095) === 0) checkAbort(signal);
        const center = centers.move(parent.center, move);
        wings.moveInto(parent.relative, move, scratch);
        // Accept a generated goal immediately: a later sibling exhausting the
        // budget must not discard an already verified solution.
        if (center === centers.goal && scratch.every((v, i) => v === i)) {
          const path = [...parent.path, move];
          const algorithm = path.map((i) => moves[i]).join(" ");
          const endpoint = applyFourByFourMoves(state, algorithm);
          const target = reduceFourByFourToThree(endpoint);
          return {
            algorithm,
            state: endpoint,
            target,
            moveCount: path.length,
            nodes: budget.nodes - initialNodes,
            expandedParents,
          };
        }
        // Exact key: decimal center plus twelve distinct character-encoded entries.
        const key = center + ":" + String.fromCharCode(...scratch);
        if (next.has(key)) continue;
        const a = centers.distance(center),
          b = wings.heuristic(scratch);
        next.set(key, {
          center,
          relative: scratch.slice(),
          parentIndex,
          move,
          max: Math.max(a, b),
          sum: a + b,
        });
      }
    }
    const ranked = Array.from(next.values());
    ranked.sort((a, b) => a.max - b.max || a.sum - b.sum);
    // Store only parent indices while building candidates; discard ancestor layers.
    layer = ranked.slice(0, beamWidth).map((node) => ({
      center: node.center,
      relative: node.relative,
      path: [...layer[node.parentIndex].path, node.move],
      last: node.move,
    }));
  }
  throw failure(
    "JOINT_PHASE3_DEPTH_LIMIT",
    "Incomplete joint beam exhausted its depth bound",
    budget,
  );
}
