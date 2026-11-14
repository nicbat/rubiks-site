import type { Cube, Sticker } from "../core/index.js";

export interface PlaybackOptions {
  loop?: boolean;
  autoplay?: boolean;
  holdMs?: number;
}
export interface PlaybackSnapshot {
  index: number;
  cycle: number;
  playing: boolean;
  move: string | undefined;
  fraction: number;
}
export interface CubePlayback {
  moves: string[];
  snapshot(options?: { includeCube?: true }): PlaybackSnapshot & { cube: Cube };
  snapshot(options: { includeCube: false }): PlaybackSnapshot;
  snapshot(options: {
    includeCube?: boolean;
  }): PlaybackSnapshot & { cube?: Cube };
  toggle(): void;
  pause(): void;
  reset(): void;
  seek(next: number): void;
  position(): number;
  scrub(position: number): void;
  tick(delta: number): void;
}
/** A bounded 2×2–7×7 timeline; the caller owns time and scheduling. */
export function createCubePlayback(
  initial: readonly Sticker[],
  algorithm: string,
  options?: PlaybackOptions,
): CubePlayback;
