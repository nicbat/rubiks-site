import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solveFourByFour,
  generateFourByFour,
} from "../packages/cube-engine/scramble/four-by-four.js";
import {
  sampleFourByFourState,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
function seeded(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}
test("complete 4x4 reduction reaches independently checked sampled targets with both parity cases", async () => {
  const randomUint32 = seeded(0x444f011);
  const parityCases = new Set();
  const parity = (p) =>
    p.reduce((n, v, i) => n + p.slice(i + 1).filter((w) => w < v).length, 0) %
    2;
  for (let i = 0; i < 16; i++) {
    const state = sampleFourByFourState({ randomUint32 });
    parityCases.add(
      `${parity(state.cornerPermutation)}/${parity(state.wingPermutation)}`,
    );
    const original = structuredClone(state);
    const result = await solveFourByFour(state, { maxNodes: 50000000 });
    // Fixed corpus length regression: the earlier constructive solver needed
    // hundreds of moves despite reaching these same exact sampled targets.
    assert.ok(result.moveCount <= 200);
    assert.ok(result.stageLengths[0] <= 32);
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
  }
  assert.deepEqual([...parityCases].sort(), ["0/0", "0/1", "1/0", "1/1"]);
});
test("4x4 solver preserves targets on length/node limits and honors cancellation", async () => {
  const state = sampleFourByFourState({ randomUint32: seeded(0x444bad) });
  const original = structuredClone(state);
  await assert.rejects(
    solveFourByFour(state, { maxNodes: 50000000, maxMoves: 1 }),
    { code: "FOUR_BY_FOUR_LENGTH_LIMIT" },
  );
  await assert.rejects(solveFourByFour(state, { maxNodes: 1 }), {
    code: "GENERATION_FAILED",
    message: /node budget/i,
  });
  assert.deepEqual(state, original);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    solveFourByFour(state, { maxNodes: 50000000, signal: controller.signal }),
    { name: "AbortError" },
  );
  for (const options of [{}, { maxNodes: 0 }, { maxNodes: 1, maxMoves: 513 }])
    await assert.rejects(solveFourByFour(state, options), TypeError);
  assert.equal(
    (await solveFourByFour(solvedFourByFourState(), { maxNodes: 50000000 }))
      .algorithm,
    "",
  );
});
test("4x4 generation excludes shallow targets and never resamples solver failures", async () => {
  // Fisher-Yates identity choices for corners, wings, centers, then zero twists.
  const identityWords = [8, 24, 24]
    .flatMap((size) => Array.from({ length: size - 1 }, (_, i) => size - 1 - i))
    .concat(new Array(7).fill(0));
  const random = seeded(0x4446e);
  let draws = 0;
  const randomUint32 = () => {
    const index = draws++;
    return index < identityWords.length ? identityWords[index] : random();
  };
  const expected = sampleFourByFourState({ randomUint32: seeded(0x4446e) });
  const result = await generateFourByFour({ randomUint32 });
  assert.deepEqual(result.target, expected);
  assert.equal(draws, identityWords.length * 2);
  assertNxNOracle(fourByFourStateToFacelets(expected), result.algorithm, 4);
  let failureDraws = 0;
  const failureRandom = seeded(0x4446e);
  await assert.rejects(
    generateFourByFour({
      randomUint32: () => {
        failureDraws++;
        return failureRandom();
      },
      maxMoves: 1,
    }),
    { code: "FOUR_BY_FOUR_LENGTH_LIMIT" },
  );
  assert.equal(failureDraws, identityWords.length);
  let invalidDraws = 0;
  for (const options of [{ maxNodes: 0 }, { maxMoves: 513 }])
    await assert.rejects(
      generateFourByFour({
        ...options,
        randomUint32: () => {
          invalidDraws++;
          return 0;
        },
      }),
      TypeError,
    );
  assert.equal(invalidDraws, 0);
});
