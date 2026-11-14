export const CUBE_ORIENTATIONS: readonly string[];
export function sampleCubeOrientation(options?: {
  signal?: AbortSignal;
  /** Deterministic tests only; production uses Web Crypto. */
  randomUint32?: () => number;
}): string;
