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
/** Pair into a strictly legal reduced 3x3 state instead of solving wings to identity.
 * Requires solved centers and even wings. Either corner permutation parity is
 * accepted and preserved, together with all corner orientations and labeled centers.
 * Selects from eight deterministic assignment-DP goals plus one legal baseline;
 * never resamples a target or repairs its parity by changing non-wing pieces.
 * Already legal paired states return an empty algorithm. Same 1..512 move budget.
 * Each DP has 2^12 * 4 states and considers at most 24 transitions per state. */
export function pairFourByFourWings(
  state: FourByFourState,
  options?: { maxMoves?: number },
): { algorithm: string; cycles: number; moveCount: number };
export function fourByFourWingDiagnostics(): {
  reachableTriples: number;
  maximumSetupDepth: number;
  retainedBytes: number;
  queueBytes: number;
};
