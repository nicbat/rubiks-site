import { centers, normals } from "./cube.js";

// The side stickers identify a cubie's solved destination relative to the centers.
// Deriving this from the facelets keeps arrows in sync with every algorithm variant.
export function pllDestinations(cube) {
  const faceByColor = Object.fromEntries(
    Object.entries(centers(cube)).map(([face, color]) => [color, face]),
  );
  const pieces = [];
  for (let z = -1; z <= 1; z++)
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && z === 0) continue;
      const stickers = cube.filter(
        (s) => s.p[0] === x && s.p[1] === 1 && s.p[2] === z,
      );
      const destination = stickers.reduce(
        (sum, s) => sum.map((v, i) => v + normals[faceByColor[s.color]][i]),
        [0, 0, 0],
      );
      pieces.push({
        from: [x, z],
        to: [destination[0], destination[2]],
        kind: x !== 0 && z !== 0 ? "corner" : "edge",
      });
    }
  // PLL diagrams describe the permutation, not an incidental final U alignment.
  // Pick the target AUF with the fewest displaced pieces, preferring stationary
  // corners on ties (e.g. H and Z remain edge-only permutations).
  const candidates = [0, 1, 2, 3].map((turns) =>
    pieces
      .map((piece) => {
        let to = piece.to;
        for (let i = 0; i < turns; i++) to = [-to[1], to[0]];
        to = to.map((v) => (v === 0 ? 0 : v));
        return { ...piece, to };
      })
      .filter((piece) => !piece.from.every((v, i) => v === piece.to[i])),
  );
  candidates.sort(
    (a, b) =>
      a.length - b.length ||
      a.filter((m) => m.kind === "corner").length -
        b.filter((m) => m.kind === "corner").length,
  );
  return candidates[0];
}
const point = ([x, z]) => [69 + 27 * x, 69 + 27 * z];
const same = (a, b) => a.every((v, i) => v === b[i]);
const format = (p) => p.map((v) => v.toFixed(2)).join(",");
function arrowHead(tip, direction) {
  const base = tip.map((v, i) => v - direction[i] * 5.8),
    normal = [-direction[1] * 3.3, direction[0] * 3.3];
  return `<polygon points="${format(tip)} ${format(base.map((v, i) => v + normal[i]))} ${format(base.map((v, i) => v - normal[i]))}"/>`;
}
export function pllArrows(cube) {
  const movements = pllDestinations(cube),
    drawn = new Set();
  let arrows = "";
  for (const [index, movement] of movements.entries()) {
    if (drawn.has(index)) continue;
    const opposite = movements.findIndex(
      (m) => same(m.from, movement.to) && same(m.to, movement.from),
    );
    if (opposite >= 0) drawn.add(opposite);
    const from = point(movement.from),
      to = point(movement.to),
      length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const direction = to.map((v, i) => (v - from[i]) / length);
    const start = from.map((v, i) => v + direction[i] * 7),
      end = to.map((v, i) => v - direction[i] * 7);
    const color = movement.kind === "corner" ? "#674495" : "#203b50";
    const path = `M${format(start)} L${format(end)}`;
    arrows += `<g class="pll-arrow" data-kind="${movement.kind}" fill="${color}" stroke-linecap="round"><path d="${path}" stroke="#fff7d4" stroke-width="4.5"/><path d="${path}" stroke="${color}" stroke-width="2"/>${arrowHead(end, direction)}${
      opposite >= 0
        ? arrowHead(
            start,
            direction.map((v) => -v),
          )
        : ""
    }</g>`;
  }
  return `<g class="pll-arrows" aria-hidden="true">${arrows}</g>`;
}
