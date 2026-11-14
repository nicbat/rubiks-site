import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFourByFourJointBeam } from "../packages/cube-engine/scramble/four-by-four-joint-beam.js";
import {
  sampleFourByFourState,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { groupFourByFourOppositeCenters } from "../packages/cube-engine/scramble/four-by-four-centers.js";
import { searchFourByFourJointPhase2 } from "../packages/cube-engine/scramble/four-by-four-joint-phase2.js";
import { solveThreeByThree } from "../packages/cube-engine/scramble/three-by-three.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
test("beam reduces first uniform corpus target and independently reproduces all96 stickers", async () => {
  let seed = 0x444c0de;
  const randomUint32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const target = sampleFourByFourState({ randomUint32 }),
    copy = structuredClone(target);
  const first = groupFourByFourOppositeCenters(target, { maxNodes: 1470942 });
  const second = searchFourByFourJointPhase2(
    applyFourByFourMoves(target, first.algorithm),
    { budget: { nodes: 0, maxNodes: 1000000 }, maxCandidates: 1 },
  );
  const budget = { nodes: 31, maxNodes: 1000031 };
  const result = searchFourByFourJointBeam(second.candidates[0].state, {
    budget,
  });
  assert.equal(budget.nodes, 31 + result.nodes);
  assert.ok(result.nodes > result.expandedParents);
  assert.ok(result.moveCount <= 32);
  const finish = await solveThreeByThree(result.target, { maxNodes: 50000000 });
  const algorithm = [
    first.algorithm,
    second.candidates[0].algorithm,
    result.algorithm,
    finish.algorithm,
  ].join(" ");
  assertNxNOracle(fourByFourStateToFacelets(target), inverse(algorithm, 4), 4);
  assert.deepEqual(target, copy);
});
test("beam bounds, failure and cancellation preserve supplied state and exact budget", () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Rw2 U2 Fw2"),
    copy = structuredClone(state);
  const budget = { nodes: 7, maxNodes: 8 };
  assert.throws(() => searchFourByFourJointBeam(state, { budget }), {
    code: "JOINT_PHASE3_SEARCH_LIMIT",
  });
  assert.equal(budget.nodes, 8);
  assert.throws(
    () =>
      searchFourByFourJointBeam(state, {
        budget: { nodes: 0, maxNodes: 100 },
        maxDepth: 0,
      }),
    { code: "JOINT_PHASE3_DEPTH_LIMIT" },
  );
  for (const extra of [
    { beamWidth: 0 },
    { beamWidth: 4097 },
    { maxDepth: 33 },
    { wingPairs: 5 },
  ])
    assert.throws(
      () =>
        searchFourByFourJointBeam(state, {
          budget: { nodes: 0, maxNodes: 100 },
          ...extra,
        }),
      TypeError,
    );
  assert.throws(
    () =>
      searchFourByFourJointBeam(state, {
        budget: { nodes: 0, maxNodes: 100 },
        signal: AbortSignal.abort(),
      }),
    { name: "AbortError" },
  );
  assert.throws(
    () =>
      searchFourByFourJointBeam(applyFourByFourMoves(state, "Rw"), {
        budget: { nodes: 0, maxNodes: 100 },
      }),
    TypeError,
  );
  assert.deepEqual(state, copy);
  const solved = searchFourByFourJointBeam(solvedFourByFourState(), {
    budget: { nodes: 1, maxNodes: 1 },
    maxDepth: 0,
  });
  assert.equal(solved.algorithm, "");
  assert.equal(solved.nodes, 0);
});

test("beam accepts a generated goal at the exact child budget boundary", () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Uw2");
  const budget = { nodes: 0, maxNodes: 2 };
  const result = searchFourByFourJointBeam(state, {
    budget,
    maxDepth: 1,
    beamWidth: 1,
  });
  assert.equal(result.nodes, 2);
  assert.equal(result.moveCount, 1);
  assert.deepEqual(result.state, solvedFourByFourState());
  assertNxNOracle(
    fourByFourStateToFacelets(result.state),
    "Uw2 " + result.algorithm,
    4,
  );
});
