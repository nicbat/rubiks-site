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

function layout() {
  let x = 12;
  const subpaths = [];
  for (const letter of letters) {
    if (letter === " ") {
      x += space;
      continue;
    }
    const [advance, shapes] = glyphs[letter];
    for (const shape of shapes)
      subpaths.push(
        `M${shape.map(([px, py]) => `${x + px} ${py}`).join(" L")}Z`,
      );
    x += advance + gap;
  }
  return { width: x, d: subpaths.join("") };
}

const { width, d } = layout();

export const wordmark = {
  viewBox: `-14 -6 ${width + 30} 54`,
  d,
  // Thin slash cuts through the strokes, like a blade swipe.
  cuts: [
    { x: -4, y: 13, width: 150, height: 1.6 },
    { x: 120, y: 27, width: 170, height: 1.6 },
    { x: 230, y: 19, width: 60, height: 1.4 },
  ],
  mask: { x: -20, y: -10, width: width + 70, height: 70 },
};
