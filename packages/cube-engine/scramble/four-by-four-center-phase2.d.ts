import type { FourByFourState } from "./four-by-four-state.js";
export const FOUR_BY_FOUR_CENTER_PHASE2_MOVES: readonly string[];
/** Requires UD grouping. Groups RL without disturbing UD; does not sort individual colors. */
export function groupFourByFourSecondCenters(
  state: FourByFourState,
  options?: { signal?: AbortSignal; requireEvenWings?: boolean },
): { algorithm: string; moveCount: number };
export function fourByFourCenterPhase2Diagnostics(options?: {
  signal?: AbortSignal;
}): {
  coordinates: number;
  reached: number;
  moves: number;
  maxDepth: number;
  retainedBytes: number;
  initializationScratchBytes: number;
};
