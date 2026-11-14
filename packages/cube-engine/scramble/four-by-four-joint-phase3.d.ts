import type { FourByFourState } from "./four-by-four-state.js";
import type { FourByFourJointBudget } from "./four-by-four-joint-phase2.js";
export function searchFourByFourJointPhase3(
  state: FourByFourState,
  options: {
    budget: FourByFourJointBudget;
    maxDepth?: number;
    wingPairs?: 3 | 4;
    signal?: AbortSignal;
  },
): {
  algorithm: string;
  state: FourByFourState;
  target: {
    cornerPermutation: number[];
    cornerOrientation: number[];
    edgePermutation: number[];
    edgeOrientation: number[];
  };
  moveCount: number;
  nodes: number;
};
