import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupFourByFourSecondCenters,
  fourByFourCenterPhase2Diagnostics,
  FOUR_BY_FOUR_CENTER_PHASE2_MOVES,
} from "../packages/cube-engine/scramble/four-by-four-center-phase2.js";
import { groupFourByFourOppositeCenters } from "../packages/cube-engine/scramble/four-by-four-centers.js";
import {
  solvedFourByFourState,
  applyFourByFourMoves,
  sampleFourByFourState,
  fourByFourStateToFacelets,
  FOUR_BY_FOUR_COORDINATES,
  FOUR_BY_FOUR_MOVES,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (x) => () => {
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};
function assertPairs(state) {
  assert.equal(
    state.wingPermutation.reduce(
      (sum, v, i) =>
        sum + state.wingPermutation.slice(i + 1).filter((w) => w < v).length,
      0,
    ) % 2,
    0,
  );
  for (let i = 0; i < 24; i++) {
    const original = solvedFourByFourState().centerColors[i];
    assert.equal(state.centerColors[i] % 3, original % 3);
  }
}
test("complete second-center subgroup graph reaches25740 states with bounded tables", () => {
  assert.deepEqual(fourByFourCenterPhase2Diagnostics(), {
    coordinates: 25740,
    reached: 25740,
    moves: 28,
    maxDepth: 8,
    retainedBytes: 77220,
    initializationScratchBytes: 77220,
  });
  assert.equal(FOUR_BY_FOUR_CENTER_PHASE2_MOVES.length, 28);
  assert.ok(Object.isFrozen(FOUR_BY_FOUR_CENTER_PHASE2_MOVES));
});
test("phase1+phase2 group all three opposite pairs with independent96sticker verification", () => {
  const random = seeded(0x444c2);
  for (let i = 0; i < 30; i++) {
    const setup = Array.from(
      { length: 30 },
      () => FOUR_BY_FOUR_MOVES[random() % 36],
    ).join(" ");
    const initial = applyFourByFourMoves(solvedFourByFourState(), setup);
    const first = groupFourByFourOppositeCenters(initial, { maxNodes: 200000 });
    const grouped = applyFourByFourMoves(initial, first.algorithm),
      copy = structuredClone(grouped);
    const second = groupFourByFourSecondCenters(grouped);
    assert.ok(second.moveCount <= 8);
    assert.deepEqual(grouped, copy);
    const result = applyFourByFourMoves(grouped, second.algorithm);
    assertPairs(result);
    assertNxNOracle(
      fourByFourStateToFacelets(result),
      [setup, first.algorithm, second.algorithm].filter(Boolean).join(" "),
      4,
    );
  }
});
test("uniform sampled centers reach second-stage target without substituting states", () => {
  const randomUint32 = seeded(0x444c20);
  for (let i = 0; i < 30; i++) {
    const target = sampleFourByFourState({ randomUint32 });
    const first = groupFourByFourOppositeCenters(target, { maxNodes: 200000 });
    const grouped = applyFourByFourMoves(target, first.algorithm);
    const second = groupFourByFourSecondCenters(grouped);
    assertPairs(applyFourByFourMoves(grouped, second.algorithm));
  }
});
test("invalid preconditions and cancellation fail explicitly; solved input remains unchanged", () => {
  const solved = solvedFourByFourState();
  assert.deepEqual(groupFourByFourSecondCenters(solved), {
    algorithm: "",
    moveCount: 0,
  });
  assert.throws(
    () => groupFourByFourSecondCenters(applyFourByFourMoves(solved, "Rw")),
    /Group UD/,
  );
  const c = new AbortController();
  c.abort();
  assert.throws(
    () => groupFourByFourSecondCenters(solved, { signal: c.signal }),
    { code: "ABORTED" },
  );
  const bad = structuredClone(solved);
  bad.centerColors.pop();
  assert.throws(() => groupFourByFourSecondCenters(bad));
});

test("wing parity is tracked even when pair colors already occupy their target axes", () => {
  const state = solvedFourByFourState();
  [state.wingPermutation[0], state.wingPermutation[1]] = [
    state.wingPermutation[1],
    state.wingPermutation[0],
  ];
  const result = groupFourByFourSecondCenters(state);
  assert.ok(result.moveCount > 0);
  assertPairs(applyFourByFourMoves(state, result.algorithm));
  assert.deepEqual(
    groupFourByFourSecondCenters(state, { requireEvenWings: false }),
    { algorithm: "", moveCount: 0 },
  );
  assert.throws(() =>
    groupFourByFourSecondCenters(state, { requireEvenWings: "yes" }),
  );
});
