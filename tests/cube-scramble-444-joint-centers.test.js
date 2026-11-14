import { test } from "node:test";
import assert from "node:assert/strict";
import { fourByFourJointCenterContext } from "../packages/cube-engine/scramble/four-by-four-joint-centers.js";
import { FOUR_BY_FOUR_PHASE3_MOVES as moves } from "../packages/cube-engine/scramble/four-by-four-joint-coordinates.js";
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { reduceFourByFourToThree } from "../packages/cube-engine/scramble/four-by-four-reduction.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
test("joint center/parity graph covers all117600 coordinates with consistent move distances", () => {
  const c = fourByFourJointCenterContext();
  assert.deepEqual(c.diagnostics, {
    coordinates: 117600,
    reached: 117600,
    maximumDepth: 10,
    retainedTableBytes: 122176,
    queueBytes: 470400,
  });
  for (let i = 0; i < 117600; i++) {
    let descends = i === c.goal;
    for (let m = 0; m < moves.length; m++) {
      const next = c.move(i, m);
      assert.ok(Math.abs(c.distance(i) - c.distance(next)) <= 1);
      if (c.distance(next) === c.distance(i) - 1) descends = true;
    }
    assert.ok(descends);
  }
});
test("joint center transitions match full state and independent stickers for all phase-three moves", () => {
  const c = fourByFourJointCenterContext();
  const setup = "Rw2 F U2 Lw2 B' Uw2 R2 Fw2";
  const state = applyFourByFourMoves(solvedFourByFourState(), setup);
  for (let m = 0; m < moves.length; m++) {
    const next = applyFourByFourMoves(state, moves[m]);
    assert.equal(c.coordinate(next), c.move(c.coordinate(state), m));
    assertNxNOracle(fourByFourStateToFacelets(next), `${setup} ${moves[m]}`, 4);
  }
});
test("joint center parity distinguishes a solved-center PLL obstruction and rejects invalid boundaries", () => {
  const c = fourByFourJointCenterContext();
  const state = solvedFourByFourState();
  [state.cornerPermutation[0], state.cornerPermutation[1]] = [1, 0];
  assert.throws(() => reduceFourByFourToThree(state), {
    code: "PERMUTATION_PARITY",
  });
  assert.notEqual(c.coordinate(state), c.goal);
  assert.ok(c.distance(c.coordinate(state)) > 0);
  assert.throws(
    () => c.coordinate(applyFourByFourMoves(solvedFourByFourState(), "Rw")),
    TypeError,
  );
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => fourByFourJointCenterContext(controller.signal), {
    name: "AbortError",
  });
});
test("joint center parity accepts legal reduced endpoints with either corner parity", () => {
  const c = fourByFourJointCenterContext();
  for (const setup of ["R", "F U R' B2 L D'", "R U R' U' F' U F"]) {
    const state = applyFourByFourMoves(solvedFourByFourState(), setup);
    assert.doesNotThrow(() => reduceFourByFourToThree(state));
    assert.equal(c.coordinate(state), c.goal);
    assertNxNOracle(fourByFourStateToFacelets(state), setup, 4);
    [state.cornerPermutation[0], state.cornerPermutation[1]] = [
      state.cornerPermutation[1],
      state.cornerPermutation[0],
    ];
    assert.throws(() => reduceFourByFourToThree(state), {
      code: "PERMUTATION_PARITY",
    });
    assert.notEqual(c.coordinate(state), c.goal);
  }
});
