import type { FourByFourState } from "./four-by-four-state.js";
import type { solveFourByFourJoint } from "./four-by-four-joint.js";
export const FOUR_BY_FOUR_JOINT_GENERATOR: Readonly<{
  id: "last-layer-444-joint";
  version: "1";
  method: "random-state";
}>;
export const FOUR_BY_FOUR_JOINT_PROFILE: Readonly<{
  maxNodes: 10000000;
  finishMaxNodes: 50000000;
  candidateCount: 8;
  perCandidateMaxNodes: 1250000;
  phase2MaxDepth: 16;
  phase3Search: "beam";
  phase3MaxDepth: 32;
  wingPairs: 4;
  beamWidth: 1024;
  maxMoves: 512;
}>;
/** Internal fixed-profile generator. Resource failure never resamples the target.
 * Not registered with the worker or exported from package entry points. */
export function generateFourByFourJoint(options?: {
  randomUint32?: () => number;
  signal?: AbortSignal;
}): Promise<
  Awaited<ReturnType<typeof solveFourByFourJoint>> & {
    target: FourByFourState;
    generator: typeof FOUR_BY_FOUR_JOINT_GENERATOR;
  }
>;
