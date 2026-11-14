export const THREE_BY_THREE_GENERATOR: Readonly<{
  id: "last-layer-333-two-phase";
  version: "1";
  method: "random-state";
}>;
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
