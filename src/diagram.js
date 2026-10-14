import { centers, colorAt, normals } from "./cube.js";
import { pllArrows } from "./pll-arrows.js";
import { escape } from "./html.js";

// Standard BOY color scheme, held yellow-up and green-front.
// Flipping from white-up while keeping green-front also swaps left/right.
export const palette = {
  U: "#ffd84a",
  D: "#ffffff",
  R: "#f5a34b",
  L: "#ec665c",
  F: "#47bba0",
  B: "#629ae0",
};
export function diagram(
  cube,
  section,
  label = "Case diagram",
  { arrows = false, mask, neutralSides = false } = {},
) {
  let rects = "";
  const c = centers(cube);
  const rect = (x, y, w, h, color, position) => {
    const corner = position[0] !== 0 && position[2] !== 0;
    const hidden =
      (neutralSides && (w === 12 || h === 12)) ||
      (mask === "edges" && corner) ||
      (mask === "corners" &&
        !corner &&
        (position[0] !== 0 || position[2] !== 0));
    rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${hidden ? "var(--diagram-muted, #c8d2dc)" : section === "OLL" ? (color === c.U ? palette[c.U] : "var(--diagram-muted, #c8d2dc)") : palette[color]}"/>`;
  };
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      rect(
        30 + col * 27,
        30 + row * 27,
        24,
        24,
        colorAt(cube, [col - 1, 1, row - 1], normals.U),
        [col - 1, 1, row - 1],
      );
  for (let i = 0; i < 3; i++) {
    rect(30 + i * 27, 13, 24, 12, colorAt(cube, [i - 1, 1, -1], normals.B), [
      i - 1,
      1,
      -1,
    ]);
    rect(30 + i * 27, 113, 24, 12, colorAt(cube, [i - 1, 1, 1], normals.F), [
      i - 1,
      1,
      1,
    ]);
    rect(13, 30 + i * 27, 12, 24, colorAt(cube, [-1, 1, i - 1], normals.L), [
      -1,
      1,
      i - 1,
    ]);
    rect(113, 30 + i * 27, 12, 24, colorAt(cube, [1, 1, i - 1], normals.R), [
      1,
      1,
      i - 1,
    ]);
  }
  return `<svg viewBox="0 0 138 138" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">${rects}${section === "PLL" && arrows ? pllArrows(cube, mask === "corners" ? "corner" : mask === "edges" ? "edge" : undefined) : ""}</svg>`;
}

// Unfolded faces, each viewed from outside, with a fixed orientation.
// Reuse the mechanics and palette rather than normalizing moving centers.
export function cubeNet(cube, label = "Unfolded cube") {
  const faces = [
    ["U", 1, 0, (r, c) => [c - 1, 1, r - 1]],
    ["L", 0, 1, (r, c) => [-1, 1 - r, c - 1]],
    ["F", 1, 1, (r, c) => [c - 1, 1 - r, 1]],
    ["R", 2, 1, (r, c) => [1, 1 - r, 1 - c]],
    ["B", 3, 1, (r, c) => [1 - c, 1 - r, -1]],
    ["D", 1, 2, (r, c) => [c - 1, -1, 1 - r]],
  ];
  const markup = faces
    .map(([face, x, y, position]) => {
      let stickers = "";
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const color = colorAt(cube, position(row, col), normals[face]);
          stickers += `<g data-face="${face}" data-row="${row}" data-col="${col}" data-color="${color}"><rect x="${col * 18}" y="${row * 18}" width="16" height="16" rx="2" fill="${palette[color]}" stroke="#18374e" stroke-width=".5"/><text x="${col * 18 + 8}" y="${row * 18 + 11.5}" text-anchor="middle" fill="#18374e" font-size="9">${color}</text></g>`;
        }
      }
      return `<g transform="translate(${x * 62 + 5},${y * 76 + 20})"><text x="26" y="-6" text-anchor="middle" fill="var(--ink)" font-size="11" font-weight="700">${face}</text>${stickers}</g>`;
    })
    .join("");
  return `<svg class="cube-net" viewBox="0 0 252 226" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
}
