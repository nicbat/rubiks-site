import type { ScrambleProvenance } from "./index.js";
export function generateBlindfolded(options: {
  eventId: "333bf" | "444bf" | "555bf";
  signal?: AbortSignal;
  /** Deterministic tests only; never forwarded by worker requests. */
  randomUint32?: () => number;
}): Promise<{
  algorithm: string;
  baseAlgorithm: string;
  orientation: string;
  generator: ScrambleProvenance;
}>;
