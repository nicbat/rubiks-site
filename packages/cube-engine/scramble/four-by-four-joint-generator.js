// Internal fixed-profile boundary pending qualification; absent from package exports
// and worker registration until release gates are approved.
import { sampleFourByFourState } from "./four-by-four-state.js";
import { isShallowFourByFourState } from "./four-by-four-distance.js";
import { solveFourByFourJoint } from "./four-by-four-joint.js";
import { inverse } from "../core/index.js";
import { validateEventScramble } from "./index.js";
import { checkAbort } from "./random-source.js";

export const FOUR_BY_FOUR_JOINT_GENERATOR = Object.freeze({
  id: "last-layer-444-joint",
  version: "1",
  method: "random-state",
});
export const FOUR_BY_FOUR_JOINT_PROFILE = Object.freeze({
  maxNodes: 10000000,
  finishMaxNodes: 50000000,
  candidateCount: 8,
  perCandidateMaxNodes: 1250000,
  phase2MaxDepth: 16,
  phase3Search: "beam",
  phase3MaxDepth: 32,
  wingPairs: 4,
  beamWidth: 1024,
  maxMoves: 512,
});
/** Uniform physical targets conditioned on exact zero/one-move exclusion.
 * Only excluded shallow targets are redrawn; every solver/resource failure
 * propagates without resampling or falling back to another generator. */
export async function generateFourByFourJoint({ randomUint32, signal } = {}) {
  checkAbort(signal);
  let target;
  do {
    target = sampleFourByFourState({ randomUint32, signal });
  } while (isShallowFourByFourState(target));
  const result = await solveFourByFourJoint(target, {
    ...FOUR_BY_FOUR_JOINT_PROFILE,
    signal,
  });
  checkAbort(signal);
  const algorithm = validateEventScramble("444", inverse(result.algorithm, 4));
  return {
    ...result,
    algorithm,
    target,
    generator: FOUR_BY_FOUR_JOINT_GENERATOR,
  };
}
