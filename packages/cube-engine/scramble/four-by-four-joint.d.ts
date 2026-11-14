import type { FourByFourState } from "./four-by-four-state.js";
/** Experimental, internal exact-target solver. Joint stages and 3x3 finish use separate explicit budgets. */
export function solveFourByFourJoint(
  state: FourByFourState,
  options: {
    maxNodes: number;
    finishMaxNodes: number;
    maxMoves?: number;
    candidateCount?: number;
    perCandidateMaxNodes?: number;
    phase2MaxDepth?: number;
    phase3MaxDepth?: number;
    wingPairs?: 3 | 4;
    phase3Search?: "ida" | "beam";
    beamWidth?: number;
    signal?: AbortSignal;
  },
): Promise<{
  algorithm: string;
  moveCount: number;
  stageLengths: number[];
  nodes: number;
  finishNodes: number;
  candidateCount: number;
  attempts: Array<{
    candidateIndex: number;
    score: number;
    nodes: number;
    status: string;
  }>;
}>;
