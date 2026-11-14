import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchFourByFourJointPhase2,
  fourByFourJointPhase2Diagnostics,
} from "../packages/cube-engine/scramble/four-by-four-joint-phase2.js";
import {
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
  sampleFourByFourState,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { groupFourByFourOppositeCenters } from "../packages/cube-engine/scramble/four-by-four-centers.js";
import { analyzeFourByFourJointBoundary } from "../packages/cube-engine/scramble/four-by-four-joint-coordinates.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (x) => () => {
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};
test("complete joint center projection covers1801800 states within fixed allocations", () => {
  assert.deepEqual(fourByFourJointPhase2Diagnostics(), {
    coordinates: 1801800,
    reached: 1801800,
    maximumDistance: 9,
    retainedTypedBytes: 2655836,
    queueBytes: 7207200,
  });
});
test("bounded eligible leaves preserve exact independently checked96sticker targets", () => {
  for (const setup of [
    "Uw R Fw2 D Lw2",
    "R Uw F2 Dw' L B2",
    "Rw2 U Fw2 D R2 Uw",
  ]) {
    const state = applyFourByFourMoves(solvedFourByFourState(), setup),
      copy = structuredClone(state),
      budget = { nodes: 17, maxNodes: 1000000 };
    const result = searchFourByFourJointPhase2(state, {
      budget,
      maxCandidates: 2,
      maxDepth: 10,
    });
    assert.equal(result.stopReason, "count");
    assert.equal(result.complete, true);
    assert.equal(result.candidates.length, 2);
    assert.equal(budget.nodes, 17 + result.nodes);
    assert.ok(budget.nodes <= budget.maxNodes);
    assert.deepEqual(state, copy);
    for (const candidate of result.candidates) {
      assert.equal(
        analyzeFourByFourJointBoundary(candidate.state).eligible,
        true,
      );
      assert.deepEqual(
        applyFourByFourMoves(state, candidate.algorithm),
        candidate.state,
      );
      assertNxNOracle(
        fourByFourStateToFacelets(candidate.state),
        `${setup} ${candidate.algorithm}`.trim(),
        4,
      );
    }
  }
});
test("actual wings are checked after a uniformly sampled first-stage target", () => {
  const target = sampleFourByFourState({ randomUint32: seeded(444) });
  const first = groupFourByFourOppositeCenters(target, { maxNodes: 200000 });
  const state = applyFourByFourMoves(target, first.algorithm),
    copy = structuredClone(state);
  const result = searchFourByFourJointPhase2(state, {
    budget: { nodes: 0, maxNodes: 1000000 },
    maxCandidates: 1,
    maxDepth: 10,
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(
    analyzeFourByFourJointBoundary(result.candidates[0].state).eligible,
    true,
  );
  assert.deepEqual(state, copy);
});
test("budget, depth, cancellation and malformed inputs fail or stop explicitly without resampling", () => {
  const solved = solvedFourByFourState(),
    budget = { nodes: 5, maxNodes: 5 };
  assert.throws(
    () => searchFourByFourJointPhase2(solved, { budget, maxCandidates: 1 }),
    { code: "JOINT_PHASE2_SEARCH_LIMIT" },
  );
  assert.equal(budget.nodes, 5);
  const exhausted = searchFourByFourJointPhase2(solved, {
    budget: { nodes: 0, maxNodes: 10 },
    maxCandidates: 2,
    maxDepth: 0,
  });
  assert.equal(exhausted.stopReason, "depth");
  assert.equal(exhausted.complete, false);
  assert.equal(exhausted.candidates.length, 1);
  for (const bad of [
    {},
    { budget: { nodes: -1, maxNodes: 10 } },
    { budget: { nodes: 0, maxNodes: 10 }, maxDepth: 33 },
    { budget: { nodes: 0, maxNodes: 10 }, maxCandidates: 0 },
  ])
    assert.throws(() => searchFourByFourJointPhase2(solved, bad), TypeError);
  assert.throws(
    () =>
      searchFourByFourJointPhase2(applyFourByFourMoves(solved, "Rw"), {
        budget: { nodes: 0, maxNodes: 10 },
      }),
    /grouped UD/,
  );
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      searchFourByFourJointPhase2(solved, {
        budget: { nodes: 0, maxNodes: 10 },
        signal: controller.signal,
      }),
    { name: "AbortError" },
  );
});
