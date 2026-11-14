import type { FourByFourState } from "./four-by-four-state.js";

export type OppositeCenterPair = "UD" | "RL" | "FB";
export const FOUR_BY_FOUR_CENTER_COORDINATES: number;
export function rankFourByFourCenters(mask: number): number;
export function unrankFourByFourCenters(index: number): number;
export function fourByFourCenterMask(
  state: FourByFourState,
  pair?: OppositeCenterPair,
): number;
export function moveFourByFourCenterCoordinate(
  index: number,
  move: string,
): number;
/** Worker-only first stage, not a complete solver. maxNodes bounds expansions,
 * not fixed search-array allocation. Failure never replaces the supplied state. */
export function groupFourByFourOppositeCenters(
  state: FourByFourState,
  options: { pair?: OppositeCenterPair; maxNodes: number },
): {
  algorithm: string;
  nodes: number;
  discovered: number;
  searchBytes: number;
};
