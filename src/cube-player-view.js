import { colorAt, normals, moveGeometry, inMove } from "./cube.js";
import { palette } from "./diagram.js";

const rotations = {
  F: "",
  B: "rotateY(180deg)",
  R: "rotateY(90deg)",
  L: "rotateY(-90deg)",
  U: "rotateX(90deg)",
  D: "rotateX(-90deg)",
};
export function cubeScene(cube, move) {
  const spec = move ? moveGeometry(move) : null;
  let fixed = "",
    moving = "";
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const p = [x, y, z];
        let faces = "";
        for (const [face, n] of Object.entries(normals)) {
          const outer = p.some((v, i) => n[i] && v === n[i]);
          const color = outer ? colorAt(cube, p, n) : null;
          const exposed = outer || interiorFaceExposed(p, n, spec);
          faces += `<i class="cube-face" ${color ? `data-position="${p}" data-normal="${n}" data-color="${color}"` : `data-inner-normal="${n}"`} style="display:${exposed ? "block" : "none"};transform:${rotations[face]} translateZ(23px);--sticker:${color ? palette[color] : "#202832"}"></i>`;
        }
        const cubie = `<div class="cube-piece" data-cubie="${p}" style="transform:translate3d(${x * 48}px,${-y * 48}px,${z * 48}px)">${faces}</div>`;
        if (spec && inMove(p, spec)) moving += cubie;
        else fixed += cubie;
      }
  return `${fixed}<div class="cube-layer">${moving}</div>`;
}
export function layerTransform(move, fraction) {
  if (!move) return "none";
  const { axis, sign, turns } = moveGeometry(move);
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
