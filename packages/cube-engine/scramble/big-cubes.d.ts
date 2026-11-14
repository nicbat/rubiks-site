import type { Cube, Sticker } from "../core/index.js";
import type { ScrambleProvenance } from "./index.js";
/** Exact0/1 outer-block-turn test modulo whole-puzzle rotations, for sizes5–7. */
export function isWithinOneTurn(cube: readonly Sticker[]): boolean;
export function generateBigCube(options: {
  eventId: "555" | "666" | "777";
  signal?: AbortSignal;
  /** Deterministic tests only; production uses Web Crypto. */
  randomUint32?: () => number;
}): Promise<{ algorithm: string; cube: Cube; generator: ScrambleProvenance }>;
