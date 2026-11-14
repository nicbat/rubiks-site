import { test } from "node:test";
import assert from "node:assert/strict";
import { solveFourByFourCentersStaged } from "../packages/cube-engine/scramble/four-by-four-center-staged.js";
import {
  solvedFourByFourState,
  sampleFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
  FOUR_BY_FOUR_MOVES,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const parity = (p) =>
  p.reduce((n, v, i) => n + p.slice(i + 1).filter((w) => w < v).length, 0) % 2;
function seeded(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}
test("staged centers solve arbitrary colorings within the fixed corpus budget and establish even wings", () => {
  const randomUint32 = seeded(0x444ce);
  const seen = new Set();
  for (let i = 0; i < 128; i++) {
    const state = sampleFourByFourState({ randomUint32 });
    seen.add(parity(state.wingPermutation));
    const original = structuredClone(state);
    const result = solveFourByFourCentersStaged(state);
    const after = applyFourByFourMoves(state, result.algorithm);
    assert.deepEqual(after.centerColors, solvedFourByFourState().centerColors);
    assert.equal(parity(after.wingPermutation), 0);
    assert.ok(result.moveCount <= 32);
    assert.deepEqual(state, original);
  }
  assert.equal(seen.size, 2);
});
test("all three center stages preserve independent sticker semantics and handle invalid/aborted input", () => {
  const random = seeded(0x444ce01);
  for (let i = 0; i < 24; i++) {
    const setup = Array.from(
      { length: 40 },
      () => FOUR_BY_FOUR_MOVES[random() % 36],
    ).join(" ");
    const state = applyFourByFourMoves(solvedFourByFourState(), setup);
    const result = solveFourByFourCentersStaged(state);
    const after = applyFourByFourMoves(state, result.algorithm);
    assertNxNOracle(
      fourByFourStateToFacelets(after),
      `${setup} ${result.algorithm}`.trim(),
      4,
    );
  }
  assert.throws(() => solveFourByFourCentersStaged({}), TypeError);
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      solveFourByFourCentersStaged(solvedFourByFourState(), {
        signal: controller.signal,
      }),
    { name: "AbortError" },
  );
});
