// A pixel fire in the style of the classic "doom fire": the bottom row burns
// at full heat and each pixel above takes the heat of the one below it,
// sometimes cooling by a step and drifting sideways. Columns wrap, so a
// frame tiles seamlessly across any width. The simulation is seeded, so the
// same options always produce the same frames.

import { seededRandom } from "./seeded-random.js";

// Heat grids, rows top to bottom, with 0 empty and `levels` hottest.
export function pixelFire({ width, height, levels, frames, seed, warmup }) {
  const rand = seededRandom(seed);
  const grid = Array.from({ length: height }, (_, y) =>
    new Array(width).fill(y === height - 1 ? levels : 0),
  );
  const step = () => {
    // Top down, so every row reads the row below before it changes.
    for (let y = 0; y < height - 1; y++)
      for (let x = 0; x < width; x++) {
        const r = Math.floor(rand() * 4);
        const target = (x - r + 1 + width) % width;
        grid[y][target] = Math.max(grid[y + 1][x] - (r & 1), 0);
      }
  };
  for (let i = 0; i < (warmup ?? height * 3); i++) step();
  return Array.from({ length: frames }, () => {
    step();
    return grid.map((row) => [...row]);
  });
}

// One frame as SVG path data per heat level, one subpath per horizontal
// run; entry i draws level i + 1 and is empty when nothing burns at it.
export function fireRuns(frame, levels) {
  return Array.from({ length: levels }, (_, i) => {
    let d = "";
    frame.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        if (row[x] !== i + 1) {
          x++;
          continue;
        }
        let end = x;
        while (end < row.length && row[end] === i + 1) end++;
        d += `M${x} ${y}h${end - x}v1h-${end - x}z`;
        x = end;
      }
    });
    return d;
  });
}

// The timer's running flame: six heat levels, colored by the view in the
// logo fireball's gradients.
export const timerFire = {
  width: 40,
  height: 16,
  levels: 6,
  frames: pixelFire({
    width: 40,
    height: 16,
    levels: 6,
    frames: 6,
    seed: 0xf1a3e,
  }).map((frame) => fireRuns(frame, 6)),
};
