import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFourByFourJointPhase2 } from "../packages/cube-engine/scramble/four-by-four-joint-phase2.js";
import { solveFourByFourJoint } from "../packages/cube-engine/scramble/four-by-four-joint.js";
import {
  sampleFourByFourState,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { groupFourByFourOppositeCenters } from "../packages/cube-engine/scramble/four-by-four-centers.js";
import { analyzeFourByFourJointBoundary } from "../packages/cube-engine/scramble/four-by-four-joint-coordinates.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
function sampleAt(index) {
  let seed = 0x444c0de;
  const randomUint32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  let state;
  for (let i = 0; i <= index; i++)
    state = sampleFourByFourState({ randomUint32 });
  return state;
}

test("optional collection threshold returns verified partial candidates while strict default still throws", () => {
  const state = solvedFourByFourState();
  assert.throws(
    () =>
      searchFourByFourJointPhase2(state, {
        budget: { nodes: 0, maxNodes: 1 },
        maxCandidates: 8,
      }),
    { code: "JOINT_PHASE2_SEARCH_LIMIT" },
  );
  const budget = { nodes: 100, maxNodes: 101 };
  const r = searchFourByFourJointPhase2(state, {
    budget,
    maxCandidates: 8,
    collectionNodes: 1,
  });
  assert.equal(r.complete, false);
  assert.equal(r.stopReason, "collection");
  assert.equal(r.nodes, 1);
  assert.equal(r.candidates.length, 1);
  assert.equal(budget.nodes, 101);
  assert.ok(analyzeFourByFourJointBoundary(r.candidates[0].state).eligible);
  for (const value of [0, -1, 1.5, Infinity, NaN])
    assert.throws(
      () =>
        searchFourByFourJointPhase2(state, {
          budget: { nodes: 0, maxNodes: 10 },
          collectionNodes: value,
        }),
      TypeError,
    );
});

test("soft collection threshold never prevents finding the first candidate or conceals hard exhaustion", () => {
  const target = sampleAt(0),
    first = groupFourByFourOppositeCenters(target, { maxNodes: 1470942 }),
    state = applyFourByFourMoves(target, first.algorithm);
  assert.throws(
    () =>
      searchFourByFourJointPhase2(state, {
        budget: { nodes: 0, maxNodes: 1 },
        collectionNodes: 1,
      }),
    { code: "JOINT_PHASE2_SEARCH_LIMIT" },
  );
  const strict = searchFourByFourJointPhase2(state, {
    budget: { nodes: 0, maxNodes: 1000000 },
    maxCandidates: 1,
  });
  const partial = searchFourByFourJointPhase2(state, {
    budget: { nodes: 0, maxNodes: 1000000 },
    collectionNodes: 1,
  });
  assert.ok(partial.nodes > 1);
  assert.equal(partial.nodes, strict.nodes);
  assert.deepEqual(partial.candidates, strict.candidates);
  assert.equal(partial.stopReason, "collection");
});

test("qualification target 879 retains a candidate and solves within the unchanged 10M joint budget", async () => {
  // Before the fix, collecting eight phase2 candidates exhausted all 10M nodes
  // despite first and second valid candidates at 3,958,248 and 3,958,249 nodes.
  const target = sampleAt(879),
    before = structuredClone(target);
  const result = await solveFourByFourJoint(target, {
    maxNodes: 10000000,
    finishMaxNodes: 50000000,
    candidateCount: 8,
    wingPairs: 4,
    phase3Search: "beam",
    phase3MaxDepth: 32,
    beamWidth: 1024,
    maxMoves: 512,
  });
  assert.ok(result.candidateCount > 0 && result.candidateCount < 8);
  assert.ok(result.nodes <= 10000000);
  assert.ok(result.finishNodes <= 50000000);
  assert.ok(result.moveCount <= 512);
  assert.deepEqual(
    applyFourByFourMoves(target, result.algorithm),
    solvedFourByFourState(),
  );
  assertNxNOracle(
    fourByFourStateToFacelets(target),
    inverse(result.algorithm, 4),
    4,
  );
  assert.deepEqual(target, before);
});
