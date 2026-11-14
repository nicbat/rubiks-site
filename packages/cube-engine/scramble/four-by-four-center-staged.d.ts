import type { FourByFourState } from "./four-by-four-state.js";
export function solveFourByFourCentersStaged(
  state: FourByFourState,
  options?: { signal?: AbortSignal },
): {
  algorithm: string;
  moveCount: number;
  stageLengths: number[];
  nodes: number;
};
