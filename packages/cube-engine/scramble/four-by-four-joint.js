// Experimental joint reduction, deliberately separate from the registered generator.
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { groupFourByFourOppositeCenters } from "./four-by-four-centers.js";
import { searchFourByFourJointPhase2 } from "./four-by-four-joint-phase2.js";
import { searchFourByFourJointPhase3 } from "./four-by-four-joint-phase3.js";
import { reduceFourByFourToThree } from "./four-by-four-reduction.js";
import { solveThreeByThree } from "./three-by-three.js";
import { joinFourByFourStages } from "./four-by-four-sequence.js";
import { checkAbort } from "./random-source.js";
const length = (s) => (s ? s.split(" ").length : 0);
/** Exact target experiment. Joint stages share maxNodes; the 3x3 finish has a
 * separate explicit budget. Failure retains the target without a fallback or
 * another sample. Phase one retains its fixed finite coordinate-search bound. */
export async function solveFourByFourJoint(
  value,
  { maxNodes, finishMaxNodes, maxMoves = 512, signal } = {},
) {
  checkAbort(signal);
  for (const n of [maxNodes, finishMaxNodes])
    if (!Number.isSafeInteger(n) || n < 1)
      throw new TypeError(
        "Explicit positive joint and finish node budgets required.",
      );
  if (!Number.isSafeInteger(maxMoves) || maxMoves < 1 || maxMoves > 512)
    throw new TypeError("Move budget must be from 1 to 512.");
  let state = validateFourByFourState(value);
  const first = groupFourByFourOppositeCenters(state, {
    pair: "UD",
    maxNodes: 2 * 735471,
  });
  state = applyFourByFourMoves(state, first.algorithm);
  checkAbort(signal);
  const budget = { nodes: 0, maxNodes };
  const second = searchFourByFourJointPhase2(state, {
    budget,
    maxCandidates: 1,
    signal,
  });
  if (!second.candidates.length)
    throw Object.assign(new Error("Joint phase2 depth limit; retain target."), {
      code: "JOINT_PHASE2_DEPTH_LIMIT",
    });
  const candidate = second.candidates[0];
  const third = searchFourByFourJointPhase3(candidate.state, {
    budget,
    signal,
  });
  state = applyFourByFourMoves(candidate.state, third.algorithm);
  const finish = await solveThreeByThree(reduceFourByFourToThree(state), {
    maxNodes: finishMaxNodes,
  });
  checkAbort(signal);
  state = applyFourByFourMoves(state, finish.algorithm);
  const solved = solvedFourByFourState();
  if (
    Object.keys(solved).some((key) =>
      solved[key].some((v, i) => state[key][i] !== v),
    )
  )
    throw Error("Joint reduction failed exact solved-state postcondition.");
  const stages = [
    first.algorithm,
    candidate.algorithm,
    third.algorithm,
    finish.algorithm,
  ];
  const algorithm = joinFourByFourStages(stages),
    moveCount = length(algorithm);
  if (moveCount > maxMoves)
    throw Object.assign(
      new Error("Joint solution exceeds move budget; retain target."),
      { code: "FOUR_BY_FOUR_LENGTH_LIMIT", moveCount, maxMoves },
    );
  return {
    algorithm,
    moveCount,
    stageLengths: stages.map(length),
    nodes: budget.nodes,
    finishNodes: finish.nodes,
  };
}
