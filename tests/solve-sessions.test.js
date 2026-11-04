import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_BREAK,
  currentSession,
  describeChange,
  formatChange,
  sessionProgress,
  timerTrend,
} from "../src/solve-sessions.js";

const second = 1000;
const minute = 60 * second;
const base = Date.UTC(2026, 10, 3, 12);
// Each solve finishes `finished` seconds after base and lasted `elapsed` ms.
const solve = (id, finished, elapsed = 20000, extra = {}) => ({
  id,
  elapsed,
  date: new Date(base + finished * second).toISOString(),
  scramble: "R U",
  ...extra,
});
const ids = (solves) => solves.map((s) => s.id);

test("a session is the latest run of solves without a break over 30 minutes", () => {
  const solves = [
    solve("old", 0),
    // Starts 31 minutes after "old" finished: a new session.
    solve("a", 31 * 60 + 20),
    // Starts exactly 30 minutes after "a" finished: same session.
    solve("b", 61 * 60 + 40),
    solve("c", 63 * 60),
  ];
  const now = base + 70 * minute;
  assert.deepEqual(ids(currentSession(solves, now)), ["a", "b", "c"]);
  // The break is measured from the end of a solve to the start of the next,
  // so a long solve does not split its session.
  const long = [solve("x", 0), solve("y", 40 * 60, 15 * minute)];
  assert.deepEqual(ids(currentSession(long, base + 41 * minute)), ["x", "y"]);
  assert.deepEqual(ids(currentSession(solves, base + 93 * minute)), [
    "a",
    "b",
    "c",
  ]);
  // More than 30 minutes since the last solve: the next solve starts afresh.
  assert.deepEqual(currentSession(solves, base + 93 * minute + 1), []);
  assert.deepEqual(currentSession([], now), []);
  assert.deepEqual(
    ids(currentSession(solves, base + 63 * minute, 2 * minute)),
    ["b", "c"],
    "the break length is configurable",
  );
  assert.equal(SESSION_BREAK, 30 * minute);
});

test("session progress compares the latest solve with the previous one using displayed hundredths", () => {
  const progress = sessionProgress([
    solve("a", 0, 30000),
    solve("b", 1, 25000),
  ]);
  assert.equal(progress.count, 2);
  assert.equal(progress.change, -5000);
  assert.equal(progress.best, 25000);
  assert.equal(progress.mean, 27500);
  assert.equal(describeChange(progress.change), "5.00s faster");
  // 30.009 and 25.001 display as 30.00 and 25.00, so the change is 5.00.
  assert.equal(
    sessionProgress([solve("a", 0, 30009), solve("b", 1, 25001)]).change,
    -5000,
  );
  assert.equal(
    sessionProgress([
      solve("a", 0, 20000),
      solve("b", 1, 20000, { penalty: "+2" }),
    ]).change,
    2000,
  );
  for (const session of [
    [solve("a", 0)],
    [solve("a", 0), solve("b", 1, 20000, { penalty: "dnf" })],
    [solve("a", 0, 20000, { penalty: "dnf" }), solve("b", 1)],
  ])
    assert.equal(sessionProgress(session).change, null);
  assert.deepEqual(sessionProgress([]), {
    count: 0,
    best: null,
    mean: null,
    change: null,
    ao5: null,
    ao5Change: null,
  });
  // DNFs are excluded from the mean and best, not counted as zero.
  const withDnf = sessionProgress([
    solve("a", 0, 10000),
    solve("b", 1, 1000, { penalty: "dnf" }),
    solve("c", 2, 20000),
  ]);
  assert.equal(withDnf.best, 10000);
  assert.equal(withDnf.mean, 15000);
  assert.equal(withDnf.count, 3);
});

test("the session ao5 trend compares the current ao5 with the session's first ao5", () => {
  const times = [30000, 29000, 28000, 27000, 26000];
  const first = times.map((t, i) => solve(`s${i}`, i, t));
  assert.equal(sessionProgress(first).ao5, 28000);
  assert.equal(
    sessionProgress(first).ao5Change,
    null,
    "five solves have only one ao5",
  );
  const sixth = [...first, solve("s5", 5, 20000)];
  // Current ao5 of 29, 28, 27, 26, 20 drops 29 and 20: 27.00 vs 28.00.
  assert.equal(sessionProgress(sixth).ao5, 27000);
  assert.equal(sessionProgress(sixth).ao5Change, -1000);
  const dnfStart = first.map((s, i) => (i < 2 ? { ...s, penalty: "dnf" } : s));
  assert.equal(
    sessionProgress([...dnfStart, solve("s5", 5)]).ao5Change,
    null,
    "a DNF first average has no comparison",
  );
});

test("changes format as signed readouts and short descriptions", () => {
  assert.equal(formatChange(-5000), "−5.00");
  assert.equal(formatChange(1230), "+1.23");
  assert.equal(formatChange(0), "0.00");
  assert.equal(formatChange(-65430), "−1:05.43");
  assert.equal(formatChange(-65430, false), "−65.43");
  assert.equal(describeChange(1230), "1.23s slower");
  assert.equal(describeChange(-65430), "1:05.43 faster");
  assert.equal(describeChange(-65430, false), "65.43s faster");
  assert.equal(describeChange(0), "Same time");
});

test("timer trend ranges cover the session, the last 30 local dates, or all history", () => {
  const today = "2026-11-03";
  const solves = [
    solve("ancient", -400 * 24 * 3600, 30000, { day: "2025-09-29" }),
    solve("edge", -29 * 24 * 3600, 28000, { day: "2026-10-05" }),
    solve("outside", -30 * 24 * 3600, 29000, { day: "2026-10-04" }),
    solve("today", 0, 25000, { day: today }),
  ].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const session = solves.slice(-1);
  const trendIds = (range) =>
    timerTrend(solves, range, { session, today }).points.map((p) => p.solve.id);
  assert.deepEqual(trendIds("session"), ["today"]);
  assert.deepEqual(trendIds("30"), ["edge", "today"]);
  assert.deepEqual(trendIds("all"), ["ancient", "outside", "edge", "today"]);
  assert.equal(timerTrend(solves, "session", { session: [], today }).count, 0);
  for (const range of ["7", "", "month"])
    assert.throws(() => timerTrend(solves, range, { session, today }));
});
