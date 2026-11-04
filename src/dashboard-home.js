import { shiftDay, solveDay } from "./dashboard.js";
import { solveTime } from "./solve-history.js";

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

// Reuse the render's progress index: never scan attempt history a second time.
// Solves are counted once, including DNF activity but excluding it from best time.
export function learningActivity(index, solves, today) {
  const days = new Map(
    index
      .dailyActivity()
      .filter((day) => day.day <= today)
      .map((day) => [day.day, { ...day, solves: 0 }]),
  );
  let best = null;
  for (const solve of solves) {
    const day = solveDay(solve);
    if (day > today) continue;
    let entry = days.get(day);
    if (!entry)
      days.set(day, (entry = { day, recognition: 0, rehearsal: 0, solves: 0 }));
    entry.solves++;
    if (day === today) {
      const time = solveTime(solve);
      if (Number.isFinite(time) && (best === null || time < best)) best = time;
    }
  }
  return {
    attempts: index.attemptsOn(today),
    best,
    streak: dayStreak(new Set(days.keys()), today),
    recent: [...days.values()]
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 3),
  };
}

// One OLL or PLL case per calendar day: the same all day, for everyone, and
// spread across the catalog from one day to the next.
export function caseOfTheDay(catalog, day) {
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return catalog[(hash >>> 0) % catalog.length];
}
