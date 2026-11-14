import { test } from "node:test";
import assert from "node:assert/strict";
import { solveFourByFourJoint } from "../packages/cube-engine/scramble/four-by-four-joint.js";
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  fourByFourStateToFacelets,
  sampleFourByFourState,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const options = { maxNodes: 100000, finishMaxNodes: 50000000 };
test("experimental joint pipeline solves exact subgroup targets with independent stickers", async () => {
  for (const setup of ["", "Rw2 F U2 Lw2", "F U R' B2 L D'"]) {
    const state = applyFourByFourMoves(solvedFourByFourState(), setup),
      original = structuredClone(state);
    const result = await solveFourByFourJoint(state, options);
    assert.deepEqual(
      applyFourByFourMoves(state, result.algorithm),
      solvedFourByFourState(),
    );
    assertNxNOracle(
      fourByFourStateToFacelets(state),
      inverse(result.algorithm, 4),
      4,
    );
    assert.deepEqual(state, original);
    assert.equal(result.stageLengths.length, 4);
  }
});
test("experimental joint pipeline validates budgets and retains target on exhaustion", async () => {
  let seed = 444;
  const state = sampleFourByFourState({
      randomUint32: () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return seed >>> 0;
      },
    }),
    original = structuredClone(state);
  await assert.rejects(
    solveFourByFourJoint(state, { ...options, maxNodes: 1 }),
    { code: "JOINT_PHASE2_SEARCH_LIMIT" },
  );
  assert.deepEqual(state, original);
  for (const invalid of [
    {},
    { ...options, maxNodes: 0 },
    { ...options, finishMaxNodes: 0 },
    { ...options, maxMoves: 513 },
  ])
    await assert.rejects(solveFourByFourJoint(state, invalid), TypeError);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    solveFourByFourJoint(state, { ...options, signal: controller.signal }),
    { name: "AbortError" },
  );
  await assert.rejects(
    solveFourByFourJoint(
      applyFourByFourMoves(solvedFourByFourState(), "R U F"),
      { ...options, maxMoves: 1 },
    ),
    { code: "FOUR_BY_FOUR_LENGTH_LIMIT" },
  );
});
