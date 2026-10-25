import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activitySummary,
  heatmapWeeks,
  shiftDay,
  solveSummary,
  solveDistribution,
  withoutActivityDay,
  solveDay,
} from "../src/dashboard.js";
import { createProgressIndex } from "../src/progress-index.js";
import { emptyProgress, statusFor, dayKey } from "../src/progress.js";
const today = "2026-10-17";
const solve = (id, elapsed, extra = {}) => ({
  id: String(id),
  elapsed,
  date: `2026-10-17T12:00:${String(id).padStart(2, "0")}Z`,
  day: today,
  ...extra,
});
test("deleting a local day removes all its activity and recalculates confidence, preserving other dates and marks", () => {
  const progress = {
    ...emptyProgress(),
    selected: ["pll-T"],
    known: { "pll-Ua": [0] },
    attempts: ["2026-10-15", "2026-10-16", today].map((day) => ({
      id: day,
      day,
      at: `${day}T20:00:00Z`,
      caseId: "pll-T",
      variant: 0,
      mode: "recognition",
      result: "confident",
    })),
  };
  progress.attempts.push({
    ...progress.attempts[2],
    id: "rehearsal",
    mode: "rehearsal",
  });
  const solves = [
    solve(1, 1000),
    solve(2, 2000, { day: "2026-10-16", cubeId: "other" }),
  ];
  const before = structuredClone({ progress, solves });
  assert.equal(statusFor(progress, "pll-T").label, "Confident");
  const next = withoutActivityDay(progress, solves, today);
  assert.equal(statusFor(next.progress, "pll-T").label, "Needs practice");
  assert.deepEqual(
    next.progress.attempts.map((a) => a.id),
    ["2026-10-15", "2026-10-16"],
  );
  assert.deepEqual(
    next.solves.map((s) => s.id),
    ["2"],
  );
  assert.deepEqual(next.progress.known, progress.known);
  assert.deepEqual(next.progress.selected, progress.selected);
  assert.deepEqual({ progress, solves }, before);
  const legacy = solve(3, 3000, {
    day: undefined,
    date: "2026-10-17T01:00:00Z",
  });
  const local = dayKey(new Date(legacy.date));
  assert.equal(solveDay(legacy), local);
  assert.deepEqual(withoutActivityDay(progress, [legacy], local).solves, []);
  assert.throws(() => withoutActivityDay(progress, solves, "2026-02-30"));
});
test("heatmap lays out week columns, includes leap days, and pads rather than inventing activity days", () => {
  assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  const weeks = heatmapWeeks("2026-10-17", "28");
  assert.equal(weeks.length, 4);
  assert.deepEqual(
    weeks.map((week) => week.label),
    ["Sep", "", "Oct", ""],
  );
  assert.deepEqual(weeks[0].days, [
    "2026-09-20",
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
  ]);
  assert.equal(weeks.at(-1).days.at(-1), "2026-10-17");
  for (const [end, range, count] of [
    ["2024-03-01", "28", 28],
    ["2026-01-02", "90", 90],
    ["2024-03-01", "all", 365],
  ]) {
    const columns = heatmapWeeks(end, range);
    const days = columns.flatMap((w) => w.days).filter(Boolean);
    assert.equal(days.length, count);
    assert.equal(new Set(days).size, count);
    assert.equal(days.at(-1), end);
    assert.ok(columns.every((w) => w.days.length === 7));
    for (const week of columns)
      week.days.forEach((day, index) => {
        if (day) assert.equal(new Date(`${day}T12:00:00`).getDay(), index);
      });
    if (end === "2024-03-01") assert.ok(days.includes("2024-02-29"));
  }
  assert.equal(heatmapWeeks("2024-03-01", "28")[0].days[0], null);
  assert.equal(heatmapWeeks("2024-03-01", "28").at(-1).days[6], null);
});
test("activity counts shared objectives once, preserves original local days, and filters inclusively", () => {
  const progress = emptyProgress();
  progress.attempts = [
    {
      caseId: "pll-Ua",
      variant: 0,
      mode: "recognition",
      result: "confident",
      day: "2026-09-20",
      method: "two-look",
    },
    {
      caseId: "pll-Ua",
      variant: 0,
      mode: "rehearsal",
      result: "effort",
      day: today,
    },
    {
      caseId: "pll-T",
      variant: 0,
      mode: "recognition",
      result: "help",
      day: "2026-09-19",
    },
  ];
  const index = createProgressIndex(progress);
  const daily = index.dailyActivity();
  daily[0].recognition = 99;
  const summary = activitySummary(
    index.dailyActivity(),
    [
      solve(1, 3000, { day: "2026-10-16" }),
      solve(2, 4000, { day: "2026-10-18" }),
    ],
    { today },
  );
  assert.equal(summary.since, "2026-09-20");
  assert.deepEqual(summary.totals, {
    recognition: 1,
    rehearsal: 1,
    solves: 1,
    days: 3,
  });
  assert.equal(summary.days.get("2026-10-16").solves, 1);
  assert.equal(index.attemptsOn("2026-09-20"), 1);
  assert.equal(
    activitySummary(index.dailyActivity(), [], { today, range: "all" }).totals
      .recognition,
    2,
  );
});
test("solve trends order history, include penalties, and distinguish insufficient windows and DNF", () => {
  const solves = [1, 2, 3, 4, 5].map((n) => solve(n, n * 1000));
  solves[0].penalty = "+2";
  solves[4].penalty = "dnf";
  const summary = solveSummary([...solves].reverse(), { today });
  assert.equal(summary.best, 2000);
  assert.equal(summary.ao5, 10000 / 3);
  assert.equal(summary.best5, 10000 / 3);
  assert.equal(summary.ao12, null);
  assert.equal(summary.dnfs, 1);
  assert.equal(summary.points.at(-1).time, Infinity);
  solves[3].penalty = "dnf";
  const failed = solveSummary(solves, { today });
  assert.equal(failed.ao5, Infinity);
  assert.equal(failed.best5, null);
  assert.doesNotMatch(failed.path5, /NaN|Infinity/);
  assert.equal(solveSummary([], { today }).best, null);
});
test("date/cube filters define windows and chart truncation preserves all-time bests", () => {
  const solves = Array.from({ length: 250 }, (_, i) => ({
    ...solve(1, i ? 3000 : 1000),
    id: String(i),
    date: new Date(Date.UTC(2026, 9, 17, 12, 0, i)).toISOString(),
    cubeId: "a",
  }));
  const result = solveSummary(solves, { today, cube: "a" });
  assert.equal(result.count, 250);
  assert.equal(result.points.length, 200);
  assert.equal(result.best, 1000);
  assert.equal(result.ao12, 3000);
  assert.equal(result.recent.length, 12);
  assert.equal(solveSummary(solves, { today, cube: "b" }).count, 0);
  assert.equal(solveSummary(solves, { today, since: "2026-10-18" }).count, 0);
});

test("selected-day solve details exclude adjacent days and calculate penalty-aware means", () => {
  const result = solveSummary(
    [
      solve(1, 1000, { penalty: "+2" }),
      solve(2, 5000),
      solve(3, 9000, { penalty: "dnf" }),
      solve(4, 100, { day: "2026-10-16" }),
      solve(5, 100, { day: "2026-10-18" }),
    ],
    { since: today, today, recentLimit: 50 },
  );
  assert.equal(result.count, 3);
  assert.equal(result.best, 3000);
  assert.equal(result.mean, 4000);
  assert.equal(result.totalTime, 15000);
  assert.equal(result.dnfs, 1);
  assert.deepEqual(
    result.recent.map((p) => p.solve.id),
    ["3", "2", "1"],
  );
  assert.equal(
    solveSummary([solve(1, 1000, { penalty: "dnf" })], { today }).mean,
    null,
  );
});

test("daily histogram includes each finite result once and computes median and quartiles", () => {
  const result = solveDistribution([1000, 2000, 3000, 4000, Infinity]);
  assert.equal(result.median, 2500);
  assert.equal(result.q1, 1750);
  assert.equal(result.q3, 3250);
  assert.deepEqual(result.bins, [
    { lower: 1000, upper: 2000, count: 1 },
    { lower: 2000, upper: 3000, count: 1 },
    { lower: 3000, upper: 4000, count: 2 },
  ]);
  assert.deepEqual(solveDistribution([Infinity]), {
    bins: [],
    median: null,
    q1: null,
    q3: null,
  });
  const equal = solveDistribution([21000, 21000, 21000]);
  assert.equal(equal.median, 21000);
  assert.deepEqual(equal.bins, [{ lower: 21000, upper: 22000, count: 3 }]);
});
test("daily charts use filtered penalty-adjusted results and break lines at DNF", () => {
  const result = solveSummary(
    [
      solve(1, 1000, { cubeId: "a", penalty: "+2" }),
      solve(2, 1000, { cubeId: "b" }),
      solve(3, 1000, { cubeId: "a", penalty: "dnf" }),
      solve(4, 5000, { cubeId: "a" }),
    ],
    { today, since: today, cube: "a", distribution: true },
  );
  assert.equal(result.count, 3);
  assert.equal(result.plusTwo, 1);
  assert.equal(result.distribution.median, 4000);
  assert.equal(
    result.distribution.bins.reduce((sum, b) => sum + b.count, 0),
    2,
  );
  assert.equal((result.pathTime.match(/M/g) || []).length, 2);
  assert.doesNotMatch(result.pathTime, /L|NaN|Infinity/);
  assert.deepEqual(
    result.points.map((p) => p.number),
    [1, 2, 3],
  );
  const many = Array.from({ length: 210 }, (_, i) => ({
    ...solve(1, i < 10 ? 1000 : 5000),
    id: String(i),
  }));
  const full = solveSummary(many, { today, distribution: true });
  assert.equal(full.points.length, 200);
  assert.equal(full.points[0].number, 11);
  assert.equal(
    full.distribution.bins.reduce((sum, b) => sum + b.count, 0),
    210,
  );
  assert.equal(full.best, 1000);
});

test("all-time overview spans older history, preserves extremes and DNFs, and bounds rendered points", () => {
  const records = Array.from({ length: 1000 }, (_, i) => ({
    id: String(i),
    date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    day: dayKey(new Date(Date.UTC(2020, 0, 1 + i, 12))),
    elapsed: 20000,
    ...(i === 400
      ? { elapsed: 1000 }
      : i === 405
        ? { elapsed: 90000 }
        : i === 410
          ? { penalty: "dnf" }
          : {}),
  }));
  const result = solveSummary(records, {
    today,
    overview: true,
    distribution: true,
  });
  assert.equal(result.count, 1000);
  assert.equal(result.points[0].number, 1);
  assert.equal(result.points.at(-1).number, 1000);
  for (const id of ["400", "405", "410"])
    assert.ok(result.points.some((p) => p.solve.id === id));
  assert.ok(result.points.length <= 202);
  assert.equal(result.points[0].x, 35);
  assert.equal(result.points.at(-1).x, 315);
  assert.equal(result.best, 1000);
  assert.equal(result.dnfs, 1);
  assert.equal(
    result.distribution.bins.reduce((sum, bin) => sum + bin.count, 0),
    999,
  );
  assert.equal(
    solveSummary(records, { today, since: today, overview: true }).count,
    0,
  );
});

test("preset ranges include exactly the selected local calendar days across month, leap and DST boundaries", async () => {
  const { progressRange } = await import("../src/dashboard.js");
  assert.deepEqual(progressRange({ today, range: "1" }), {
    since: today,
    until: today,
  });
  assert.deepEqual(progressRange({ today, range: "7" }), {
    since: "2026-10-11",
    until: today,
  });
  assert.deepEqual(progressRange({ today, range: "30" }), {
    since: "2026-09-18",
    until: today,
  });
  assert.deepEqual(progressRange({ today, range: "90" }), {
    since: "2026-07-20",
    until: today,
  });
  assert.deepEqual(progressRange({ today, range: "all" }), {
    since: "",
    until: today,
  });
  assert.equal(
    progressRange({ today: "2024-03-01", range: "7" }).since,
    "2024-02-24",
  );
  assert.equal(
    progressRange({ today: "2026-03-10", range: "7" }).since,
    "2026-03-04",
  );
  assert.equal(
    progressRange({ today: "2026-11-03", range: "7" }).since,
    "2026-10-28",
  );
  assert.equal(
    progressRange({ today: "2026-01-02", range: "7" }).since,
    "2025-12-27",
  );
});

test("shared preset bounds exclude adjacent dates, preserve inputs and reject removed custom ranges", async () => {
  const { progressRange } = await import("../src/dashboard.js");
  const options = { today, range: "7" };
  const records = ["2026-10-10", "2026-10-11", "2026-10-17", "2026-10-18"].map(
    (day, i) => solve(i, (i + 1) * 1000, { day, date: `${day}T12:00:00Z` }),
  );
  const before = structuredClone(records);
  const activity = activitySummary([], records, options);
  const summary = solveSummary(records, {
    since: activity.since,
    today: activity.until,
    distribution: true,
  });
  assert.equal(activity.totals.solves, 2);
  assert.deepEqual(
    summary.points.map((p) => p.solve.day),
    ["2026-10-11", "2026-10-17"],
  );
  assert.equal(summary.distribution.median, 2500);
  assert.equal(activity.days.size, 4);
  assert.deepEqual(records, before);
  assert.throws(() => progressRange({ today, range: "custom" }));
  assert.throws(() => progressRange({ today, range: "bad" }));
});

test("inline selection navigation covers every filtered solve even when the chart samples it out", async () => {
  const { solveSelection } = await import("../src/dashboard.js");
  const records = Array.from({ length: 1000 }, (_, i) => ({
    id: `nav-${i}`,
    elapsed: 20000,
    day: today,
    date: new Date(Date.UTC(2026, 9, 17, 0, 0, i)).toISOString(),
    cubeId: i === 501 ? "other" : "a",
  }));
  const options = { today, since: today, cube: "a" };
  const summary = solveSummary(records, {
    ...options,
    overview: true,
    selectedId: "nav-502",
  });
  assert.ok(!summary.points.some((p) => p.solve.id === "nav-502"));
  assert.equal(summary.selection.solve.id, "nav-502");
  assert.equal(summary.selection.previousId, "nav-500");
  assert.equal(summary.selection.nextId, "nav-503");
  assert.equal(summary.selection.number, 502);
  assert.deepEqual(
    solveSelection(records, options, "nav-502"),
    summary.selection,
  );
  assert.equal(solveSelection(records, options, "nav-501"), null);
  assert.equal(
    solveSelection(records, { ...options, since: "2026-10-18" }, "nav-502"),
    null,
  );
  assert.equal(solveSelection(records, options, "nav-0").previousId, undefined);
  assert.equal(solveSelection(records, options, "nav-999").nextId, undefined);
});

test("total solving duration formats whole seconds with padded hours and no 24-hour rollover", async () => {
  const { formatSolvingTime } = await import("../src/dashboard.js");
  for (const [milliseconds, expected] of [
    [0, "00:00:00"],
    [999, "00:00:00"],
    [59999, "00:00:59"],
    [60000, "00:01:00"],
    [3599999, "00:59:59"],
    [3600000, "01:00:00"],
    [3661000, "01:01:01"],
    [90061000, "25:01:01"],
    [360000000, "100:00:00"],
  ])
    assert.equal(formatSolvingTime(milliseconds), expected);
  assert.equal(formatSolvingTime(Infinity), "—");
});
