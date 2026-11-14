import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSolveStats } from "../src/event-solve-stats.js";

const solve = (eventId, elapsed, index, penalty) => ({
  id: `${eventId}-${index}`,
  eventId,
  elapsed,
  date: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  day: "2026-01-01",
  ...(penalty ? { penalty } : {}),
});
const empty = {
  solve_count: 0,
  total_time_ms: 0,
  best_ms: null,
  median_ms: null,
  best_ao5_ms: null,
  best_ao12_ms: null,
};

test("interleaved event windows stay separate while activity includes every raw elapsed duration", () => {
  const solves = [];
  for (let index = 0; index < 12; index++) {
    solves.push(solve("222", 1000, index * 2));
    solves.push(solve("333", 10000, index * 2 + 1));
  }
  solves.push(solve("333oh", 30000, 24));
  const before = structuredClone(solves);
  const stats = eventSolveStats(solves.reverse());
  assert.deepEqual(stats.activity, {
    solve_count: 25,
    total_time_ms: 162000,
    practice_count: 0,
    active_days: 1,
  });
  assert.deepEqual(stats.events["222"], {
    solve_count: 12,
    total_time_ms: 12000,
    best_ms: 1000,
    median_ms: 1000,
    best_ao5_ms: 1000,
    best_ao12_ms: 1000,
  });
  assert.deepEqual(stats.events["333"], {
    solve_count: 12,
    total_time_ms: 120000,
    best_ms: 10000,
    median_ms: 10000,
    best_ao5_ms: 10000,
    best_ao12_ms: 10000,
  });
  assert.equal(stats.events["333oh"].best_ao5_ms, null);
  assert.equal(stats.events["333oh"].best_ms, 30000);
  assert.deepEqual(solves, before.reverse());
});

test("+2 and DNF affect speed but not activity time, with one DNF trimmed and two invalidating a window", () => {
  const rows = [
    solve("222", 1000, 0),
    solve("222", 2000, 2, "+2"),
    solve("222", 5000, 4),
    solve("222", 6000, 6),
    solve("222", 7000, 8, "dnf"),
    solve("333", 10000, 1),
    solve("333", 10000, 3),
    solve("333", 10000, 5),
    solve("333", 10000, 7, "dnf"),
    solve("333", 10000, 9, "dnf"),
  ];
  const stats = eventSolveStats(rows);
  assert.equal(stats.events["222"].total_time_ms, 21000);
  assert.equal(stats.events["222"].median_ms, 4500);
  assert.equal(stats.events["222"].best_ao5_ms, 5000);
  assert.equal(stats.events["333"].best_ao5_ms, null);
  assert.equal(stats.activity.total_time_ms, 71000);
});

test("missing legacy IDs require explicit permission; unknown IDs never default to 3x3", () => {
  const legacy = solve(undefined, 5000, 0);
  assert.throws(() => eventSolveStats([legacy]), /Invalid solve event/);
  assert.equal(
    eventSolveStats([legacy], { legacy: true }).events["333"].solve_count,
    1,
  );
  for (const eventId of [null, "bad", "333mbf", "pyram"]) {
    assert.throws(
      () => eventSolveStats([solve(eventId, 1000, 0)], { legacy: true }),
      /Invalid solve event/,
    );
  }
});

test("combined active days preserve recorded local days and use UTC only for absent days", () => {
  const first = { ...solve("444bf", 50000, 0), day: "2025-12-31" };
  const second = { ...solve("555bf", 90000, 1), day: undefined };
  const practiceAttempts = [
    { day: "2025-12-31", at: "2026-01-01T00:00:00Z" },
    { day: "2026-01-02", at: "2026-01-01T23:00:00Z" },
    { at: "2026-01-02T23:00:00-05:00" },
  ];
  const stats = eventSolveStats([first, second], { practiceAttempts });
  assert.deepEqual(stats.activity, {
    solve_count: 2,
    total_time_ms: 140000,
    practice_count: 3,
    active_days: 4,
  });
});

test("all ten events have independent complete empty summaries", () => {
  const stats = eventSolveStats([]);
  assert.deepEqual(
    Object.keys(stats.events).sort(),
    [
      "222",
      "333",
      "333oh",
      "333bf",
      "444",
      "444bf",
      "555",
      "555bf",
      "666",
      "777",
    ].sort(),
  );
  for (const event of Object.values(stats.events))
    assert.deepEqual(event, empty);
  stats.events["222"].solve_count = 100;
  assert.equal(stats.events["333"].solve_count, 0);
  assert.equal(eventSolveStats([]).events["222"].solve_count, 0);
});

test("source history is scanned once before event-specific aggregation", () => {
  let passes = 0;
  const solves = {
    *[Symbol.iterator]() {
      passes++;
      yield solve("222", 1000, 0);
      yield solve("333", 5000, 1);
    },
  };
  assert.equal(eventSolveStats(solves).activity.solve_count, 2);
  assert.equal(passes, 1);
});

test("five mixed solves cannot manufacture an average for either event", () => {
  const stats = eventSolveStats([
    solve("222", 1000, 0),
    solve("333", 10000, 1),
    solve("222", 2000, 2),
    solve("333", 12000, 3),
    solve("222", 3000, 4),
  ]);
  assert.equal(stats.events["222"].best_ao5_ms, null);
  assert.equal(stats.events["333"].best_ao5_ms, null);
});
