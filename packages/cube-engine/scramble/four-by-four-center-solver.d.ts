import type { FourByFourState } from "./four-by-four-state.js";
/** Complete center-color stage; alters corners/wings, preserving permutation parity. */
export function solveFourByFourCenters(
  state: FourByFourState,
  options?: { signal?: AbortSignal },
): { algorithm: string; cycles: number; moveCount: number };
export function fourByFourCenterSolverDiagnostics(): {
  conjugates: number;
  maxConjugationDepth: number;
  retainedBytes: number;
  initializationScratchBytes: number;
  maxCycles: number;
  maxUncompactedMoves: number;
};
