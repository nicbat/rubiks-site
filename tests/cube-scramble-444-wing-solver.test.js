import { test } from "node:test";
import assert from "node:assert/strict";
import { inverse } from "../packages/cube-engine/core/index.js";
import {
  solveFourByFourWings,
  pairFourByFourWings,
  fourByFourWingDiagnostics,
} from "../packages/cube-engine/scramble/four-by-four-wing-solver.js";
import {
  solvedFourByFourState,
  sampleFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
  fourByFourCenterMovePermutation,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { solveThreeByThree } from "../packages/cube-engine/scramble/three-by-three.js";
import {
  reduceFourByFourToThree,
  analyzeFourByFourReduction,
} from "../packages/cube-engine/scramble/four-by-four-reduction.js";
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

test("paired goals preserve arbitrary corners and produce exact independently verified full solutions", async () => {
  const random = seeded(0x444fa17),
    totals = { baseline: 0, paired: 0 },
    seenParity = new Set();
  for (let trial = 0; trial < 40; trial++) {
    const state = sampleFourByFourState({ randomUint32: random });
    state.centerColors = solvedFourByFourState().centerColors;
    if (parity(state.wingPermutation))
      [state.wingPermutation[0], state.wingPermutation[1]] = [
        state.wingPermutation[1],
        state.wingPermutation[0],
      ];
    const before = structuredClone(state),
      result = pairFourByFourWings(state);
    const paired = applyFourByFourMoves(state, result.algorithm);
    const reduced = reduceFourByFourToThree(paired);
    assert.deepEqual(paired.cornerPermutation, state.cornerPermutation);
    assert.deepEqual(paired.cornerOrientation, state.cornerOrientation);
    assert.deepEqual(paired.centerColors, state.centerColors);
    assert.equal(
      parity(reduced.edgePermutation),
      parity(state.cornerPermutation),
    );
    assert.equal(
      reduced.edgeOrientation.reduce((a, b) => a ^ b, 0),
      0,
    );
    seenParity.add(parity(state.cornerPermutation));
    assertCentersFixed(result.algorithm);
    const finish = await solveThreeByThree(reduced, { maxNodes: 50000000 });
    const algorithm = [result.algorithm, finish.algorithm]
      .filter(Boolean)
      .join(" ");
    assert.deepEqual(
      applyFourByFourMoves(state, algorithm),
      solvedFourByFourState(),
    );
    assertNxNOracle(fourByFourStateToFacelets(state), inverse(algorithm, 4), 4);
    assert.deepEqual(state, before);
    const baseline = solveFourByFourWings(state);
    totals.baseline += baseline.moveCount;
    totals.paired += result.moveCount;
    if (!parity(state.cornerPermutation))
      assert.ok(result.moveCount <= baseline.moveCount);
  }
  assert.equal(seenParity.size, 2);
  // A broad move-count improvement guards the actual optimization, without a
  // fragile snapshot of specific scrambles or a machine-dependent timing limit.
  assert.ok(totals.paired < totals.baseline * 0.7, JSON.stringify(totals));
});

test("already legal paired states retain edge permutation and flips without needless moves", () => {
  for (const algorithm of [
    "",
    "R U F",
    "F R B L U2",
    "R2 U D2 F2 L2 B2 U' R2 D",
  ]) {
    const state = applyFourByFourMoves(solvedFourByFourState(), algorithm);
    reduceFourByFourToThree(state);
    assert.deepEqual(pairFourByFourWings(state), {
      algorithm: "",
      cycles: 0,
      moveCount: 0,
    });
    assertNxNOracle(fourByFourStateToFacelets(state), algorithm, 4);
  }
});

test("pairing fixes reduced permutation mismatch but rejects unnormalized odd wing parity", async () => {
  const mismatch = solvedFourByFourState();
  [mismatch.cornerPermutation[0], mismatch.cornerPermutation[1]] = [1, 0];
  assert.equal(
    analyzeFourByFourReduction(mismatch).permutationParityMismatch,
    true,
  );
  const result = pairFourByFourWings(mismatch),
    after = applyFourByFourMoves(mismatch, result.algorithm);
  const target = reduceFourByFourToThree(after);
  assert.equal(parity(target.edgePermutation), 1);
  const finish = await solveThreeByThree(target, { maxNodes: 50000000 });
  assertNxNOracle(
    fourByFourStateToFacelets(mismatch),
    inverse(`${result.algorithm} ${finish.algorithm}`, 4),
    4,
  );
  // UF's two wings are slots3/15; swapping them is one reduced flipped edge.
  const flip = solvedFourByFourState();
  [flip.wingPermutation[3], flip.wingPermutation[15]] = [15, 3];
  assert.equal(analyzeFourByFourReduction(flip).edgeFlipParity, true);
  assert.throws(() => pairFourByFourWings(flip), /odd wing parity/);
  const both = structuredClone(flip);
  both.cornerPermutation = [1, 0, 2, 3, 4, 5, 6, 7];
  assert.equal(
    analyzeFourByFourReduction(both).permutationParityMismatch,
    true,
  );
  assert.throws(() => pairFourByFourWings(both), /odd wing parity/);
});

test("paired selection is deterministic, bounded and never substitutes a target on failure", () => {
  const state = evenWings(seeded(444)),
    before = structuredClone(state);
  const first = pairFourByFourWings(state);
  assert.ok(first.moveCount > 1);
  assert.throws(
    () => pairFourByFourWings(state, { maxMoves: first.moveCount - 1 }),
    (error) =>
      error.code === "GENERATION_FAILED" && /move budget/.test(error.message),
  );
  assert.deepEqual(
    pairFourByFourWings(state, { maxMoves: first.moveCount }),
    first,
  );
  assert.deepEqual(pairFourByFourWings(state), first);
  for (const maxMoves of [0, -1, 0.5, 513, NaN, Infinity, "512"])
    assert.throws(() => pairFourByFourWings(state, { maxMoves }), TypeError);
  assert.throws(
    () =>
      pairFourByFourWings(applyFourByFourMoves(solvedFourByFourState(), "Rw")),
    /Solve centers/,
  );
  assert.deepEqual(state, before);
});
