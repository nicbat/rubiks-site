import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import {
  FOUR_BY_FOUR_COORDINATES,
  FOUR_BY_FOUR_MOVES,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { THREE_BY_THREE_COORDINATES } from "../packages/cube-engine/scramble/three-by-three.js";
import {
  analyzeFourByFourReduction,
  reduceFourByFourToThree,
} from "../packages/cube-engine/scramble/four-by-four-reduction.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const puzzle = await cube3x3x3.kpuzzle();
const identity = (n) => Array.from({ length: n }, (_, i) => i);
const zero = (n) => new Array(n).fill(0);
const solvedTarget = () => ({
  cornerPermutation: identity(8),
  cornerOrientation: zero(8),
  edgePermutation: identity(12),
  edgeOrientation: zero(12),
});
function oracle(algorithm) {
  const { CORNERS, EDGES } = puzzle
    .defaultPattern()
    .applyAlg(algorithm).patternData;
  return {
    cornerPermutation: CORNERS.pieces,
    cornerOrientation: CORNERS.orientation,
    edgePermutation: EDGES.pieces,
    edgeOrientation: EDGES.orientation,
  };
}
function flippedUF() {
  const state = solvedFourByFourState();
  // Literal coordinates: FU at(-.5,1.5,1.5), UF at(.5,1.5,1.5).
  assert.deepEqual(FOUR_BY_FOUR_COORDINATES.wings[3].faces, ["F", "U"]);
  assert.deepEqual(FOUR_BY_FOUR_COORDINATES.wings[15].faces, ["U", "F"]);
  [state.wingPermutation[3], state.wingPermutation[15]] = [15, 3];
  return state;
}
function swappedUFUR() {
  const state = solvedFourByFourState();
  // Both wings move, preserving each destination edge's ordered colors.
  state.wingPermutation[3] = 23;
  state.wingPermutation[15] = 22;
  state.wingPermutation[22] = 15;
  state.wingPermutation[23] = 3;
  return state;
}

test("reduction shares immutable 3x3 coordinate labels and returns detached solved target", () => {
  assert.ok(Object.isFrozen(THREE_BY_THREE_COORDINATES));
  assert.ok(Object.isFrozen(THREE_BY_THREE_COORDINATES.edges));
  assert.ok(Object.isFrozen(THREE_BY_THREE_COORDINATES.corners));
  const state = solvedFourByFourState();
  for (const value of Object.values(state)) Object.freeze(value);
  Object.freeze(state);
  const target = reduceFourByFourToThree(state);
  assert.deepEqual(target, solvedTarget());
  target.cornerPermutation.reverse();
  target.edgeOrientation[0] = 1;
  assert.deepEqual(reduceFourByFourToThree(state), solvedTarget());
});

test("all 18 outer moves and seeded chains match independent exact 3x3 orbit coordinates", () => {
  const moves = FOUR_BY_FOUR_MOVES.filter((move) => !move.includes("w"));
  let seed = 0x444333;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const algorithms = [
    "",
    ...moves,
    ...Array.from({ length: 60 }, () =>
      Array.from({ length: 40 }, () => moves[random() % moves.length]).join(
        " ",
      ),
    ),
  ];
  for (const algorithm of algorithms) {
    const state = applyFourByFourMoves(solvedFourByFourState(), algorithm);
    assert.deepEqual(
      reduceFourByFourToThree(state),
      oracle(algorithm),
      algorithm,
    );
  }
});

test("unsolved centers and unpaired wings are explicit structural failures", () => {
  const centers = applyFourByFourMoves(solvedFourByFourState(), "Rw");
  assert.throws(
    () => analyzeFourByFourReduction(centers),
    (error) => error.code === "CENTERS_UNSOLVED" && error.slots.length > 0,
  );
  const wings = solvedFourByFourState();
  [wings.wingPermutation[3], wings.wingPermutation[23]] = [23, 3];
  assert.throws(
    () => reduceFourByFourToThree(wings),
    (error) =>
      error.code === "WINGS_UNPAIRED" &&
      JSON.stringify(error.edgeSlots) === "[0,1]",
  );
});

test("one flipped reduced edge is diagnosed without repairing the exact target", () => {
  const state = flippedUF(),
    before = structuredClone(state);
  const result = analyzeFourByFourReduction(state);
  assert.deepEqual(result, {
    target: { ...solvedTarget(), edgeOrientation: [1, ...zero(11)] },
    edgeFlipParity: true,
    permutationParityMismatch: false,
  });
  assert.throws(() => reduceFourByFourToThree(state), {
    code: "EDGE_FLIP_PARITY",
    edgeFlipParity: true,
    permutationParityMismatch: false,
  });
  assert.deepEqual(state, before);
});

test("two swapped paired edges and simultaneous parity have separate exact diagnostics", () => {
  const state = swappedUFUR();
  const expected = {
    ...solvedTarget(),
    edgePermutation: [1, 0, ...identity(12).slice(2)],
  };
  assert.deepEqual(analyzeFourByFourReduction(state), {
    target: expected,
    edgeFlipParity: false,
    permutationParityMismatch: true,
  });
  assert.throws(() => reduceFourByFourToThree(state), {
    code: "PERMUTATION_PARITY",
    edgeFlipParity: false,
    permutationParityMismatch: true,
  });
  [state.wingPermutation[3], state.wingPermutation[15]] = [
    state.wingPermutation[15],
    state.wingPermutation[3],
  ];
  assert.deepEqual(analyzeFourByFourReduction(state), {
    target: { ...expected, edgeOrientation: [1, ...zero(11)] },
    edgeFlipParity: true,
    permutationParityMismatch: true,
  });
  assert.throws(() => reduceFourByFourToThree(state), {
    code: "BOTH_PARITIES",
    edgeFlipParity: true,
    permutationParityMismatch: true,
  });
});

test("a concrete wide-move parity fixture matches independent 96 stickers and literal reduced swap", () => {
  const algorithm = "Rw2 R2 U2 Rw2 R2 Uw2 Rw2 R2 Uw2 U2";
  const state = applyFourByFourMoves(solvedFourByFourState(), algorithm);
  assertNxNOracle(fourByFourStateToFacelets(state), algorithm, 4);
  assert.deepEqual(analyzeFourByFourReduction(state), {
    target: {
      ...solvedTarget(),
      edgePermutation: [2, 1, 0, ...identity(12).slice(3)],
    },
    edgeFlipParity: false,
    permutationParityMismatch: true,
  });
  for (const move of ["R", "F2", "U'", "L B D"]) {
    const moved = analyzeFourByFourReduction(applyFourByFourMoves(state, move));
    assert.equal(moved.edgeFlipParity, false);
    assert.equal(moved.permutationParityMismatch, true);
  }
});

test("two flipped edges are legal 3x3 coordinates rather than a false parity rejection", () => {
  const state = flippedUF();
  [state.wingPermutation[22], state.wingPermutation[23]] = [23, 22];
  assert.deepEqual(reduceFourByFourToThree(state), {
    ...solvedTarget(),
    edgeOrientation: [1, 1, ...zero(10)],
  });
});

test("malformed permutations, orientation sums and extra fields fail before reduction", () => {
  for (const change of [
    (state) => (state.wingPermutation[0] = state.wingPermutation[1]),
    (state) => (state.cornerOrientation[0] = 1),
    (state) => state.cornerPermutation.pop(),
    (state) => (state.extra = true),
    (state) => delete state.centerColors[0],
  ]) {
    const state = solvedFourByFourState();
    change(state);
    assert.throws(() => analyzeFourByFourReduction(state), TypeError);
  }
});
