import type { FourByFourState } from "./four-by-four-state.js";
import type { ThreeByThreeTarget } from "./three-by-three.js";
import type { FourByFourJointBudget } from "./four-by-four-joint-phase2.js";
/** Incomplete beam; budget counts generated children, including duplicates.
 * Strict failure never replaces the target. Worker-only synchronous operation. */
export function searchFourByFourJointBeam(
  state: FourByFourState,
  options: {
    budget: FourByFourJointBudget;
    maxDepth?: number;
    beamWidth?: number;
    wingPairs?: 3 | 4;
    signal?: AbortSignal;
  },
): {
  algorithm: string;
  state: FourByFourState;
  target: ThreeByThreeTarget;
  moveCount: number;
  nodes: number;
  expandedParents: number;
};
