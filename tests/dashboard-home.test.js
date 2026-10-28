import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  caseOfTheDay,
  dayStreak,
  nextStep,
  todaySummary,
} from "../src/dashboard-home.js";
import { emptyProgress } from "../src/progress.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const summary = (done, total) => ({
  started: done > 0,
  finished: done === total,
  done,
  total,
});

test("a learner with no course under way chooses a first path", () => {
  assert.deepEqual(nextStep(emptyProgress(), {}), { kind: "choose" });
  // Finished courses don't count as under way.
  assert.deepEqual(
    nextStep(emptyProgress(), { beginner: summary(8, 8) }).kind,
    "choose",
  );
});

test("the next step continues the active course at its resume point", () => {
  const progress = {
    ...emptyProgress(),
    activeCourse: "cfop",
    resume: { cfop: "f2l" },
  };
  const step = nextStep(progress, {
    beginner: summary(3, 8),
    cfop: summary(2, 6),
  });
  assert.equal(step.kind, "continue");
  assert.equal(step.course.id, "cfop");
  assert.equal(step.module.id, "f2l");
  assert.deepEqual([step.done, step.total], [2, 6]);
});

test("without an active course, the first started course and its first module are used", () => {
  const step = nextStep(emptyProgress(), { beginner: summary(1, 8) });
  assert.equal(step.course.id, "beginner");
  assert.equal(step.module.id, step.course.modules[0]);
});

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
  assert.deepEqual(todaySummary(progress, solves, "2026-10-28"), {
    attempts: 2,
    solves: 3,
    best: 14000,
    streak: 3,
  });
  assert.deepEqual(todaySummary(emptyProgress(), [], "2026-10-28"), {
    attempts: 0,
    solves: 0,
    best: null,
    streak: 0,
  });
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
