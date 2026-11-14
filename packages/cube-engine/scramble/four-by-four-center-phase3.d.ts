import type { FourByFourState } from "./four-by-four-state.js";
export function finishFourByFourCenters(
  state: FourByFourState,
  options?: { signal?: AbortSignal },
): { algorithm: string; moveCount: number };
export function fourByFourCenterPhase3Diagnostics(): {
  coordinates: number;
  maximumDepth: number;
  retainedBytes: number;
  queueBytes: number;
};
