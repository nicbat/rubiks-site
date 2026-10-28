import { courses, moduleById } from "./courses.js";
import { shiftDay, solveDay } from "./dashboard.js";
import { solveTime } from "./solve-history.js";

// The Dashboard's next step: continue the course in progress, or choose a
// first path when nothing is under way. The active course wins when several
// are started.
export function nextStep(progress, summaries) {
  const started = courses.filter(
    (course) =>
      !course.status &&
      summaries[course.id]?.started &&
      !summaries[course.id]?.finished,
  );
  const course =
    started.find((c) => c.id === progress.activeCourse) || started[0];
  if (!course) return { kind: "choose" };
  const { done, total } = summaries[course.id];
  return {
    kind: "continue",
    course,
    module: moduleById(progress.resume?.[course.id] || course.modules[0]),
    done,
    total,
  };
}

// Consecutive days with any practice or solve, counting back from today.
// A streak that reached yesterday still counts until today is over.
export function dayStreak(activeDays, today) {
  let day = activeDays.has(today) ? today : shiftDay(today, -1);
  let count = 0;
  while (activeDays.has(day)) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}

// Today's practice attempts, solves and best time, plus the day streak, from
// one pass over each history.
export function todaySummary(progress, solves, today) {
  const activeDays = new Set();
  let attempts = 0;
  for (const attempt of progress.attempts) {
    activeDays.add(attempt.day);
    if (attempt.day === today) attempts++;
  }
  let solved = 0;
  let best = null;
  for (const solve of solves) {
    const day = solveDay(solve);
    activeDays.add(day);
    if (day !== today) continue;
    solved++;
    const time = solveTime(solve);
    if (Number.isFinite(time) && (best === null || time < best)) best = time;
  }
  return {
    attempts,
    solves: solved,
    best,
    streak: dayStreak(activeDays, today),
  };
}

// One OLL or PLL case per calendar day: the same all day, for everyone, and
// spread across the catalog from one day to the next.
export function caseOfTheDay(catalog, day) {
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return catalog[(hash >>> 0) % catalog.length];
}
