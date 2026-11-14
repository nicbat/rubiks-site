import { scramblePalette } from "./scramble-preview.js";
import { icon } from "./icons.js";
import { palette } from "./diagram.js";
import { createCubeRenderer as createGeometryRenderer } from "@last-layer/cube-engine/renderer";

// The package owns geometry; site controls remain in this adapter.
export function createCubeRenderer(root) {
  const drawGeometry = createGeometryRenderer(root, {
    palette: root?.dataset.scrambleUp
      ? scramblePalette({
          up: root.dataset.scrambleUp,
          front: root.dataset.scrambleFront,
        })
      : palette,
  });
  const drawn = {};
  const draw = (playback, view) => {
    if (!root) return;
    drawGeometry(playback, view);
    const state = playback.snapshot({ includeCube: false });
    const changed = drawn.index !== state.index;
    drawn.index = state.index;
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
  draw.destroy = () => {
    drawGeometry.destroy();
    root = null;
  };
  return draw;
}
