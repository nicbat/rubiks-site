import type { FourByFourState } from "./four-by-four-state.js";
/** Internal trusted search context. Validate state once through coordinate;
 * move/distance accept only in-range coordinates and phase-three move indices. */
export function fourByFourJointCenterContext(signal?: AbortSignal): Readonly<{
  coordinate(state: FourByFourState): number;
  move(index: number, moveIndex: number): number;
  distance(index: number): number;
  goal: number;
  diagnostics: Readonly<{
    coordinates: number;
    reached: number;
    maximumDepth: number;
    retainedTableBytes: number;
    queueBytes: number;
  }>;
}>;
