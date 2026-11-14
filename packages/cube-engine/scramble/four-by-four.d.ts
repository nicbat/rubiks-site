import type { FourByFourState } from "./four-by-four-state.js";
export const FOUR_BY_FOUR_GENERATOR: Readonly<{
  id: "last-layer-444-constructive";
  version: "1";
  method: "random-state";
}>;
/** Internal constructive exact-target solver; not yet a worker generator.
 * maxNodes bounds only 3x3 search. maxMoves is 1..512 (default512).
 * Synchronous stages require worker termination for mid-stage cancellation. */
export function solveFourByFour(
  state: FourByFourState,
  options: { maxNodes: number; maxMoves?: number; signal?: AbortSignal },
): Promise<{
  algorithm: string;
  moveCount: number;
  nodes: number;
  stageLengths: number[];
}>;
/** Internal only. Rejects shallow targets; never retries failed target solving. */
export function generateFourByFour(options?: {
  randomUint32?: () => number;
  signal?: AbortSignal;
  maxNodes?: number;
  maxMoves?: number;
}): Promise<{
  algorithm: string;
  moveCount: number;
  nodes: number;
  stageLengths: number[];
  target: FourByFourState;
}>;
