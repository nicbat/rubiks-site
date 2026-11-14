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

test("candidate portfolio charges every bounded attempt and reports aggregate exhaustion", async () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Rw2 U2 Fw2 D2"),
    copy = structuredClone(state);
  let nodeFailure;
  await assert.rejects(
    solveFourByFourJoint(state, {
      ...options,
      candidateCount: 3,
      perCandidateMaxNodes: 1,
    }),
    (error) => {
      nodeFailure = error;
      assert.equal(error.code, "JOINT_SEARCH_EXHAUSTED");
      assert.equal(error.attempts.length, 3);
      assert.equal(error.candidateCount, 3);
      assert.ok(
        error.attempts.every(
          (attempt) =>
            attempt.status === "JOINT_PHASE3_SEARCH_LIMIT" &&
            attempt.nodes === 1,
        ),
      );
      assert.ok(error.nodes <= options.maxNodes);
      return true;
    },
  );
  await assert.rejects(
    solveFourByFourJoint(state, {
      ...options,
      candidateCount: 3,
      phase3MaxDepth: 0,
    }),
    (error) => {
      assert.equal(error.code, "JOINT_SEARCH_EXHAUSTED");
      assert.equal(error.attempts.length, 3);
      assert.ok(
        error.attempts.every(
          (attempt) =>
            attempt.status === "JOINT_PHASE3_DEPTH_LIMIT" &&
            attempt.nodes === 0,
        ),
      );
      assert.equal(nodeFailure.nodes - error.nodes, 3);
      return true;
    },
  );
  assert.deepEqual(state, copy);
  const result = await solveFourByFourJoint(state, {
    ...options,
    candidateCount: 3,
  });
  assert.equal(result.candidateCount, 3);
  assert.equal(result.attempts.at(-1).status, "solved");
  assert.ok(
    result.attempts.every(
      (attempt, i) => i === 0 || attempt.score >= result.attempts[i - 1].score,
    ),
  );
  assertNxNOracle(
    fourByFourStateToFacelets(state),
    inverse(result.algorithm, 4),
    4,
  );
});
test("portfolio options are finite, strict, and preserve single-candidate compatibility", async () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Rw2 F U2 Lw2");
  for (const extra of [
    { candidateCount: 0 },
    { candidateCount: 33 },
    { perCandidateMaxNodes: 0 },
    { phase2MaxDepth: 33 },
    { phase3MaxDepth: -1 },
    { wingPairs: 5 },
  ])
    await assert.rejects(
      solveFourByFourJoint(state, { ...options, ...extra }),
      TypeError,
    );
  const result = await solveFourByFourJoint(state, {
    ...options,
    candidateCount: 1,
  });
  assert.equal(result.candidateCount, 1);
  assert.equal(result.attempts.length, 1);
  assert.deepEqual(
    applyFourByFourMoves(state, result.algorithm),
    solvedFourByFourState(),
  );
});
test("bounded beam pipeline reaches independently verified random targets without changing their state", async () => {
  let seed = 0x444c0de;
  const randomUint32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const state = sampleFourByFourState({ randomUint32 }),
    original = structuredClone(state);
  const result = await solveFourByFourJoint(state, {
    ...options,
    maxNodes: 10000000,
    candidateCount: 1,
    wingPairs: 4,
    phase3Search: "beam",
  });
  assert.ok(result.moveCount <= 70);
  assertNxNOracle(
    fourByFourStateToFacelets(state),
    inverse(result.algorithm, 4),
    4,
  );
  assert.deepEqual(
    applyFourByFourMoves(state, result.algorithm),
    solvedFourByFourState(),
  );
  assert.deepEqual(state, original);
  for (const invalid of [
    { phase3Search: "unknown" },
    { beamWidth: 0 },
    { beamWidth: 4097 },
  ])
    await assert.rejects(
      solveFourByFourJoint(state, { ...options, ...invalid }),
      TypeError,
    );
});
