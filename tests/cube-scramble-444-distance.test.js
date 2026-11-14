import { test } from "node:test";
import assert from "node:assert/strict";
import { isShallowFourByFourState } from "../packages/cube-engine/scramble/four-by-four-distance.js";
import {
  FOUR_BY_FOUR_MOVES,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { CUBE_ORIENTATIONS } from "../packages/cube-engine/scramble/orientation.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";

// Independent notation identity: opposite two-layer blocks rotate the cube.
function expandRotation(rotation) {
  return rotation
    .split(" ")
    .filter(Boolean)
    .flatMap((token) => {
      const [positive, negative] = {
        x: ["Rw", "Lw"],
        y: ["Uw", "Dw"],
        z: ["Fw", "Bw"],
      }[token[0]];
      const suffix = token.slice(1);
      return [
        positive + suffix,
        negative + (suffix === "2" ? "2" : suffix === "'" ? "" : "'"),
      ];
    })
    .join(" ");
}
test("4x4 shallow exclusion covers every face/block turn and all 24 orientations", () => {
  for (const rotation of CUBE_ORIENTATIONS) {
    for (const move of ["", ...FOUR_BY_FOUR_MOVES]) {
      const algorithm = [move, expandRotation(rotation)]
        .filter(Boolean)
        .join(" ");
      const state = applyFourByFourMoves(solvedFourByFourState(), algorithm);
      assert.equal(isShallowFourByFourState(state), true, algorithm);
      assertNxNOracle(
        fourByFourStateToFacelets(state),
        [move, rotation].filter(Boolean).join(" "),
        4,
      );
    }
  }
});
test("4x4 shallow exclusion accepts genuine two-turn states, isolates input and rejects malformed states", () => {
  for (const algorithm of ["R U", "Rw U", "Rw Fw", "R L", "Rw Uw2", "Rw R'"]) {
    for (const rotation of CUBE_ORIENTATIONS) {
      const state = applyFourByFourMoves(
        solvedFourByFourState(),
        [algorithm, expandRotation(rotation)].filter(Boolean).join(" "),
      );
      const original = structuredClone(state);
      assert.equal(
        isShallowFourByFourState(state),
        false,
        `${algorithm} ${rotation}`,
      );
      assert.deepEqual(state, original);
    }
  }
  assert.throws(() => isShallowFourByFourState({}));
  const state = solvedFourByFourState();
  assert.equal(isShallowFourByFourState(state), true);
  state.centerColors.fill(0);
  assert.throws(() => isShallowFourByFourState(state));
  assert.equal(isShallowFourByFourState(solvedFourByFourState()), true);
});
