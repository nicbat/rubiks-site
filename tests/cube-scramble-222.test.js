import { test } from "node:test";
import assert from "node:assert/strict";
import { puzzles } from "cubing/puzzles";
import {
  generateTwoByTwo,
  twoByTwoDiagnostics,
  TWO_BY_TWO_STATE_COUNT,
} from "../packages/cube-engine/scramble/two-by-two.js";

const puzzle = await puzzles["2x2x2"].kpuzzle();
function assertTarget(result) {
  const actual = puzzle.defaultPattern().applyAlg(result.algorithm)
    .patternData.CORNERS;
  assert.deepEqual(actual.pieces, result.target.permutation);
  assert.deepEqual(actual.orientation, result.target.orientation);
  assert.equal(actual.pieces[6], 6);
  assert.equal(actual.orientation[6], 0);
  assert.equal(result.algorithm.split(" ").length, result.distance);
  assert.ok(result.distance >= 4 && result.distance <= 11);
}
// Independent rank calculation over cubing.js corner states, using removal
// digits rather than the implementation's inversion-count encoding.
function rank(pattern) {
  const { pieces, orientation } = pattern.patternData.CORNERS;
  const positions = [0, 1, 2, 3, 4, 5, 7],
    remaining = [...positions];
  let permutation = 0;
  for (const position of positions) {
    const digit = remaining.indexOf(pieces[position]);
    permutation = permutation * remaining.length + digit;
    remaining.splice(digit, 1);
  }
  let twists = 0;
  for (const position of positions.slice(0, 6))
    twists = 3 * twists + orientation[position];
  return permutation * 729 + twists;
}

test("cancelled cold request does not cancel shared initialization", async () => {
  const controller = new AbortController();
  const cancelled = generateTwoByTwo({
    signal: controller.signal,
    randomUint32: () => 123456,
  });
  const kept = generateTwoByTwo({ randomUint32: () => 654321 });
  controller.abort();
  await assert.rejects(cancelled, { code: "ABORTED", name: "AbortError" });
  assertTarget(await kept);
});

test("complete graph matches independently published distance histogram and bounded resources", async () => {
  // Dik T. Winter's original exhaustive result, May 10, 1992:
  // https://www.math.rwth-aachen.de/~Martin.Schoenert/Cube-Lovers/Dik_T._Winter__More_on_the_Cube_(2x2x2_in_this_case)..html
  const diagnostics = await twoByTwoDiagnostics();
  assert.equal(diagnostics.stateCount, 3674160);
  assert.deepEqual(
    diagnostics.histogram,
    [1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644],
  );
  assert.equal(diagnostics.retainedBytes, 3778002);
  assert.equal(diagnostics.initializationQueueBytes, 14696640);
  diagnostics.histogram[0] = 999;
  assert.equal((await twoByTwoDiagnostics()).histogram[0], 1);
});

test("every state within three face turns is excluded using an independent oracle enumeration", async () => {
  let frontier = [puzzle.defaultPattern()];
  const shallow = new Map([[0, frontier[0]]]);
  const moves = ["R", "R2", "R'", "U", "U2", "U'", "F", "F2", "F'"];
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const state of frontier)
      for (const move of moves) {
        const candidate = state.applyAlg(move),
          index = rank(candidate);
        if (shallow.has(index)) continue;
        shallow.set(index, candidate);
        next.push(candidate);
      }
    frontier = next;
  }
  assert.equal(shallow.size, 385);
  for (const index of shallow.keys()) {
    let calls = 0;
    const result = await generateTwoByTwo({
      randomUint32: () => (++calls === 1 ? index : 123456),
    });
    assert.equal(calls, 2, `distance<4 index ${index}`);
    assert.equal(result.targetIndex, 123456);
    assertTarget(result);
  }
  const distanceFour = rank(puzzle.defaultPattern().applyAlg("R U F R"));
  let calls = 0;
  const accepted = await generateTwoByTwo({
    randomUint32: () => {
      calls++;
      return distanceFour;
    },
  });
  assert.equal(calls, 1);
  assert.equal(accepted.distance, 4);
  assertTarget(accepted);
});

test("uint32 rejection removes modulo bias and no accepted target is resampled", async () => {
  const limit =
    Math.floor(2 ** 32 / TWO_BY_TWO_STATE_COUNT) * TWO_BY_TWO_STATE_COUNT;
  const values = [limit, 2 ** 32 - 1, 0, 123456];
  let calls = 0;
  const result = await generateTwoByTwo({
    randomUint32: () => values[calls++],
  });
  assert.equal(calls, 4);
  assert.equal(result.targetIndex, 123456);
  assertTarget(result);
  assert.deepEqual(result.target, {
    permutation: [0, 2, 4, 1, 3, 7, 6, 5],
    orientation: [1, 0, 0, 1, 1, 0, 0, 0],
  });
  result.target.permutation.fill(0);
  assertTarget(await generateTwoByTwo({ randomUint32: () => 123456 }));
});

test("seeded targets match cubing.js exactly over the complete rank range", async () => {
  let seed = 0x2222026;
  const randomUint32 = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 250; i++)
    assertTarget(await generateTwoByTwo({ randomUint32 }));
});

test("invalid entropy and missing crypto fail explicitly without a fallback", async () => {
  for (const invalid of [-1, 2 ** 32, NaN, 0.5, undefined])
    await assert.rejects(generateTwoByTwo({ randomUint32: () => invalid }), {
      code: "GENERATION_FAILED",
    });
  let calls = 0;
  await assert.rejects(
    generateTwoByTwo({
      randomUint32: () => {
        calls++;
        throw new Error("entropy unavailable");
      },
    }),
    { code: "GENERATION_FAILED" },
  );
  assert.equal(calls, 1);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    await assert.rejects(generateTwoByTwo(), { code: "GENERATION_FAILED" });
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    generateTwoByTwo({
      signal: controller.signal,
      randomUint32: () => {
        throw new Error("must not sample");
      },
    }),
    { code: "ABORTED" },
  );
});

test("production source draws uint32 values from Web Crypto", async (t) => {
  let draws = 0;
  t.mock.method(globalThis.crypto, "getRandomValues", (buffer) => {
    assert.ok(buffer instanceof Uint32Array);
    assert.equal(buffer.length, 1);
    buffer[0] = 123456;
    draws++;
    return buffer;
  });
  const result = await generateTwoByTwo();
  assert.equal(draws, 1);
  assert.equal(result.targetIndex, 123456);
  assertTarget(result);
});
