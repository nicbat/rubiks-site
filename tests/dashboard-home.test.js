import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  caseOfTheDay,
  dayStreak,
  learningActivity,
} from "../src/dashboard-home.js";
import { createProgressIndex } from "../src/progress-index.js";
import { emptyProgress } from "../src/progress.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
test("a day streak counts back from today, or from yesterday until today ends", () => {
  const days = new Set(["2026-10-25", "2026-10-26", "2026-10-27"]);
  assert.equal(dayStreak(days, "2026-10-27"), 3);
  assert.equal(dayStreak(days, "2026-10-28"), 3, "yesterday still counts");
  assert.equal(dayStreak(days, "2026-10-29"), 0, "a missed day ends it");
  assert.equal(dayStreak(new Set(), "2026-10-28"), 0);
  // Month boundaries follow the calendar.
  assert.equal(
    dayStreak(new Set(["2026-09-30", "2026-10-01"]), "2026-10-01"),
    2,
  );
});

test("today's summary counts attempts and solves and ignores DNF for the best", () => {
  const progress = {
    ...emptyProgress(),
    attempts: [
      { day: "2026-10-27" },
      { day: "2026-10-28" },
      { day: "2026-10-28" },
    ],
  };
  const solves = [
    { date: "2026-10-26T12:00:00", day: "2026-10-26", elapsed: 9000 },
    { date: "2026-10-28T12:00:00", day: "2026-10-28", elapsed: 15000 },
    {
      date: "2026-10-28T12:05:00",
      day: "2026-10-28",
      elapsed: 12000,
      penalty: "+2",
    },
    {
      date: "2026-10-28T12:10:00",
      day: "2026-10-28",
      elapsed: 8000,
      penalty: "dnf",
    },
  ];
  for (const attempt of progress.attempts)
    Object.assign(attempt, {
      caseId: "pll-T",
      variant: 0,
      mode: "recognition",
      result: "confident",
    });
  assert.deepEqual(
    learningActivity(createProgressIndex(progress), solves, "2026-10-28"),
    {
      attempts: 2,
      best: 14000,
      streak: 3,
      recent: [
        { day: "2026-10-28", recognition: 2, rehearsal: 0, solves: 3 },
        { day: "2026-10-27", recognition: 1, rehearsal: 0, solves: 0 },
        { day: "2026-10-26", recognition: 0, rehearsal: 0, solves: 1 },
      ],
    },
  );
  assert.deepEqual(
    learningActivity(createProgressIndex(emptyProgress()), [], "2026-10-28"),
    {
      attempts: 0,
      best: null,
      streak: 0,
      recent: [],
    },
  );
});

test("the case of the day is stable within a day and varies across days", () => {
  const day = caseOfTheDay(catalog, "2026-10-28");
  assert.equal(caseOfTheDay(catalog, "2026-10-28"), day);
  assert.ok(["OLL", "PLL"].includes(day.section));
  // Over a month, the pick reaches a good spread of the 78 cases.
  const picks = new Set();
  for (let d = 1; d <= 30; d++)
    picks.add(
      caseOfTheDay(catalog, `2026-11-${String(d).padStart(2, "0")}`).id,
    );
  assert.ok(picks.size >= 20, `${picks.size} distinct cases`);
});

test("recent activity is bounded, uses recorded dates and leaves the index and solves unchanged", () => {
  const daily = [
    { day: "2026-10-26", recognition: 1, rehearsal: 2 },
    { day: "2026-10-28", recognition: 2, rehearsal: 1 },
    { day: "2026-10-30", recognition: 99, rehearsal: 0 },
  ];
  const solves = [
    { day: "2026-10-25", date: "2026-10-26T01:00:00Z", elapsed: 9000 },
    { day: "2026-10-27", date: "2026-10-28T01:00:00Z", elapsed: 12000 },
    { day: "2026-10-29", date: "2026-10-29T12:00:00Z", elapsed: 1000 },
  ];
  const original = structuredClone({ daily, solves });
  const result = learningActivity(
    { dailyActivity: () => daily, attemptsOn: () => 3 },
    solves,
    "2026-10-28",
  );
  assert.equal(result.streak, 4);
  assert.equal(result.best, null);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.recent, [
    { day: "2026-10-28", recognition: 2, rehearsal: 1, solves: 0 },
    { day: "2026-10-27", recognition: 0, rehearsal: 0, solves: 1 },
    { day: "2026-10-26", recognition: 1, rehearsal: 2, solves: 0 },
  ]);
  assert.deepEqual({ daily, solves }, original);
});
