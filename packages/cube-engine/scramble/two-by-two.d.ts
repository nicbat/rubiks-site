export const TWO_BY_TWO_STATE_COUNT: number;
export const TWO_BY_TWO_GENERATOR: Readonly<{
  id: "last-layer-222-fixed-dbl";
  version: "1";
  method: "random-state";
}>;
/** Worker-only integration: initialization builds an exhaustive distance table. */
export function generateTwoByTwo(options?: {
  signal?: AbortSignal;
  /** Deterministic test hook; production uses crypto.getRandomValues. */
  randomUint32?: () => number;
}): Promise<{
  algorithm: string;
  targetIndex: number;
  target: { permutation: number[]; orientation: number[] };
  distance: number;
}>;
export function twoByTwoDiagnostics(): Promise<{
  stateCount: number;
  histogram: number[];
  retainedBytes: number;
  initializationQueueBytes: number;
}>;
