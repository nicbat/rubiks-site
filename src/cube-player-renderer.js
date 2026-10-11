import { icon } from "./icons.js";
import { moveGeometry, inMove } from "./cube.js";
import { palette } from "./diagram.js";
import {
  cubeScene,
  layerTransform,
  interiorFaceExposed,
} from "./cube-player-view.js";

// DOM projection only: no listeners, timers, or application state. Each mount
// owns its draw cache so replacing the DOM always paints a complete first frame.
export function createCubeRenderer(root) {
  const drawn = {};
  return (playback, { pitch, yaw, reducedMotion }) => {
    const state = playback.snapshot({ includeCube: false });
    const changed = drawn.index !== state.index;
    if (changed || drawn.cycle !== state.cycle) {
      const cube = playback.snapshot().cube;
      const scene = root.querySelector(".cube-scene");
      if (!drawn.pieces) {
        scene.innerHTML = cubeScene(cube);
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
          sticker.style.setProperty("--sticker", palette[color]);
        }
      }
      const move = state.move ? moveGeometry(state.move) : null;
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
      drawn.index = state.index;
      drawn.cycle = state.cycle;
    }
    const transform = layerTransform(
      state.move,
      reducedMotion ? (state.fraction > 0 ? 1 : 0) : state.fraction,
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
    if (root.dataset.cubeMode === "scramble") return;
    if (drawn.playing !== state.playing) {
      const toggle = root.querySelector('[data-action="cube-toggle"]');
      const label = state.playing ? "Pause" : "Play";
      toggle.innerHTML = icon(state.playing ? "pause" : "play");
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
      drawn.playing = state.playing;
    }
    if (root.dataset.cubeMode === "notation") return;
    // Writing the value property never mutates attributes, so the hold stays quiet.
    const scrubber = root.querySelector(".cube-scrubber");
    const position = String(playback.position());
    if (scrubber.value !== position) scrubber.value = position;
    if (!changed) return;
    const text = state.move
      ? `Move ${state.index + 1} of ${playback.moves.length}: ${state.move}`
      : `Complete · ${playback.moves.length} moves`;
    scrubber.setAttribute("aria-valuetext", text);
    root.querySelector('[data-action="cube-previous"]').disabled =
      state.index === 0;
    root.querySelector('[data-action="cube-next"]').disabled =
      state.index === playback.moves.length;
    root.querySelector(".cube-position").textContent = text;
    root.querySelectorAll("[data-action=cube-seek]").forEach((el, i) => {
      if (i === Math.min(state.index, playback.moves.length - 1))
        el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
  };
}
