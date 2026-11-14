import type { FourByFourState } from "./four-by-four-state.js";
import type { ThreeByThreeTarget } from "./three-by-three.js";
export interface FourByFourReductionAnalysis {
  /** Detached coordinates. Illegal as a 3x3 target when either parity flag is true. */
  target: ThreeByThreeTarget;
  edgeFlipParity: boolean;
  permutationParityMismatch: boolean;
}
/** Requires validated coordinates, exactly solved fixed-frame centers and paired
 * ordered wing colors. Throws TypeError for malformed states, CENTERS_UNSOLVED
 * with slots:number[], or WINGS_UNPAIRED with edgeSlots:number[] (3x3 edge order).
 * Both parity flags are reported independently. No repair, entropy or mutation. */
export function analyzeFourByFourReduction(
  state: FourByFourState,
): FourByFourReductionAnalysis;
/** Returns only an exact legal 3x3 target. In addition to the structural failures
 * above, throws EDGE_FLIP_PARITY, PERMUTATION_PARITY, or BOTH_PARITIES; each
 * parity error includes both boolean flags. Does not initialize solver tables. */
export function reduceFourByFourToThree(
  state: FourByFourState,
): ThreeByThreeTarget;
