import { moveGeometry, inMove, cubeSize } from "../core/index.js";
import { cubeScene, layerTransform, interiorFaceExposed } from "./scene.js";
import { resolvePalette } from "./palette.js";
export { cubeScene, layerTransform, interiorFaceExposed } from "./scene.js";
export { defaultPalette } from "./palette.js";

// Scheduling and controls belong to the caller. Full snapshots are read only
// at move/cycle boundaries; animated frames only update transforms.
export function createCubeRenderer(root, options = {}) {
  const palette = resolvePalette(options.palette);
  if (!root.querySelector(".cube-camera") || !root.querySelector(".cube-scene"))
    throw new Error("Renderer requires a cube camera and scene");
  root.setAttribute("data-cube-engine", "");
  const drawn = {};
  const draw = (
    playback,
    { pitch = -25, yaw = -35, reducedMotion = false } = {},
  ) => {
    if (!root) return;
    const state = playback.snapshot({ includeCube: false });
    const changed = drawn.index !== state.index;
    if (changed || drawn.cycle !== state.cycle || drawn.playback !== playback) {
      const cube = playback.snapshot().cube;
      const scene = root.querySelector(".cube-scene");
      const size = cubeSize(cube);
      if (!drawn.pieces || drawn.size !== size) {
        drawn.size = size;
        scene.innerHTML = cubeScene(cube, undefined, { palette });
        drawn.layer = scene.querySelector(".cube-layer");
        drawn.pieces = [...scene.querySelectorAll(".cube-piece")].map(
          (element) => ({
            element,
            position: element.dataset.cubie.split(",").map(Number),
            innerFaces: [
              ...element.querySelectorAll("[data-inner-normal]"),
            ].map((face) => ({
              element: face,
              normal: face.dataset.innerNormal.split(",").map(Number),
            })),
          }),
        );
        drawn.stickers = [...scene.querySelectorAll("[data-color]")];
      }
      // Keep all geometry alive. Recolor fixed positions and move only the
      // affected cubies into the rotating group at each move boundary.
      const colors = new Map(
        cube.map(({ p, n, color }) => [`${p}/${n}`, color]),
      );
      for (const sticker of drawn.stickers) {
        const color = colors.get(
          `${sticker.dataset.position}/${sticker.dataset.normal}`,
        );
        if (sticker.dataset.color !== color) {
          sticker.dataset.color = color;
          sticker.firstElementChild.style.setProperty(
            "background-color",
            palette[color],
            "important",
          );
        }
      }
      const move = state.move ? moveGeometry(state.move, drawn.size) : null;
      for (const { element, position, innerFaces } of drawn.pieces) {
        const parent = move && inMove(position, move) ? drawn.layer : scene;
        if (element.parentNode !== parent) parent.append(element);
        for (const face of innerFaces) {
          const exposed = interiorFaceExposed(position, face.normal, move);
          const display = exposed ? "block" : "none";
          if (face.element.style.display !== display)
            face.element.style.display = display;
        }
      }
      drawn.transform = undefined;
      drawn.playback = playback;
      drawn.index = state.index;
      drawn.cycle = state.cycle;
    }
    const transform = layerTransform(
      state.move,
      reducedMotion ? (state.fraction > 0 ? 1 : 0) : state.fraction,
      drawn.size,
    );
    if (drawn.transform !== transform) {
      drawn.layer.style.transform = transform;
      drawn.transform = transform;
    }
    if (drawn.pitch !== pitch || drawn.yaw !== yaw) {
      root.querySelector(".cube-camera").style.transform =
        `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
      drawn.pitch = pitch;
      drawn.yaw = yaw;
    }
  };
  draw.destroy = () => {
    root = null;
    for (const key of Object.keys(drawn)) delete drawn[key];
  };
  return draw;
}

// This convenience mount owns only the subtree it appends, never the host.
export function mountCubeRenderer(host, options = {}) {
  let stage = host.ownerDocument.createElement("div");
  stage.className = "cube-stage";
  stage.innerHTML =
    '<div class="cube-camera"><div class="cube-scene"></div></div>';
  const draw = createCubeRenderer(stage, options);
  host.append(stage);
  return {
    update: draw,
    destroy() {
      draw.destroy();
      stage?.remove();
      stage = null;
    },
  };
}
