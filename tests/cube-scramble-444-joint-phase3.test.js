import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFourByFourJointPhase3 } from "../packages/cube-engine/scramble/four-by-four-joint-phase3.js";
import {
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { FOUR_BY_FOUR_PHASE3_MOVES } from "../packages/cube-engine/scramble/four-by-four-joint-coordinates.js";
import { reduceFourByFourToThree } from "../packages/cube-engine/scramble/four-by-four-reduction.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (x) => () => {
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};
test("joint phase3 subgroup fixtures produce exact independently checked reducible endpoints", () => {
  const random = seeded(0x444333);
  const setups = [
    "Rw2 U2 Fw2 D2",
    ...Array.from({ length: 20 }, () =>
      Array.from(
        { length: 6 },
        () => FOUR_BY_FOUR_PHASE3_MOVES[random() % 20],
      ).join(" "),
    ),
  ];
  for (const wingPairs of [3, 4])
    for (const setup of setups) {
      const state = applyFourByFourMoves(solvedFourByFourState(), setup),
        copy = structuredClone(state),
        budget = { nodes: 31, maxNodes: 1000000 };
      const result = searchFourByFourJointPhase3(state, {
        budget,
        maxDepth: 6,
        wingPairs,
      });
      assert.ok(result.moveCount <= 6);
      assert.equal(budget.nodes, 31 + result.nodes);
      assert.deepEqual(state, copy);
      assert.deepEqual(
        result.state,
        applyFourByFourMoves(state, result.algorithm),
      );
      assert.deepEqual(result.target, reduceFourByFourToThree(result.state));
      assert.deepEqual(
        result.state.centerColors,
        solvedFourByFourState().centerColors,
      );
      assertNxNOracle(
        fourByFourStateToFacelets(result.state),
        [setup, result.algorithm].filter(Boolean).join(" "),
        4,
      );
    }
});
test("node and depth budgets fail explicitly without replacing or mutating the target", () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Rw2 U2 Fw2 D2"),
    copy = structuredClone(state);
  const budget = { nodes: 9, maxNodes: 9 };
  assert.throws(() => searchFourByFourJointPhase3(state, { budget }), {
    code: "JOINT_PHASE3_SEARCH_LIMIT",
  });
  assert.equal(budget.nodes, 9);
  assert.throws(
    () =>
      searchFourByFourJointPhase3(state, {
        budget: { nodes: 0, maxNodes: 100 },
        maxDepth: 0,
      }),
    { code: "JOINT_PHASE3_DEPTH_LIMIT" },
  );
  assert.deepEqual(state, copy);
});
test("strict preconditions, cancellation, solved state and malformed bounds", () => {
  const solved = solvedFourByFourState();
  const result = searchFourByFourJointPhase3(solved, {
    budget: { nodes: 0, maxNodes: 1 },
    maxDepth: 0,
  });
  assert.equal(result.algorithm, "");
  assert.equal(result.nodes, 1);
  for (const options of [
    {},
    { budget: { nodes: -1, maxNodes: 10 } },
    { budget: { nodes: 0, maxNodes: 0 } },
    { budget: { nodes: 0, maxNodes: 10 }, maxDepth: 33 },
    { budget: { nodes: 0, maxNodes: 10 }, maxDepth: 1.1 },
    { budget: { nodes: 0, maxNodes: 10 }, wingPairs: 5 },
  ])
    assert.throws(
      () => searchFourByFourJointPhase3(solved, options),
      TypeError,
    );
  assert.throws(
    () =>
      searchFourByFourJointPhase3(applyFourByFourMoves(solved, "Uw"), {
        budget: { nodes: 0, maxNodes: 10 },
      }),
    /boundary/,
  );
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      searchFourByFourJointPhase3(solved, {
        budget: { nodes: 0, maxNodes: 10 },
        signal: controller.signal,
      }),
    { name: "AbortError" },
  );
});
