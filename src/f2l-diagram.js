import { colorAt, normals } from "./cube.js";
import { palette } from "./diagram.js";
import { escape } from "./html.js";

// Static U/F/R preview. Follow the target pieces by their sticker colors,
// so the same corner and edge stay highlighted after setup moves.
export function f2lDiagram(cube, label = "F2L pair diagram") {
  const pieces = new Map();
  for (const sticker of cube) {
    const key = sticker.p.join(",");
    if (!pieces.has(key)) pieces.set(key, []);
    pieces.get(key).push(sticker.color);
  }
  const targets = new Set(
    [...pieces]
      .filter(([, colors]) => ["DFR", "FR"].includes(colors.sort().join("")))
      .map(([key]) => key),
  );
  const faces = [
    ["U", [72, 6], [18, 9], [-18, 9], (r, c) => [c - 1, 1, r - 1]],
    ["F", [18, 33], [18, 9], [0, 20], (r, c) => [c - 1, 1 - r, 1]],
    ["R", [72, 60], [18, -9], [0, 20], (r, c) => [1, 1 - r, 1 - c]],
  ];
  const markup = faces
    .map(([face, origin, across, down, position]) => {
      let stickers = "";
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const p = position(row, col);
          const color = colorAt(cube, p, normals[face]);
          const target = targets.has(p.join(","));
          const shown = target || (row === 1 && col === 1);
          const points = [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ]
            .map(([x, y]) =>
              origin
                .map((v, i) => v + across[i] * (col + x) + down[i] * (row + y))
                .join(","),
            )
            .join(" ");
          stickers += `<polygon data-face="${face}" data-row="${row}" data-col="${col}" data-color="${color}" data-target="${target}" points="${points}" fill="${shown ? palette[color] : "var(--diagram-muted, #c8d2dc)"}" stroke="var(--surface, #18374e)" stroke-width="2" stroke-linejoin="round"/>`;
        }
      }
      return stickers;
    })
    .join("");
  return `<svg class="f2l-diagram" viewBox="0 0 144 128" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
}
