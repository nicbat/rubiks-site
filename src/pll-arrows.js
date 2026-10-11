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
  // Pick the target AUF with the fewest displaced pieces. For G perms, prefer
  // two three-cycles with the matching corner/edge block stationary. Otherwise
  // prefer stationary corners on ties (e.g. H and Z stay edge-only).
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
  const cycleRank = (candidate) => {
    if (
      candidate.length !== 6 ||
      candidate.filter((m) => m.kind === "corner").length !== 3
    )
      return 2;
    const fixed = pieces.filter(
      (piece) => !candidate.some((m) => same(m.from, piece.from)),
    );
    const corner = fixed.find((p) => p.kind === "corner").from;
    const edge = fixed.find((p) => p.kind === "edge").from;
    // Preserve the recognizable two-piece block; this also breaks the tie
    // between the two possible three-cycle alignments independently of AUF.
    return edge.some((v, i) => v !== 0 && v === corner[i]) ? 0 : 1;
  };
  candidates.sort(
    (a, b) =>
      a.length - b.length ||
      cycleRank(a) - cycleRank(b) ||
      a.filter((m) => m.kind === "corner").length -
        b.filter((m) => m.kind === "corner").length,
  );
  return candidates[0];
}
const point = ([x, z]) => [69 + 27 * x, 69 + 27 * z];
const same = (a, b) => a.every((v, i) => v === b[i]);
const format = (p) => p.map((v) => v.toFixed(2)).join(",");
function arrowHead(tip, direction, color, width = 1.8) {
  const base = tip.map((v, i) => v - direction[i] * 10),
    normal = [-direction[1] * 5, direction[0] * 5];
  return `<polygon stroke="${color}" stroke-width="${width}" stroke-linejoin="round" points="${format(tip)} ${format(base.map((v, i) => v + normal[i]))} ${format(base.map((v, i) => v - normal[i]))}"/>`;
}
export function pllArrows(cube, kind) {
  const movements = pllDestinations(cube).filter(
      (m) => !kind || m.kind === kind,
    ),
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
    // Stop shafts inside the heads: a round cap at the tip protrudes as a nub.
    // Tips extend four units past sticker centers; matching strokes soften corners.
    // Each complete arrow is outlined before the next arrow is drawn, so even
    // crossings between arrows of the same color remain distinguishable.
    const fromTip = from.map((v, i) => v - direction[i] * 4),
      toTip = to.map((v, i) => v + direction[i] * 4);
    const start =
        opposite >= 0 ? fromTip.map((v, i) => v + direction[i] * 9) : from,
      end = toTip.map((v, i) => v - direction[i] * 9);
    const color = movement.kind === "corner" ? "#674495" : "#203b50";
    const path = `M${format(start)} L${format(end)}`;
    const heads = (stroke, width) =>
      arrowHead(toTip, direction, stroke, width) +
      (opposite >= 0
        ? arrowHead(
            fromTip,
            direction.map((v) => -v),
            stroke,
            width,
          )
        : "");
    arrows += `<g class="pll-arrow" data-kind="${movement.kind}" fill="${color}" stroke-linecap="round"><g class="pll-arrow-outline" fill="#fff7d4"><path d="${path}" stroke="#fff7d4" stroke-width="8"/>${heads("#fff7d4", 4.8)}</g><path d="${path}" stroke="${color}" stroke-width="5"/>${heads(color, 1.8)}</g>`;
  }
  return `<g class="pll-arrows" aria-hidden="true">${arrows}</g>`;
}
