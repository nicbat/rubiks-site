import { EVENT_IDS, isEventId } from "./cube-events.js";
import { solveSummary } from "./dashboard.js";

const recordedDay = (record, timestamp) =>
  record.day || new Date(record[timestamp]).toISOString().slice(0, 10);

// Accept validated histories. Missing event IDs are permitted only at an
// explicitly requested legacy boundary, never for unknown/native-v2 events.
export function eventSolveStats(
  solves,
  { legacy = false, practiceAttempts = [] } = {},
) {
  const groups = Object.fromEntries(EVENT_IDS.map((id) => [id, []]));
  const days = new Set(
    practiceAttempts.map((attempt) => recordedDay(attempt, "at")),
  );
  let totalTime = 0;
  let count = 0;
  // One traversal of the source history, then independent per-event windows.
  for (const solve of solves) {
    const eventId =
      legacy && solve.eventId === undefined ? "333" : solve.eventId;
    if (!isEventId(eventId)) throw new Error("Invalid solve event.");
    groups[eventId].push(solve);
    count++;
    totalTime += solve.elapsed;
    days.add(recordedDay(solve, "date"));
  }
  const events = Object.fromEntries(
    EVENT_IDS.map((id) => {
      const stats = solveSummary(groups[id], {
        today: "9999-12-31",
        distribution: true,
        recentLimit: 0,
      });
      return [
        id,
        {
          solve_count: stats.count,
          total_time_ms: stats.totalTime,
          best_ms: stats.best,
          median_ms: stats.distribution.median,
          best_ao5_ms: stats.best5,
          best_ao12_ms: stats.best12,
        },
      ];
    }),
  );
  return {
    activity: {
      solve_count: count,
      total_time_ms: totalTime,
      practice_count: practiceAttempts.length,
      active_days: days.size,
    },
    events,
  };
}
