// The LAST LAYER wordmark, drawn as hand-placed polygons. Cap height is 40
// and strokes are 8 wide; 45° cuts echo the dog-eared panels. Each glyph is
// [advance, subpaths], filled even-odd so counters (A, R) stay open.
const glyphs = {
  // The first L's foot runs out into a blade on the left.
  bladeL: [
    26,
    [
      [
        [4, 0],
        [12, 0],
        [10, 32],
        [30, 32],
        [24, 40],
        [-10, 40],
        [2, 36],
      ],
    ],
  ],
  L: [
    26,
    [
      [
        [2, 0],
        [10, 0],
        [10, 32],
        [28, 32],
        [24, 40],
        [0, 40],
        [0, 2],
      ],
    ],
  ],
  A: [
    34,
    [
      [
        [0, 40],
        [15, -3],
        [19, -3],
        [34, 40],
        [26, 40],
        [23, 30],
        [11, 30],
        [8, 40],
      ],
      [
        [17, 12],
        [20.6, 23],
        [13.4, 23],
      ],
    ],
  ],
  S: [
    28,
    [
      [
        [6, 0],
        [28, 0],
        [25, 8],
        [8, 8],
        [8, 16],
        [22, 16],
        [28, 22],
        [28, 34],
        [22, 40],
        [0, 40],
        [3, 32],
        [20, 32],
        [20, 24],
        [6, 24],
        [0, 18],
        [0, 6],
      ],
    ],
  ],
  // The crossbar ends in a blade toward the next word.
  T: [
    30,
    [
      [
        [0, 0],
        [36, 0],
        [29, 8],
        [19, 8],
        [19, 40],
        [11, 40],
        [11, 8],
        [3, 8],
      ],
    ],
  ],
  Y: [
    30,
    [
      [
        [0, 0],
        [9, 0],
        [15, 13],
        [21, 0],
        [30, 0],
        [19, 24],
        [19, 40],
        [11, 40],
        [11, 24],
      ],
    ],
  ],
  E: [
    28,
    [
      [
        [0, 0],
        [28, 0],
        [25, 8],
        [8, 8],
        [8, 16],
        [22, 16],
        [19, 24],
        [8, 24],
        [8, 32],
        [28, 32],
        [25, 40],
        [0, 40],
      ],
    ],
  ],
  // The R's leg sweeps out into a long blade.
  R: [
    30,
    [
      [
        [0, 0],
        [22, 0],
        [28, 6],
        [28, 18],
        [22, 24],
        [30, 32],
        [52, 44],
        [26, 40],
        [14, 24],
        [8, 24],
        [8, 40],
        [0, 40],
      ],
      [
        [8, 8],
        [20, 8],
        [20, 16],
        [8, 16],
      ],
    ],
  ],
};

const letters = ["bladeL", "A", "S", "T", " ", "L", "A", "Y", "E", "R"];
const gap = 4;
const space = 22;
// The letters lean forward by 12°.
const slant = Math.tan((12 * Math.PI) / 180);

function layout() {
  let x = 12;
  const polygons = [];
  for (const letter of letters) {
    if (letter === " ") {
      x += space;
      continue;
    }
    const [advance, shapes] = glyphs[letter];
    for (const shape of shapes)
      polygons.push(shape.map(([px, py]) => [x + px, py]));
    x += advance + gap;
  }
  return { width: x, polygons };
}

// Even-odd point test against every subpath, so counters stay open.
function inside(polygons, x, y) {
  let hits = 0;
  for (const points of polygons)
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        hits++;
    }
  return hits % 2 === 1;
}

const round = (n) => Math.round(n * 1000) / 1000;

// Samples the slanted letters onto a square grid of `cell` units, so the
// diagonals step like the pixel display face. The grid starts on the cap
// line, so a cell size that divides 40 keeps every letter's top and base.
// Returns one subpath per horizontal run of filled cells.
export function pixelate(cell, { width, polygons } = layout()) {
  const runs = [];
  for (let row = -2; row * cell < 48; row++) {
    const y = row * cell;
    const cy = y + cell / 2;
    let start = null;
    for (let col = Math.floor(-14 / cell); col * cell <= width + 16; col++) {
      const x = col * cell;
      // Undo the slant to test the cell's center against the upright shapes.
      const filled = inside(polygons, x + cell / 2 + slant * cy, cy);
      if (filled && start === null) start = x;
      if (!filled && start !== null) {
        const w = round(x - start);
        runs.push(`M${round(start)} ${round(y)}h${w}v${round(cell)}h${-w}z`);
        start = null;
      }
    }
  }
  return runs.join("");
}

const shape = layout();
// Each letter is 18 cells tall.
const rows = 18;
const cell = 40 / rows;

export const wordmark = {
  viewBox: `-14 -6 ${shape.width + 30} 54`,
  d: pixelate(cell, shape),
  rows,
  cell,
  // The blue offset sits one cell down and right.
  offset: round(cell),
};
