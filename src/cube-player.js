import { icon } from "./icons.js";
import { solvedCube, applyAlg, caseCube, tokens } from "./cube.js";
import { createCubePlayback } from "./cube-playback.js";
import { escape } from "./html.js";
export { createCubeRenderer } from "./cube-player-renderer.js";

// Public API: one explicit mode determines both presentation and starting state.
function validateMode(mode, setup) {
  if (!["notation", "algorithm", "scramble", "lesson"].includes(mode))
    throw new Error(`Unknown cube player mode: ${mode}`);
  if (mode === "lesson" && typeof setup !== "string")
    throw new Error("A lesson player needs a setup string");
}

export function createPlayerPlayback(
  { mode, algorithm, setup },
  { reducedMotion = false } = {},
) {
  validateMode(mode, setup);
  const initial =
    mode === "algorithm"
      ? caseCube(algorithm)
      : mode === "scramble" || mode === "lesson"
        ? applyAlg(solvedCube(), mode === "lesson" ? setup : algorithm)
        : solvedCube();
  return createCubePlayback(initial, mode === "scramble" ? "" : algorithm, {
    holdMs: mode === "algorithm" || mode === "lesson" ? 100 : 450,
    loop: mode === "notation",
    autoplay: mode === "notation" && !reducedMotion,
  });
}

function iconControl(action, label, symbol) {
  return `<button class="cube-icon-control" data-action="cube-${action}" aria-label="${label}" title="${label}">${icon(symbol)}</button>`;
}

export function renderCubePlayer({ id, mode, algorithm, setup }) {
  validateMode(mode, setup);
  if (!id) throw new Error("A cube player needs a stable id");
  const notation = mode === "notation",
    preview = mode === "scramble";
  return `<section class="cube-player" aria-label="3D cube player" data-algorithm="${escape(algorithm)}" data-player-id="${escape(id)}" data-cube-mode="${mode}"${mode === "lesson" ? ` data-setup="${escape(setup)}"` : ""}>
    <div class="cube-stage" tabindex="0" role="img" aria-label="Interactive 3D cube. Drag or use arrow keys to change the view."><div class="cube-camera"><div class="cube-scene"></div></div></div>
    ${
      preview
        ? `<div class="cube-controls"><button data-action="cube-view">Reset view</button></div>`
        : notation
          ? `<div class="cube-controls">${iconControl("toggle", "Play", "play")}</div>`
          : `<p class="cube-position"></p><div class="cube-moves" aria-label="Playback moves">${tokens(
              algorithm,
            )
              .map(
                (move, i) =>
                  `<button data-action="cube-seek" data-index="${i}" aria-label="Go to move ${i + 1}: ${escape(move)}">${escape(move)}</button>`,
              )
              .join("")}</div>
    <div class="cube-controls">${iconControl("toggle", "Play", "play")}${iconControl("previous", "Previous move", "previous")}${iconControl("next", "Next move", "next")}${iconControl("reset", "Reset", "restart")}<button data-action="cube-view">Reset view</button></div>`
    }
    <p class="cube-help">Drag to look around · arrow keys change the view${notation ? " · repeats the selected move" : ""}</p>
  </section>`;
}
