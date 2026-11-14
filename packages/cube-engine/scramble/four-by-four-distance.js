import { applyAlg, solvedCube } from "../core/index.js";
import { CUBE_ORIENTATIONS } from "./orientation.js";
import {
  FOUR_BY_FOUR_MOVES,
  fourByFourStateToFacelets,
} from "./four-by-four-state.js";

const location = (sticker) => `${sticker.p}/${sticker.n}`;
const locations = solvedCube(4).map(location).sort();
function signature(stickers) {
  const colors = new Map(
    stickers.map((sticker) => [location(sticker), sticker.color]),
  );
  return locations.map((key) => colors.get(key)).join("");
}
let shallow;
function shallowStates() {
  if (shallow) return shallow;
  const states = new Set();
  const solved = solvedCube(4);
  // Rotations have zero OBTM cost. Three-layer blocks are the opposite
  // one-layer face turn modulo rotation, so the 36 tokens cover all widths.
  for (const move of ["", ...FOUR_BY_FOUR_MOVES]) {
    const moved = applyAlg(solved, move);
    for (const rotation of CUBE_ORIENTATIONS)
      states.add(signature(applyAlg(moved, rotation)));
  }
  shallow = states;
  return shallow;
}
/** Exact zero/one outer-block-turn exclusion, modulo all 24 proper rotations.
 * This is not a general distance estimator. The private cache is bounded to
 * at most 24 * 37 signatures of 96 face colors, independent of supplied states.
 */
export function isShallowFourByFourState(state) {
  const key = signature(fourByFourStateToFacelets(state));
  return shallowStates().has(key);
}
