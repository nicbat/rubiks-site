import { test } from "node:test";
import assert from "node:assert/strict";
import { inverse } from "../packages/cube-engine/core/index.js";
import {
  solveFourByFourWings,
  fourByFourWingDiagnostics,
} from "../packages/cube-engine/scramble/four-by-four-wing-solver.js";
import {
  solvedFourByFourState,
  sampleFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
  fourByFourCenterMovePermutation,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (initial) => {
  let x = initial;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
};
const parity = (values) =>
  values.reduce(
    (sum, v, i) => sum + values.slice(i + 1).filter((w) => w < v).length,
    0,
  ) % 2;
function evenWings(randomUint32) {
  const state = solvedFourByFourState();
  state.wingPermutation = sampleFourByFourState({
    randomUint32,
  }).wingPermutation;
  if (parity(state.wingPermutation))
    [state.wingPermutation[0], state.wingPermutation[1]] = [
      state.wingPermutation[1],
      state.wingPermutation[0],
    ];
  return state;
}
function assertCentersFixed(algorithm) {
  let centers = Array.from({ length: 24 }, (_, i) => i);
  for (const move of algorithm.split(" ").filter(Boolean))
    centers = fourByFourCenterMovePermutation(move).map((i) => centers[i]);
  assert.deepEqual(
    centers,
    Array.from({ length: 24 }, (_, i) => i),
  );
}

test("complete wing routing is bounded and identity requires no moves", () => {
  assert.deepEqual(fourByFourWingDiagnostics(), {
    reachableTriples: 12144,
    maximumSetupDepth: 5,
    retainedBytes: 41472,
    queueBytes: 24288,
  });
  const first = fourByFourWingDiagnostics();
  first.reachableTriples = 0;
  assert.equal(fourByFourWingDiagnostics().reachableTriples, 12144);
  assert.deepEqual(solveFourByFourWings(solvedFourByFourState()), {
    algorithm: "",
    cycles: 0,
    moveCount: 0,
  });
});

test("arbitrary even sampled wings solve with exact independent 96-sticker verification", () => {
  const random = seeded(0x444c1c1e);
  for (let trial = 0; trial < 80; trial++) {
    const state = evenWings(random),
      before = structuredClone(state);
    const result = solveFourByFourWings(state);
    assert.ok(result.cycles <= 22);
    assert.ok(result.moveCount <= 512);
    assert.deepEqual(
      applyFourByFourMoves(state, result.algorithm),
      solvedFourByFourState(),
    );
    // The original sampled target must equal the independent oracle's inverse
    // solution on all 96 stickers, not merely our own move/inverse consistency.
    assertNxNOracle(
      fourByFourStateToFacelets(state),
      inverse(result.algorithm, 4),
      4,
    );
    assertCentersFixed(result.algorithm);
    assert.deepEqual(state, before);
  }
});

test("paired-slot triples and disjoint transpositions are covered, with corners untouched", () => {
  for (const cycle of [
    [0, 12, 1],
    [6, 7, 23],
    [1, 13, 21],
    [0, 1, 2],
  ]) {
    const state = applyFourByFourMoves(solvedFourByFourState(), "R U F");
    state.wingPermutation = solvedFourByFourState().wingPermutation;
    cycle.forEach(
      (slot, i) => (state.wingPermutation[slot] = cycle[(i + 1) % 3]),
    );
    const result = solveFourByFourWings(state),
      after = applyFourByFourMoves(state, result.algorithm);
    assert.deepEqual(
      after.wingPermutation,
      solvedFourByFourState().wingPermutation,
    );
    assert.deepEqual(after.cornerPermutation, state.cornerPermutation);
    assert.deepEqual(after.cornerOrientation, state.cornerOrientation);
    assert.deepEqual(after.centerColors, state.centerColors);
    assertCentersFixed(result.algorithm);
  }
  const state = solvedFourByFourState();
  for (let i = 0; i < 24; i += 2)
    [state.wingPermutation[i], state.wingPermutation[i + 1]] = [i + 1, i];
  const result = solveFourByFourWings(state);
  assert.deepEqual(
    applyFourByFourMoves(state, result.algorithm),
    solvedFourByFourState(),
  );
  assertNxNOracle(
    fourByFourStateToFacelets(state),
    inverse(result.algorithm, 4),
    4,
  );
});

test("wing stage fails explicitly on wrong phase, odd parity, invalid inputs and move budgets", () => {
  const odd = solvedFourByFourState();
  [odd.wingPermutation[0], odd.wingPermutation[1]] = [1, 0];
  assert.throws(() => solveFourByFourWings(odd), /odd wing parity/);
  assert.throws(
    () =>
      solveFourByFourWings(applyFourByFourMoves(solvedFourByFourState(), "Rw")),
    /Solve centers/,
  );
  const malformed = solvedFourByFourState();
  malformed.wingPermutation[0] = 1;
  assert.throws(() => solveFourByFourWings(malformed));
  const state = evenWings(seeded(444)),
    before = structuredClone(state);
  for (const maxMoves of [0, -1, 0.5, 513, NaN, Infinity, "512"])
    assert.throws(() => solveFourByFourWings(state, { maxMoves }), TypeError);
  const result = solveFourByFourWings(state);
  assert.throws(
    () => solveFourByFourWings(state, { maxMoves: result.moveCount - 1 }),
    (error) =>
      error.code === "GENERATION_FAILED" && /move budget/.test(error.message),
  );
  assert.deepEqual(
    solveFourByFourWings(state, { maxMoves: result.moveCount }),
    result,
  );
  assert.deepEqual(state, before);
});
