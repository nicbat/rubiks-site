import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SOLVE_NOTES_LENGTH,
  recentStats,
  validateSolves,
  withSolveChanges,
} from "../src/solve-history.js";

test("bulk cube changes and deletions preserve other solves, raw results and chronology without mutating history", () => {
  const solves = validateSolves(
    Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      elapsed: 1000 + i * 500,
      date: `2026-10-10T12:00:0${i}.000Z`,
      day: "2026-10-10",
      scramble: Array(10).fill("R U").join(" "),
      ...(i === 0 ? {} : { cubeId: i % 2 ? "old" : null }),
      ...(i === 2 ? { penalty: "dnf", notes: "Keep this note" } : {}),
    })),
  );
  const original = structuredClone(solves);
  for (const cubeId of ["new", null]) {
    const next = withSolveChanges(solves, ["s0", "s2", "s2", "missing"], {
      type: "cube",
      cubeId,
    });
    assert.deepEqual(
      next,
      original.map((solve) =>
        ["s0", "s2"].includes(solve.id) ? { ...solve, cubeId } : solve,
      ),
    );
    assert.deepEqual(validateSolves(next), next);
    assert.deepEqual(solves, original);
  }
  assert.deepEqual(
    withSolveChanges(solves, ["s0", "s2", "s2", "missing"], { type: "delete" }),
    [original[1], original[3], original[4]],
  );
  assert.deepEqual(withSolveChanges(solves, [], { type: "delete" }), original);
  assert.deepEqual(
    withSolveChanges(
      solves,
      solves.map((s) => s.id),
      { type: "delete" },
    ),
    [],
  );
  assert.deepEqual(solves, original);
  for (const change of [
    { type: "unknown" },
    { type: "cube", cubeId: "" },
    { type: "cube", cubeId: 5 },
  ])
    assert.throws(() => withSolveChanges(solves, ["s0"], change));
});

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

test("optional notes survive validation verbatim without changing legacy solves", () => {
  const base = {
    id: "notes",
    elapsed: 1234,
    date: "2026-10-10T12:00:00.000Z",
    scramble: Array(10).fill("R U").join(" "),
  };
  for (const notes of [
    "",
    "Cross\nTry <b>slow</b> turns 🧊",
    "a".repeat(MAX_SOLVE_NOTES_LENGTH),
  ]) {
    const input = [{ ...base, notes }];
    const original = structuredClone(input);
    const validated = validateSolves(input);
    assert.deepEqual(validated, original);
    assert.notEqual(validated[0], input[0]);
    assert.deepEqual(input, original);
  }
  assert.deepEqual(validateSolves([base]), [base]);
  for (const notes of [
    null,
    123,
    {},
    [],
    true,
    "a".repeat(MAX_SOLVE_NOTES_LENGTH + 1),
  ]) {
    assert.throws(() => validateSolves([{ ...base, notes }]));
  }
});

test("solve dates retain real calendar timestamps with an explicit timezone", () => {
  const solve = {
    id: "a",
    elapsed: 1234,
    date: "2024-02-29T23:45:00-08:00",
    scramble: Array(10).fill("R U").join(" "),
  };
  for (const date of ["2024-02-29T23:45:00-08:00", "2026-10-12T12:00:00.000Z"])
    assert.equal(validateSolves([{ ...solve, date }])[0].date, date);
  for (const date of [
    "2026-02-29T12:00:00Z",
    "2026-02-30T12:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-10-12T24:00:00Z",
    "2026-10-12T12:00:00",
    "2026-10-12",
    "October 12, 2026",
  ])
    assert.throws(() => validateSolves([{ ...solve, date }]), date);
});
