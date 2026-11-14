// Original constructive reduction. Internal until length/resource release gates pass.
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  validateFourByFourState,
  sampleFourByFourState,
} from "./four-by-four-state.js";
import { inverse } from "../core/index.js";
import { solveFourByFourCenters } from "./four-by-four-center-solver.js";
import { solveFourByFourWings } from "./four-by-four-wing-solver.js";
import { reduceFourByFourToThree } from "./four-by-four-reduction.js";
import { solveThreeByThree } from "./three-by-three.js";
import { joinFourByFourStages } from "./four-by-four-sequence.js";
import { checkAbort } from "./random-source.js";
import { isShallowFourByFourState } from "./four-by-four-distance.js";
import { validateEventScramble } from "./index.js";
export const FOUR_BY_FOUR_GENERATOR = Object.freeze({
  id: "last-layer-444-constructive",
  version: "1",
  method: "random-state",
});
function parity(values) {
  let p = 0;
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      if (values[i] > values[j]) p ^= 1;
  return p;
}
const length = (algorithm) => (algorithm ? algorithm.split(" ").length : 0);
function validateBudgets(maxNodes, maxMoves) {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1)
    throw new TypeError("An explicit positive maxNodes is required.");
  if (!Number.isSafeInteger(maxMoves) || maxMoves < 1 || maxMoves > 512)
    throw new TypeError("4x4 move budget must be an integer from 1 to 512.");
}
/** Solve this exact target to the fixed solved frame. No sampling or repair of
 * the input. The supplied state is detached before asynchronous table setup.
 * Node budget applies to the 3x3 finish; constructive stages have fixed bounds.
 * A length failure keeps the original target, never replaces it with another.
 */
export async function solveFourByFour(
  value,
  { maxNodes, maxMoves = 512, signal } = {},
) {
  checkAbort(signal);
  let state = validateFourByFourState(value);
  validateBudgets(maxNodes, maxMoves);
  const normalization = [];
  // Outer R toggles corner parity and has even wing parity. An inner right
  // slice toggles wing parity without moving corners. Both are actual moves
  // retained in the solution, not edits to the sampled target coordinates.
  if (parity(state.cornerPermutation)) normalization.push("R");
  if (parity(state.wingPermutation)) normalization.push("Rw", "R'");
  const prefix = normalization.join(" ");
  state = applyFourByFourMoves(state, prefix);
  const centers = solveFourByFourCenters(state, { signal });
  state = applyFourByFourMoves(state, centers.algorithm);
  checkAbort(signal);
  const wings = solveFourByFourWings(state);
  state = applyFourByFourMoves(state, wings.algorithm);
  checkAbort(signal);
  const target = reduceFourByFourToThree(state);
  const finish = await solveThreeByThree(target, { maxNodes });
  checkAbort(signal);
  state = applyFourByFourMoves(state, finish.algorithm);
  const solved = solvedFourByFourState();
  if (
    Object.keys(solved).some((key) =>
      state[key].some((v, i) => v !== solved[key][i]),
    )
  )
    throw Error("4x4 reduction did not reach the exact solved state.");
  const algorithm = joinFourByFourStages([
    prefix,
    centers.algorithm,
    wings.algorithm,
    finish.algorithm,
  ]);
  const moveCount = length(algorithm);
  if (moveCount > maxMoves)
    throw Object.assign(
      new Error(
        "4x4 solution exceeds the move budget; retain the original target.",
      ),
      {
        code: "FOUR_BY_FOUR_LENGTH_LIMIT",
        moveCount,
        maxMoves,
      },
    );
  return {
    algorithm,
    moveCount,
    nodes: finish.nodes,
    stageLengths: [
      length(prefix),
      centers.moveCount,
      wings.moveCount,
      length(finish.algorithm),
    ],
  };
}

/** Internal generator, not registered with the production worker. Only exact
 * zero/one-move states are resampled; all solver/resource failures propagate. */
export async function generateFourByFour({
  randomUint32,
  signal,
  maxNodes = 50000000,
  maxMoves = 512,
} = {}) {
  checkAbort(signal);
  validateBudgets(maxNodes, maxMoves);
  let target;
  do {
    target = sampleFourByFourState({ randomUint32, signal });
  } while (isShallowFourByFourState(target));
  const result = await solveFourByFour(target, { maxNodes, maxMoves, signal });
  checkAbort(signal);
  const algorithm = validateEventScramble("444", inverse(result.algorithm, 4));
  return { ...result, algorithm, target };
}
