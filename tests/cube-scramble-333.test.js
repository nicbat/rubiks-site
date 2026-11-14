import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import {
  generateThreeByThree,
  threeByThreeDiagnostics,
  THREE_BY_THREE_GENERATOR,
} from "../packages/cube-engine/scramble/three-by-three.js";
import { validateEventScramble } from "../packages/cube-engine/scramble/index.js";
const puzzle = await cube3x3x3.kpuzzle();
function assertTarget(result) {
  const pattern = puzzle
    .defaultPattern()
    .applyAlg(result.algorithm).patternData;
  assert.deepEqual(pattern.CORNERS.pieces, result.target.cornerPermutation);
  assert.deepEqual(
    pattern.CORNERS.orientation,
    result.target.cornerOrientation,
  );
  assert.deepEqual(pattern.EDGES.pieces, result.target.edgePermutation);
  assert.deepEqual(pattern.EDGES.orientation, result.target.edgeOrientation);
  assert.deepEqual(pattern.CENTERS.pieces, [0, 1, 2, 3, 4, 5]);
  assert.equal(
    result.target.cornerOrientation.reduce((a, b) => a + b, 0) % 3,
    0,
  );
  assert.equal(result.target.edgeOrientation.reduce((a, b) => a + b, 0) % 2, 0);
  assert.ok(result.phaseLengths[0] <= 12 && result.phaseLengths[1] <= 18);
  assert.equal(
    result.algorithm.split(" ").length,
    result.phaseLengths[0] + result.phaseLengths[1],
  );
  validateEventScramble("333", result.algorithm);
  validateEventScramble("333oh", result.algorithm);
}
function seeded(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}
// Supply entropy yielding a specified independent oracle pattern. Each shuffle
// draw places the requested final piece into the next fixed position.
function wordsFor(pattern) {
  const { CORNERS, EDGES } = pattern.patternData;
  const words = [];
  for (const pieces of [CORNERS.pieces, EDGES.pieces]) {
    const pool = Array.from({ length: pieces.length }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const selected = pool.indexOf(pieces[i]);
      words.push(selected);
      [pool[i], pool[selected]] = [pool[selected], pool[i]];
    }
  }
  words.push(
    ...CORNERS.orientation.slice(0, 7),
    ...EDGES.orientation.slice(0, 11),
  );
  return words;
}
function source(words) {
  let count = 0;
  return {
    next: () => {
      assert.ok(count < words.length, "unexpected resampling");
      return words[count++];
    },
    count: () => count,
  };
}

test("cancelled cold request cannot publish or invalidate another shared initialization", async () => {
  const controller = new AbortController();
  const cancelled = generateThreeByThree({
    signal: controller.signal,
    randomUint32: seeded(335),
  });
  const kept = generateThreeByThree({ randomUint32: seeded(336) });
  controller.abort();
  await assert.rejects(cancelled, { code: "ABORTED", name: "AbortError" });
  assertTarget(await kept);
});

test("original two-phase solver matches independent random-state targets", async () => {
  for (const seed of [
    333, 3331, 3332, 3333, 3334, 3335, 3336, 3337, 3338, 3339, 3340, 3341, 3342,
    3343, 3344, 3345, 3346, 3347, 3348, 3349, 3350, 3351, 3352, 3353, 3354,
    3355, 3356, 3357, 3358, 3359,
  ])
    assertTarget(await generateThreeByThree({ randomUint32: seeded(seed) }));
  assert.deepEqual(THREE_BY_THREE_GENERATOR, {
    id: "last-layer-333-two-phase",
    version: "1",
    method: "random-state",
  });
});

test("solved and all eighteen single-face-turn states are exactly excluded", async () => {
  const accepted = puzzle.defaultPattern().applyAlg("R U F");
  const good = wordsFor(accepted);
  for (const algorithm of [
    "",
    ..."UDRLFB".split("").flatMap((face) => [face, `${face}2`, `${face}'`]),
  ]) {
    const bad = wordsFor(puzzle.defaultPattern().applyAlg(algorithm));
    const entropy = source([...bad, ...good]);
    const result = await generateThreeByThree({ randomUint32: entropy.next });
    assert.equal(entropy.count(), bad.length + good.length, algorithm);
    assert.deepEqual(
      result.target.cornerPermutation,
      accepted.patternData.CORNERS.pieces,
    );
    assert.deepEqual(
      result.target.edgePermutation,
      accepted.patternData.EDGES.pieces,
    );
    assertTarget(result);
  }
});

test("two-move states and phase-two subgroup states remain eligible", async () => {
  for (const algorithm of ["R U", "R2 U D2 F2 L2 B2 U' R2 D", "U2 D2"]) {
    const pattern = puzzle.defaultPattern().applyAlg(algorithm),
      words = wordsFor(pattern),
      entropy = source(words);
    const result = await generateThreeByThree({ randomUint32: entropy.next });
    assert.equal(entropy.count(), words.length);
    assertTarget(result);
  }
});

test("bounded search fails explicitly without resampling the accepted target", async () => {
  const words = wordsFor(puzzle.defaultPattern().applyAlg("R U F L B D")),
    entropy = source(words);
  await assert.rejects(
    generateThreeByThree({ randomUint32: entropy.next, maxNodes: 1 }),
    (error) =>
      error.code === "GENERATION_FAILED" &&
      /budget exhausted/.test(error.message),
  );
  assert.equal(entropy.count(), words.length);
  for (const maxNodes of [0, -1, NaN, 0.5])
    await assert.rejects(
      generateThreeByThree({ randomUint32: seeded(333), maxNodes }),
      { code: "GENERATION_FAILED" },
    );
});

test("entropy rejection, absence, errors and cancellation have no random-move fallback", async () => {
  const words = wordsFor(puzzle.defaultPattern().applyAlg("R U F"));
  // First shuffle bound8 divides2^32; its following bound7 has a rejection tail.
  const entropy = source([words[0], 2 ** 32 - 1, ...words.slice(1)]);
  assertTarget(await generateThreeByThree({ randomUint32: entropy.next }));
  assert.equal(entropy.count(), words.length + 1);
  for (const bad of [-1, 2 ** 32, NaN, 0.5, undefined])
    await assert.rejects(generateThreeByThree({ randomUint32: () => bad }), {
      code: "GENERATION_FAILED",
    });
  let calls = 0;
  await assert.rejects(
    generateThreeByThree({
      randomUint32: () => {
        calls++;
        throw new Error("entropy failed");
      },
    }),
    { code: "GENERATION_FAILED" },
  );
  assert.equal(calls, 1);
  await assert.rejects(
    generateThreeByThree({
      signal: AbortSignal.abort(),
      randomUint32: () => {
        throw new Error("must not sample");
      },
    }),
    { code: "ABORTED", name: "AbortError" },
  );
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    await assert.rejects(generateThreeByThree(), { code: "GENERATION_FAILED" });
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});

test("pruning tables cover complete paired coordinates within bounded storage", async () => {
  const info = await threeByThreeDiagnostics();
  assert.deepEqual(info.pruningSizes, [
    2187 * 495,
    2048 * 495,
    40320 * 24,
    40320 * 24,
  ]);
  assert.equal(info.retainedBytes, 5823197);
  assert.equal(info.largestQueueBytes, 4330260);
  assert.ok(info.pruningMaximums.every((depth) => depth > 0 && depth <= 18));
  info.pruningSizes[0] = 0;
  assert.equal((await threeByThreeDiagnostics()).pruningSizes[0], 2187 * 495);
});

test("production entropy uses Web Crypto and exposed targets do not mutate solver tables", async (t) => {
  const pattern = puzzle.defaultPattern().applyAlg("R U F"),
    words = wordsFor(pattern);
  let next = 0;
  t.mock.method(globalThis.crypto, "getRandomValues", (buffer) => {
    assert.ok(buffer instanceof Uint32Array);
    buffer[0] = words[next++ % words.length];
    return buffer;
  });
  const first = await generateThreeByThree();
  assertTarget(first);
  first.target.cornerPermutation.fill(0);
  assertTarget(await generateThreeByThree());
});

test("parity correction maps both permutation preimages to the same legal target", async () => {
  const target = puzzle.defaultPattern().applyAlg("R U F L");
  const unmatched = { patternData: structuredClone(target.patternData) };
  [
    unmatched.patternData.EDGES.pieces[0],
    unmatched.patternData.EDGES.pieces[1],
  ] = [
    unmatched.patternData.EDGES.pieces[1],
    unmatched.patternData.EDGES.pieces[0],
  ];
  const correct = await generateThreeByThree({
    randomUint32: source(wordsFor(target)).next,
  });
  const corrected = await generateThreeByThree({
    randomUint32: source(wordsFor(unmatched)).next,
  });
  assert.deepEqual(corrected.target, correct.target);
  assertTarget(corrected);
});
