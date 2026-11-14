import type { FourByFourState } from "./four-by-four-state.js";
export interface FourByFourJointBudget {
  nodes: number;
  maxNodes: number;
}
export function searchFourByFourJointPhase2(
  state: FourByFourState,
  options: {
    budget: FourByFourJointBudget;
    maxDepth?: number;
    maxCandidates?: number;
    signal?: AbortSignal;
  },
): {
  candidates: Array<{
    algorithm: string;
    state: FourByFourState;
    moveCount: number;
  }>;
  nodes: number;
  complete: boolean;
  stopReason: "count" | "depth";
};
export function fourByFourJointPhase2Diagnostics(options?: {
  signal?: AbortSignal;
}): {
  coordinates: number;
  reached: number;
  maximumDistance: number;
  retainedTypedBytes: number;
  queueBytes: number;
};

/** Internal trusted predicate for validated 0..23 permutations only. Checks orbit
 * identity balance and handedness; not centers or total permutation parity. */
export function fourByFourJointPhase2WingBoundary(
  wings: readonly number[] | Uint8Array,
): boolean;
