import type { FourByFourState } from "./four-by-four-state.js";
/** Experimental, internal exact-target solver. Joint stages and 3x3 finish use separate explicit budgets. */
export function solveFourByFourJoint(
  state: FourByFourState,
  options: {
    maxNodes: number;
    finishMaxNodes: number;
    maxMoves?: number;
    signal?: AbortSignal;
  },
): Promise<{
  algorithm: string;
  moveCount: number;
  stageLengths: number[];
  nodes: number;
  finishNodes: number;
}>;
