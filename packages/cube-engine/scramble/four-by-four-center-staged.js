import { groupFourByFourOppositeCenters } from "./four-by-four-centers.js";
import { groupFourByFourSecondCenters } from "./four-by-four-center-phase2.js";
import { finishFourByFourCenters } from "./four-by-four-center-phase3.js";
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { joinFourByFourStages } from "./four-by-four-sequence.js";
import { checkAbort } from "./random-source.js";
/** Three exact center coordinates. Phase two also establishes even wing parity.
 * Phase one has at most twice C(24,8) expanded coordinates; later stages use
 * finite exhaustive tables. Run synchronous initialization/search in a worker. */
export function solveFourByFourCentersStaged(value, { signal } = {}) {
  checkAbort(signal);
  let state = validateFourByFourState(value);
  const first = groupFourByFourOppositeCenters(state, {
    pair: "UD",
    maxNodes: 2 * 735471,
  });
  state = applyFourByFourMoves(state, first.algorithm);
  checkAbort(signal);
  const second = groupFourByFourSecondCenters(state, {
    signal,
    requireEvenWings: true,
  });
  state = applyFourByFourMoves(state, second.algorithm);
  const third = finishFourByFourCenters(state, { signal });
  state = applyFourByFourMoves(state, third.algorithm);
  const solved = solvedFourByFourState();
  if (state.centerColors.some((color, i) => color !== solved.centerColors[i]))
    throw Error("Staged center solution failed its postcondition.");
  const stages = [first.algorithm, second.algorithm, third.algorithm];
  const algorithm = joinFourByFourStages(stages);
  return {
    algorithm,
    moveCount: algorithm ? algorithm.split(" ").length : 0,
    stageLengths: stages.map((stage) => (stage ? stage.split(" ").length : 0)),
    nodes: first.nodes,
  };
}
