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

test("penalties retain raw elapsed values and round-trip without changing legacy solves", () => {
  const base = {
    id: "p",
    elapsed: 1234,
    date: "2026-10-10T12:00:00.000Z",
    scramble: Array(10).fill("R U").join(" "),
  };
  for (const penalty of ["+2", "dnf"]) {
    assert.deepEqual(validateSolves([{ ...base, penalty }]), [
      { ...base, penalty },
    ]);
  }
  for (const penalty of [null, "none", 2000, "DNF", {}, true]) {
    assert.throws(() => validateSolves([{ ...base, penalty }]));
  }
});

test("averages rank adjusted times and drop only one DNF", () => {
  const solves = [1000, 2000, 3000, 4000, 5000].map((elapsed) => ({ elapsed }));
  solves[0].penalty = "+2";
  assert.deepEqual(recentStats(solves, 5), { best: 2000, average: 10000 / 3 });
  solves[4].penalty = "dnf";
  assert.deepEqual(recentStats(solves, 5), { best: 2000, average: 10000 / 3 });
  solves[3].penalty = "dnf";
  assert.deepEqual(recentStats(solves, 5), { best: 2000, average: Infinity });
  assert.deepEqual(recentStats([{ elapsed: 1000, penalty: "dnf" }], 5), {
    best: Infinity,
    average: null,
  });
  assert.deepEqual(
    recentStats(Array(5).fill({ elapsed: 1000, penalty: "dnf" }), 5),
    { best: Infinity, average: Infinity },
  );
});
