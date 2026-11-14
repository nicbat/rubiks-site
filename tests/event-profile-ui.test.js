import { learningActivity } from "../src/dashboard-home.js";
import { demoStats } from "../src/demo-account.js";
import test from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import SolveTimeline from "../src/components/SolveTimeline.svelte";
import Profile from "../src/components/Profile.svelte";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";
import {
  activitySummary,
  solveSelection,
  solveSummary,
} from "../src/dashboard.js";
import { profileSummaryV2 } from "../src/profile-summary.js";
import { validateProfileStats, visitorProfile } from "../src/profiles.js";
const today = "2026-10-17";
const solves = Array.from({ length: 6 }, (_, index) => [
  {
    id: `fast-${index}`,
    eventId: "222",
    elapsed: 2000 + index * 1000,
    date: `${today}T12:00:${String(index * 2).padStart(2, "0")}Z`,
    day: today,
  },
  {
    id: `slow-${index}`,
    eventId: "333",
    elapsed: 20000 + index * 1000,
    date: `${today}T12:00:${String(index * 2 + 1).padStart(2, "0")}Z`,
    day: today,
  },
]).flat();
const stats = () =>
  profileSummaryV2({ solves, progress: emptyProgress() }, catalog);
test("event chart windows and previous/next navigation cannot cross event boundaries", () => {
  const options = { today, eventId: "222", distribution: true, overview: true };
  const result = solveSummary(solves, options);
  assert.equal(result.count, 6);
  assert.equal(result.best, 2000);
  assert.equal(result.best5, 4000);
  const selection = solveSelection(solves, options, "fast-2");
  assert.equal(selection.previousId, "fast-1");
  assert.equal(selection.nextId, "fast-3");
  assert.equal(solveSelection(solves, options, "slow-2"), null);
  const legacy = [{ ...solves[1], eventId: undefined }];
  assert.equal(solveSummary(legacy, { today, eventId: "333" }).count, 1);
  assert.equal(solveSummary(legacy, { today, eventId: "222" }).count, 0);
  const activity = activitySummary([], solves, {
    today,
    range: "all",
    includeTime: true,
  });
  assert.equal(activity.totals.solves, 12);
  assert.equal(activity.totals.totalTime, 162000);
});
test("v2 public statistics retain validated event fields without exposing extra API data", () => {
  const input = stats();
  input.events["222"].notes = "private";
  input.activity.email = "private";
  const result = validateProfileStats(input);
  assert.equal(result.summary_version, 2);
  assert.equal(result.events["222"].best_ms, 2000);
  assert.equal(result.activity.solve_count, 12);
  assert.equal(result.events["222"].notes, undefined);
  assert.equal(result.activity.email, undefined);
  input.events["222"].best_ms = 1;
  assert.equal(result.events["222"].best_ms, 2000);
  for (const corrupt of [
    (value) => delete value.events["777"],
    (value) => (value.activity.solve_count = -1),
    (value) => (value.events["222"].best_ms = "2"),
    (value) => (value.summary_version = 3),
  ]) {
    const value = stats();
    corrupt(value);
    assert.throws(() => validateProfileStats(value));
  }
  assert.equal(
    visitorProfile({ username: "learner", is_public: false, stats: result })
      .stats,
    null,
  );
});
test("public event selector changes speed records but retains combined activity and suppresses blindfolded averages", () => {
  const profile = { username: "learner", is_public: true, stats: stats() };
  const show = (eventId) =>
    render(Profile, { props: { page: { status: "ready", profile }, eventId } })
      .body;
  const fast = show("222");
  assert.match(fast, /Profile solve event/);
  assert.match(fast, /0:02\.00/);
  assert.match(fast, /12<\/strong><span>Solves · all events/);
  assert.match(fast, /00:02:42/);
  const slow = show("333");
  assert.match(slow, /0:20\.00/);
  assert.doesNotMatch(slow, /0:02\.00/);
  const blind = show("333bf");
  assert.doesNotMatch(blind, /Best ao5|Best ao12/);
  const privatePage = render(Profile, {
    props: {
      page: { status: "ready", profile: { ...profile, is_public: false } },
    },
  }).body;
  assert.doesNotMatch(privatePage, /Profile solve event|0:02\.00/);
});

test("blindfolded charts suppress average series, legend and inspection rows", () => {
  const summary = solveSummary(
    solves.filter((solve) => solve.eventId === "333"),
    { today, averages: false },
  );
  assert.equal(summary.path5.trim(), "");
  assert.equal(summary.path12.trim(), "");
  assert.ok(
    summary.points.every((point) => point.ao5 === null && point.ao12 === null),
  );
  const html = render(SolveTimeline, { props: { summary } }).body;
  assert.doesNotMatch(
    html,
    /Lines show ao5|data-chart-series="ao5"|class="average-five"|rolling averages/,
  );
});
test("a legacy public summary always labels its flat records as 3×3", () => {
  const { summary_version, events, activity, ...legacy } = stats();
  const html = render(Profile, {
    props: {
      eventId: "222",
      page: {
        status: "ready",
        profile: { username: "learner", is_public: true, stats: legacy },
      },
    },
  }).body;
  assert.match(html, /3×3 · All cubes/);
  assert.doesNotMatch(html, /2×2 · All cubes|Profile solve event/);
});

test("Dashboard best time stays event-specific while daily activity counts all events", () => {
  const index = { dailyActivity: () => [], attemptsOn: () => 0 };
  const regular = learningActivity(index, solves, today);
  assert.equal(regular.best, 20000);
  assert.equal(regular.recent[0].solves, 12);
  assert.equal(learningActivity(index, solves, today, "222").best, 2000);
  const data = { version: 2, solves, progress: emptyProgress() };
  assert.equal(demoStats(data, catalog).events["222"].best_ms, 2000);
});
