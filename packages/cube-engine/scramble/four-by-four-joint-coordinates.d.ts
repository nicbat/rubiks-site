import type { FourByFourState } from "./four-by-four-state.js";
/** Destination-to-source permutations; additive corner twists. Deeply frozen. */
export const FOUR_BY_FOUR_JOINT_MOVE_METADATA: readonly Readonly<{
  move: string;
  centers: readonly number[];
  wings: readonly number[];
  corners: readonly number[];
  cornerOrientation: readonly number[];
}>[];
export const FOUR_BY_FOUR_PHASE3_MOVES: readonly string[];
export const FOUR_BY_FOUR_PHASE3_WING_ORBITS: readonly (readonly number[])[];
/** Bits follow coordinate center slots filtered to U/D faces. */
export const FOUR_BY_FOUR_PHASE3_UD_MASKS: readonly number[];
export interface FourByFourJointBoundaryAnalysis {
  groupedColors: boolean;
  restrictedUD: boolean;
  evenWingPermutation: boolean;
  orbitIdentityBalance: boolean;
  evenHandedness: boolean;
  eligible: boolean;
  udMask: number;
}
/** Validates and detaches input; does not mutate it. Independent flags describe
 * reduction admissibility, not complete fixed-frame subgroup membership.
 * Phase3 must still solve centers/pair wings and resolve reduced permutation parity. */
export function analyzeFourByFourJointBoundary(
  state: FourByFourState,
): FourByFourJointBoundaryAnalysis;
