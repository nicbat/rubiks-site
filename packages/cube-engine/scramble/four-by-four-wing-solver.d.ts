import type { FourByFourState } from "./four-by-four-state.js";
/** Internal reduction stage. Requires solved centers and even wing permutation.
 * Deterministically solves all 24 wings to identity, preserving corners and labeled
 * centers. Never mutates, resamples or repairs the input. Fixed routing covers all
 * 12144 ordered triples; at most 22 cycles. Move budget failure is explicit.
 * This is not a complete scrambler or official competition program. */
export function solveFourByFourWings(
  state: FourByFourState,
  options?: {
    /** Integer 1..512, default 512; the complete reduction must budget other stages. */
    maxMoves?: number;
  },
): { algorithm: string; cycles: number; moveCount: number };
export function fourByFourWingDiagnostics(): {
  reachableTriples: number;
  maximumSetupDepth: number;
  retainedBytes: number;
  queueBytes: number;
};
