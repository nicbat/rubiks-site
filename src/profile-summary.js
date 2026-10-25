import { createProgressIndex } from "./progress-index.js";
import { solveSummary } from "./dashboard.js";

// Public summaries have a fixed Full CFOP scope, independent of private filters.
// Legacy solves without a recorded local date use UTC on the server and in demo.
export function profileSummary(data, catalog) {
  const index = createProgressIndex(data.progress, "full");
  const days = new Set(index.dailyActivity().map((entry) => entry.day));
  for (const solve of data.solves)
    days.add(solve.day || new Date(solve.date).toISOString().slice(0, 10));
  const daily = solveSummary(data.solves, {
    today: "9999-12-31",
    distribution: true,
    recentLimit: 0,
  });
  return {
    practice_count: data.progress.attempts.length,
    active_days: days.size,
    confident_count: catalog.filter(
      (c) =>
        index.statusFor(
          c.id,
          data.progress.variants[c.id] ?? c.preferredVariant,
          "full",
        ).label === "Confident",
    ).length,
    case_count: catalog.length,
    total_time_ms: daily.totalTime,
    solve_count: daily.count,
    best_ms: daily.best,
    median_ms: daily.distribution.median,
    best_ao5_ms: daily.best5,
    best_ao12_ms: daily.best12,
  };
}
