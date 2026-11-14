import { test } from "node:test";
import assert from "node:assert/strict";
import { solveFourByFourJoint } from "../packages/cube-engine/scramble/four-by-four-joint.js";
import {
  sampleFourByFourState,
  applyFourByFourMoves,
  solvedFourByFourState,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
// The five failures from the original fixed 16-target corpus. Never replace a
// difficult target with another sample or increase its search cap to pass.
let seed = 0x444c0de;
const randomUint32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
};
const targets = Array.from({ length: 16 }, () =>
  sampleFourByFourState({ randomUint32 }),
);
for (const index of [3, 7, 8, 14, 15])
  test(`bounded joint solver reaches original hard target ${index}`, async () => {
    const target = targets[index],
      original = structuredClone(target);
    const result = await solveFourByFourJoint(target, {
      maxNodes: 10000000,
      finishMaxNodes: 50000000,
      wingPairs: 4,
      candidateCount: 8,
      phase3Search: "beam",
    });
    assert.ok(result.nodes <= 10000000);
    assert.ok(result.moveCount <= 80);
    assert.deepEqual(target, original);
    assert.deepEqual(
      applyFourByFourMoves(target, result.algorithm),
      solvedFourByFourState(),
    );
    assertNxNOracle(
      fourByFourStateToFacelets(target),
      inverse(result.algorithm, 4),
      4,
    );
  });
