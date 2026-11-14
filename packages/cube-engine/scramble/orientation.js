import { uniformInteger, secureUint32 } from "./random-source.js";
// Six choices of upward face, followed by four headings: all24 proper rotations.
// Whole-puzzle x/y/z notation is defined by WCA12a4; rotations cost0 in OBTM.
export const CUBE_ORIENTATIONS = Object.freeze(
  ["", "x", "x2", "x'", "z", "z'"].flatMap((up) =>
    ["", "y", "y2", "y'"].map((heading) =>
      [up, heading].filter(Boolean).join(" "),
    ),
  ),
);
export function sampleCubeOrientation({
  randomUint32 = secureUint32,
  signal,
} = {}) {
  return CUBE_ORIENTATIONS[uniformInteger(24, randomUint32, signal)];
}
