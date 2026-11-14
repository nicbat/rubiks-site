import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finishFourByFourCenters,
  fourByFourCenterPhase3Diagnostics,
} from "../packages/cube-engine/scramble/four-by-four-center-phase3.js";
import {
  solvedFourByFourState,
  applyFourByFourMoves,
  FOUR_BY_FOUR_MOVES,
  FOUR_BY_FOUR_COORDINATES,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const moves = FOUR_BY_FOUR_MOVES.filter(
  (move) => !move.includes("w") || move.endsWith("2"),
);
function seeded(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}
test("phase three covers all 343000 grouped center colorings within eleven moves", () => {
  assert.deepEqual(fourByFourCenterPhase3Diagnostics(), {
    coordinates: 343000,
    maximumDepth: 11,
    retainedBytes: 348040,
    queueBytes: 1372000,
  });
  const random = seeded(0x444c3);
  const solved = solvedFourByFourState();
  for (let sample = 0; sample < 256; sample++) {
    const state = solvedFourByFourState();
    for (const pair of [
      ["U", "D"],
      ["R", "L"],
      ["F", "B"],
    ]) {
      const indices = FOUR_BY_FOUR_COORDINATES.centers.flatMap((s, i) =>
        pair.includes(s.faces[0]) ? [i] : [],
      );
      for (let i = indices.length - 1; i > 0; i--) {
        const a = indices[i],
          b = indices[random() % (i + 1)];
        [state.centerColors[a], state.centerColors[b]] = [
          state.centerColors[b],
          state.centerColors[a],
        ];
      }
    }
    const original = structuredClone(state);
    const result = finishFourByFourCenters(state);
    assert.ok(result.moveCount <= 11);
    assert.deepEqual(
      applyFourByFourMoves(state, result.algorithm).centerColors,
      solved.centerColors,
    );
    assert.deepEqual(state, original);
  }
});
test("phase-three physical transitions and solution paths match the independent 96-sticker engine", () => {
  const random = seeded(0x444c311);
  for (const move of moves) {
    const setup = Array.from(
      { length: 30 },
      () => moves[random() % moves.length],
    )
      .concat(move)
      .join(" ");
    const state = applyFourByFourMoves(solvedFourByFourState(), setup);
    const result = finishFourByFourCenters(state);
    const final = applyFourByFourMoves(state, result.algorithm);
    assert.deepEqual(final.centerColors, solvedFourByFourState().centerColors);
    assertNxNOracle(
      fourByFourStateToFacelets(final),
      `${setup} ${result.algorithm}`.trim(),
      4,
    );
  }
});
test("phase three refuses ungrouped/invalid states and aborts before returning even cached solutions", () => {
  assert.throws(
    () =>
      finishFourByFourCenters(
        applyFourByFourMoves(solvedFourByFourState(), "Rw"),
      ),
    TypeError,
  );
  assert.throws(() => finishFourByFourCenters({}), TypeError);
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      finishFourByFourCenters(solvedFourByFourState(), {
        signal: controller.signal,
      }),
    { name: "AbortError" },
  );
});
