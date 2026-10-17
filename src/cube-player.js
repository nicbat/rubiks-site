import { displayCube } from "./display-colors.js";
import { solvedCube, applyAlg, caseCube } from "./cube.js";
import { createCubePlayback } from "./cube-playback.js";
export { createCubeRenderer } from "./cube-player-renderer.js";

// Public API: one explicit mode determines both presentation and starting state.
export function validateMode(mode, setup) {
  if (!["notation", "algorithm", "scramble", "lesson"].includes(mode))
    throw new Error(`Unknown cube player mode: ${mode}`);
  if (mode === "lesson" && typeof setup !== "string")
    throw new Error("A lesson player needs a setup string");
}

export function createPlayerPlayback(
  { mode, algorithm, setup, top },
  { reducedMotion = false } = {},
) {
  validateMode(mode, setup);
  const initial =
    mode === "algorithm"
      ? displayCube(caseCube(algorithm), top)
      : mode === "scramble" || mode === "lesson"
        ? applyAlg(solvedCube(), mode === "lesson" ? setup : algorithm)
        : solvedCube();
  return createCubePlayback(initial, mode === "scramble" ? "" : algorithm, {
    holdMs: mode === "algorithm" || mode === "lesson" ? 100 : 450,
    loop: mode === "notation",
    autoplay: mode === "notation" && !reducedMotion,
  });
}

export function playerViewMode(id, mode, setup) {
  validateMode(mode, setup);
  if (!id) throw new Error("A cube player needs a stable id");
  return mode;
}
