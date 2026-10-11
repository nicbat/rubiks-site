import { centers, colorAt, normals } from "./cube.js";
import { pllArrows } from "./pll-arrows.js";
import { escape } from "./html.js";

export const palette = {
  U: "#ffd84a",
  D: "#ffffff",
  R: "#ec665c",
  L: "#f5a34b",
  F: "#47bba0",
  B: "#629ae0",
};
export function diagram(
  cube,
  section,
  label = "Case diagram",
  { arrows = false, mask } = {},
) {
  let rects = "";
  const c = centers(cube);
  const rect = (x, y, w, h, color, position) => {
    const corner = position[0] !== 0 && position[2] !== 0;
    const hidden =
      (mask === "edges" && corner) ||
      (mask === "corners" &&
        !corner &&
        (position[0] !== 0 || position[2] !== 0));
    rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${hidden ? "var(--diagram-muted, #c8d2dc)" : section === "OLL" ? (color === c.U ? palette.U : "var(--diagram-muted, #c8d2dc)") : palette[color]}"/>`;
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
  return `<svg viewBox="0 0 138 148" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">${rects}${section === "PLL" && arrows ? pllArrows(cube, mask === "corners" ? "corner" : mask === "edges" ? "edge" : undefined) : ""}<text x="69" y="142" text-anchor="middle" fill="var(--muted, #708195)" font-size="9" font-family="sans-serif">front</text></svg>`;
}
