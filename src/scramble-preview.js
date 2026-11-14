import { validateScrambleGrip } from "@last-layer/cube-engine/scramble";
import { palette } from "./diagram.js";
const vectors = {
  white: [0, 1, 0],
  yellow: [0, -1, 0],
  green: [0, 0, 1],
  blue: [0, 0, -1],
  red: [1, 0, 0],
  orange: [-1, 0, 0],
};
const colors = {
  white: palette.D,
  yellow: palette.U,
  green: palette.F,
  blue: palette.B,
  red: palette.L,
  orange: palette.R,
};
export function scramblePalette(grip) {
  const { up, front } = validateScrambleGrip(grip);
  const u = vectors[up],
    f = vectors[front];
  const r = [
    u[1] * f[2] - u[2] * f[1],
    u[2] * f[0] - u[0] * f[2],
    u[0] * f[1] - u[1] * f[0],
  ];
  const hex = (direction) =>
    colors[
      Object.keys(vectors).find((color) =>
        vectors[color].every((value, i) => value === direction[i]),
      )
    ];
  const opposite = (direction) => direction.map((value) => -value);
  return {
    U: hex(u),
    D: hex(opposite(u)),
    F: hex(f),
    B: hex(opposite(f)),
    R: hex(r),
    L: hex(opposite(r)),
  };
}
