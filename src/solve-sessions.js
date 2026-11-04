import { progressRange, solveSummary } from "./dashboard.js";
import { recentStats, solveTime } from "./solve-history.js";

export const SESSION_BREAK = 30 * 60 * 1000;

export const timerRanges = [
  { value: "session", label: "This session" },
  { value: "30", label: "Last month" },
  { value: "all", label: "All time" },
];

// The latest run of solves with no break longer than 30 minutes between
// finishing one solve and starting the next. A longer break since the last
// solve starts a new, empty session. Solves are chronological; the scan stops
// at the session's first solve.
export function currentSession(solves, now, gap = SESSION_BREAK) {
  let start = solves.length;
  let next = now;
  while (start > 0) {
    const solve = solves[start - 1];
    const finished = Date.parse(solve.date);
    if (next - finished > gap) break;
    next = finished - solve.elapsed;
    start--;
  }
  return solves.slice(start);
}

// Compare the hundredths readouts show, so the difference matches them.
function change(time, previous) {
  return time !== null &&
    previous !== null &&
    Number.isFinite(time) &&
    Number.isFinite(previous)
    ? (Math.floor(time / 10) - Math.floor(previous / 10)) * 10
    : null;
}

// Negative changes are faster. DNF and missing solves have no change.
export function sessionProgress(session) {
  let best = null,
    total = 0,
    finite = 0;
  for (const solve of session) {
    const time = solveTime(solve);
    if (!Number.isFinite(time)) continue;
    best = best === null ? time : Math.min(best, time);
    total += time;
    finite++;
  }
  const ao5 = recentStats(session, 5).average;
  return {
    count: session.length,
    best,
    mean: finite ? total / finite : null,
    change: change(
      session.length ? solveTime(session.at(-1)) : null,
      session.length > 1 ? solveTime(session.at(-2)) : null,
    ),
    ao5,
    ao5Change:
      session.length > 5
        ? change(ao5, recentStats(session.slice(0, 5), 5).average)
        : null,
  };
}

function magnitude(milliseconds, minutes) {
  const hundredths = Math.round(Math.abs(milliseconds) / 10);
  const seconds = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, "0");
  return minutes && seconds >= 60
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.${fraction}`
    : `${seconds}.${fraction}`;
}

// Signed readout: "−5.00" faster, "+1.20" slower; minutes only past 60s.
export function formatChange(milliseconds, minutes = true) {
  const text = magnitude(milliseconds, minutes);
  return milliseconds < 0 ? `−${text}` : milliseconds > 0 ? `+${text}` : text;
}

// The solve before the one on the clock: before the finished solve when one
// is shown, otherwise the session's latest. Earlier sessions don't count.
export function previousSolve(session, currentId = null) {
  const index = currentId
    ? session.findIndex((solve) => solve.id === currentId)
    : session.length;
  return index > 0 ? session[index - 1] : null;
}

export function timerTrend(solves, range, { session, today }) {
  if (range === "session") return solveSummary(session, { today });
  if (!timerRanges.some((option) => option.value === range))
    throw Error("Choose a valid time range.");
  return solveSummary(solves, {
    since: progressRange({ today, range }).since,
    today,
    overview: true,
  });
}
