export const THREE_BY_THREE_GENERATOR: Readonly<{
  id: "last-layer-333-two-phase";
  version: "1";
  method: "random-state";
}>;
/** Fixed centers; piece order matches the engine and cubing.js 3x3 orbits.
 * CORNERS: URF UBR ULB UFL DFR DLF DBL DRB.
 * EDGES: UF UR UB UL DF DR DB DL FR FL BR BL.
 * Orientation follows those ordered face labels; only these four fields are accepted. */
export interface ThreeByThreeTarget {
  cornerPermutation: readonly number[];
  cornerOrientation: readonly number[];
  edgePermutation: readonly number[];
  edgeOrientation: readonly number[];
}
/** Deterministically solve this exact legal target to solved (not a scramble).
 * No sampling, parity repair or input mutation. Solved targets return "".
 * maxNodes is a required positive safe integer and excludes bounded table setup.
 * Worker-only synchronous CPU search after setup; terminate its worker to cancel.
 * Invalid target/options shape throws TypeError; invalid or exhausted budget
 * throws GENERATION_FAILED. */
export function solveThreeByThree(
  target: ThreeByThreeTarget,
  options: { maxNodes: number },
): Promise<{ algorithm: string; nodes: number; phaseLengths: number[] }>;
/** Worker-only CPU search. Caller must never silently resample failed targets. */
export function generateThreeByThree(options?: {
  signal?: AbortSignal;
  /** Deterministic test hook; production uses crypto.getRandomValues. */
  randomUint32?: () => number;
  /** Diagnostic/test budget; production defaults to fifty million visited nodes. */
  maxNodes?: number;
}): Promise<{
  algorithm: string;
  nodes: number;
  phaseLengths: number[];
  target: {
    cornerPermutation: number[];
    cornerOrientation: number[];
    edgePermutation: number[];
    edgeOrientation: number[];
  };
}>;
export function threeByThreeDiagnostics(): Promise<{
  retainedBytes: number;
  largestQueueBytes: number;
  pruningSizes: number[];
  pruningMaximums: number[];
}>;
