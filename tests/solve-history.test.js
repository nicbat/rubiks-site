import { test } from "node:test";
import assert from "node:assert/strict";
import { recentStats, validateSolves } from "../src/solve-history.js";

test("recent averages discard exactly one fastest and slowest and use only the latest window", () => {
  const solves = [90000, 1000, 2000, 3000, 4000, 100000].map((elapsed) => ({
    elapsed,
  }));
  assert.deepEqual(recentStats(solves, 5), { average: 3000, best: 1000 });
  assert.deepEqual(recentStats(solves, 12), { average: null, best: 1000 });
  assert.deepEqual(recentStats([], 5), { average: null, best: null });
  assert.deepEqual(
    recentStats(
      Array.from({ length: 12 }, (_, i) => ({ elapsed: (i + 1) * 1000 })),
      12,
    ),
    { average: 6500, best: 1000 },
  );
  assert.equal(recentStats(Array(5).fill({ elapsed: 2000 }), 5).average, 2000);
});
test("solve storage rejects invalid records and returns independent records", () => {
  const solve = {
    id: "a",
    elapsed: 1234,
    date: "2026-10-10T12:00:00.000Z",
    scramble: Array(10).fill("R U").join(" "),
  };
  const saved = validateSolves([solve]);
  assert.deepEqual(saved, [solve]);
  assert.notEqual(saved[0], solve);
  for (const value of [
    null,
    {},
    [solve, solve],
    [{ ...solve, elapsed: -1 }],
    [{ ...solve, elapsed: Infinity }],
    [{ ...solve, date: "bad" }],
    [{ ...solve, scramble: "<script>" }],
  ])
    assert.throws(() => validateSolves(value));
});
