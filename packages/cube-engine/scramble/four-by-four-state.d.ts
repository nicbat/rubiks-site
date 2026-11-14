export interface FourByFourState {
  cornerPermutation: number[];
  cornerOrientation: number[];
  wingPermutation: number[];
  centerColors: number[];
}
export interface FourByFourSlot {
  readonly position: readonly number[];
  readonly faces: readonly string[];
}
export const FOUR_BY_FOUR_COORDINATES: Readonly<{
  faces: readonly string[];
  corners: readonly FourByFourSlot[];
  wings: readonly FourByFourSlot[];
  centers: readonly FourByFourSlot[];
}>;
export const FOUR_BY_FOUR_MOVES: readonly string[];
export function solvedFourByFourState(): FourByFourState;
/** Returns a validated independent copy; center labels of one color are indistinguishable. */
export function validateFourByFourState(state: unknown): FourByFourState;
/** Uniform observable state. Not a scramble generator; no distance filtering. */
export function sampleFourByFourState(options?: {
  signal?: AbortSignal;
  randomUint32?: () => number;
}): FourByFourState;
export function applyFourByFourMoves(
  state: FourByFourState,
  algorithm: string,
): FourByFourState;
export function fourByFourStateToFacelets(
  state: FourByFourState,
): Array<{ p: number[]; n: number[]; color: string }>;
/** Destination-to-source indices in FOUR_BY_FOUR_COORDINATES.centers. */
export function fourByFourCenterMovePermutation(
  move: string,
): readonly number[];
