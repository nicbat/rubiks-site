import { cubeSize, normals, moveGeometry, inMove } from "../core/index.js";
import { resolvePalette } from "./palette.js";

const rotations = {
  F: "",
  B: "rotateY(180deg)",
  R: "rotateY(90deg)",
  L: "rotateY(-90deg)",
  U: "rotateX(90deg)",
  D: "rotateX(-90deg)",
};
export function cubeScene(cube, move, options = {}) {
  const size = cubeSize(cube);
  const extent = (size - 1) / 2;
  const step = 144 / size;
  // Coordinates are unit-spaced and size-bounded, so numeric facelet slots avoid
  // allocating/stringifying position-normal keys for each sticker twice.
  const slot = (p, normalCode) =>
    (((p[0] + extent) * size + p[1] + extent) * size + p[2] + extent) * 7 +
    normalCode +
    3;
  const colors = new Array(size ** 3 * 7);
  for (const { p, n, color } of cube)
    colors[slot(p, n[0] + 2 * n[1] + 3 * n[2])] = color;
  const faceEntries = Object.entries(normals).map(([face, n]) => ({
    n,
    axis: n.findIndex((v) => v !== 0),
    code: n[0] + 2 * n[1] + 3 * n[2],
    normalText: String(n),
    transform: `${rotations[face]} translateZ(${step / 2}px)`,
  }));
  // The stylesheet's native 48px cubies already exactly describe 3x3 geometry.
  const dimensions =
    size === 3
      ? ""
      : `width:${step}px;height:${step}px;left:${-step / 2}px;top:${-step / 2}px;`;
  const palette = resolvePalette(options.palette);
  const spec = move ? moveGeometry(move, size) : null;
  let fixed = "",
    moving = "";
  for (let x = -extent; x <= extent; x++)
    for (let y = -extent; y <= extent; y++)
      for (let z = -extent; z <= extent; z++) {
        if (
          Math.abs(x) !== extent &&
          Math.abs(y) !== extent &&
          Math.abs(z) !== extent
        )
          continue;
        const p = [x, y, z];
        const position = String(p);
        let faces = "";
        for (const { n, axis, code, normalText, transform } of faceEntries) {
          const outer = p[axis] === n[axis] * extent;
          const color = outer ? colors[slot(p, code)] : null;
          if (color !== null && !Object.hasOwn(palette, color))
            throw new Error("Invalid sticker color");
          const exposed = outer || interiorFaceExposed(p, n, spec);
          // Physical sticker colors must outrank dark-mode extension styles.
          // A real child can carry an inline priority; a pseudo-element cannot.
          const sticker = color
            ? `<span class="cube-sticker" style="background-color:${palette[color]}!important"></span>`
            : "";
          faces += `<i class="cube-face" ${color ? `data-position="${position}" data-normal="${normalText}" data-color="${color}"` : `data-inner-normal="${normalText}"`} style="display:${exposed ? "block" : "none"};${dimensions}transform:${transform}">${sticker}</i>`;
        }
        const cubie = `<div class="cube-piece" data-cubie="${position}" style="transform:translate3d(${x * step}px,${-y * step}px,${z * step}px)">${faces}</div>`;
        if (spec && inMove(p, spec)) moving += cubie;
        else fixed += cubie;
      }
  return `${fixed}<div class="cube-layer">${moving}</div>`;
}
export function layerTransform(move, fraction, size = 3) {
  if (!move) return "none";
  const { axis, sign, turns } = moveGeometry(move, size);
  // CSS y points down; conjugate the model rotation into CSS coordinates.
  return `rotate${"XYZ"[axis]}(${sign * turns * 90 * fraction * (axis === 1 ? 1 : -1)}deg)`;
}

// Only show black internal surfaces where a turning layer separates pieces.
export function interiorFaceExposed(position, normal, move) {
  return Boolean(
    move &&
    inMove(position, move) !==
      inMove(
        position.map((v, i) => v + normal[i]),
        move,
      ),
  );
}
