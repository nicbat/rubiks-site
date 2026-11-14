// Original bounded IDA* over center/parity and physical relative-wing states.
import { fourByFourJointCenterContext } from "./four-by-four-joint-centers.js";
import { createFourByFourJointWingSearch } from "./four-by-four-joint-wings.js";
import {
  validateFourByFourState,
  applyFourByFourMoves,
} from "./four-by-four-state.js";
import { analyzeFourByFourJointBoundary } from "./four-by-four-joint-coordinates.js";
import { reduceFourByFourToThree } from "./four-by-four-reduction.js";
import { checkAbort } from "./random-source.js";
const error = (code, message) => Object.assign(new Error(message), { code });
const axes = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
/** Requires a valid joint phase-three boundary. Node budget is caller-owned and
 * cumulative across phases; table initialization is separately fixed/bounded.
 * No replacement state is sampled on any failure. Synchronous work belongs in
 * a worker; terminate that worker for immediate mid-search cancellation.
 */
export function searchFourByFourJointPhase3(
  value,
  { budget, maxDepth = 24, wingPairs = 3, signal } = {},
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
    throw new TypeError(
      "Joint phase3 maxDepth must be an integer from 0 to 32",
    );
  if (wingPairs !== 3 && wingPairs !== 4)
    throw new TypeError("Wing pattern size must be 3 or 4");
  const state = validateFourByFourState(value);
  if (!analyzeFourByFourJointBoundary(state).eligible)
    throw new TypeError("Joint phase3 requires an eligible phase2 boundary");
  const centers = fourByFourJointCenterContext(signal),
    wings = createFourByFourJointWingSearch({ signal, pairs: wingPairs });
  const root = centers.coordinate(state),
    relative = wings.coordinate(state),
    moves = wings.moves;
  const faces = moves.map((move) => move.replace(/[2']$/, "")),
    axis = moves.map((move) => axes[move[0]]);
  const buffers = Array.from(
    { length: maxDepth + 1 },
    () => new Uint8Array(12),
  );
  buffers[0].set(relative);
  const path = [],
    started = budget.nodes;
  const lowerBound = (center, wing) =>
    Math.max(centers.distance(center), wings.heuristic(wing));
  function visit(center, remaining, depth, previous) {
    if ((budget.nodes & 1023) === 0) checkAbort(signal);
    const wing = buffers[depth];
    if (budget.nodes >= budget.maxNodes)
      throw error(
        "JOINT_PHASE3_SEARCH_LIMIT",
        "Joint phase3 exhausted shared node budget; retain target",
      );
    budget.nodes++;
    if (center === centers.goal && wing.every((v, i) => v === i)) return true;
    if (remaining === 0) return false;
    for (let m = 0; m < moves.length; m++) {
      // Same block merges; adjacent turns around one axis commute exactly. Keep
      // one canonical order, without pruning distinct axes or intervening turns.
      if (
        previous >= 0 &&
        (faces[m] === faces[previous] ||
          (axis[m] === axis[previous] && faces[m] < faces[previous]))
      )
        continue;
      const next = centers.move(center, m);
      if (centers.distance(next) > remaining - 1) continue;
      wings.moveInto(wing, m, buffers[depth + 1]);
      if (wings.heuristic(buffers[depth + 1]) > remaining - 1) continue;
      path.push(m);
      if (visit(next, remaining - 1, depth + 1, m)) return true;
      path.pop();
    }
    return false;
  }
  for (let depth = lowerBound(root, relative); depth <= maxDepth; depth++) {
    if (!visit(root, depth, 0, -1)) continue;
    checkAbort(signal);
    const algorithm = path.map((m) => moves[m]).join(" "),
      result = applyFourByFourMoves(state, algorithm);
    const target = reduceFourByFourToThree(result); // Strict parity/orientation check.
    if (
      centers.coordinate(result) !== centers.goal ||
      wings.coordinate(result).some((v, i) => v !== i)
    )
      throw Error("Joint phase3 result violated search goal");
    return {
      algorithm,
      state: result,
      target,
      moveCount: path.length,
      nodes: budget.nodes - started,
    };
  }
  throw error(
    "JOINT_PHASE3_DEPTH_LIMIT",
    "Joint phase3 exhausted depth budget; retain target",
  );
}
