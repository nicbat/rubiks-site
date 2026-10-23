import { dayKey, validDay } from "./progress.js";
import { recentStats, solveTime } from "./solve-history.js";

export const solveDay = (solve) => solve.day || dayKey(new Date(solve.date));

// Use the same calendar grouping as the heatmap, independent of display filters.
export function withoutActivityDay(progress, solves, day) {
  if (!validDay(day)) throw Error("Choose a valid activity date.");
  return {
    progress: {
      ...progress,
      attempts: progress.attempts.filter((a) => a.day !== day),
    },
    solves: solves.filter((s) => solveDay(s) !== day),
  };
}

export function shiftDay(day, amount) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

export const progressRanges = [
  { value: "1", label: "Last day" },
  { value: "7", label: "Last week" },
  { value: "30", label: "Last month" },
  { value: "90", label: "Last 3 months" },
  { value: "all", label: "All time" },
];

// Aggregate raw solving duration; hours do not wrap at midnight.
export function formatSolvingTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const totalSeconds = Math.floor(milliseconds / 1000);
  return [
    Math.floor(totalSeconds / 3600),
    Math.floor(totalSeconds / 60) % 60,
    totalSeconds % 60,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

// Inclusive local calendar dates, not elapsed hours (including across DST).
export function progressRange({ today, range = "30" }) {
  if (!validDay(today)) throw Error("Choose a valid current date.");
  if (range === "all") return { since: "", until: today };
  // Numeric ranges also support existing callers using 28 days.
  if (!/^\d+$/.test(range) || Number(range) < 1 || Number(range) > 365)
    throw Error("Choose a valid time range.");
  return { since: shiftDay(today, 1 - Number(range)), until: today };
}
// Week columns run Sunday through Saturday. Padding is not an interactive day.
export function heatmapWeeks(today, range = "28") {
  const count = range === "all" ? 365 : Number(range);
  const first = shiftDay(today, 1 - count);
  const offset = new Date(`${first}T12:00:00`).getDay();
  const start = shiftDay(first, -offset);
  let previousMonth = "";
  return Array.from({ length: Math.ceil((count + offset) / 7) }, (_, week) => {
    const days = Array.from({ length: 7 }, (_, row) => {
      const day = shiftDay(start, week * 7 + row);
      return day < first || day > today ? null : day;
    });
    const firstDay = days.find(Boolean);
    const month = firstDay.slice(0, 7);
    const label =
      month !== previousMonth
        ? new Date(`${firstDay}T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
          })
        : "";
    previousMonth = month;
    return { label, days };
  });
}
export function activitySummary(
  dailyPractice,
  solves,
  { today, range = "28" },
) {
  const days = new Map(dailyPractice.map((d) => [d.day, { ...d, solves: 0 }]));
  for (const solve of solves) {
    // Older solves have no recorded local day; use this device's timezone.
    const day = solveDay(solve);
    let entry = days.get(day);
    if (!entry)
      days.set(day, (entry = { day, recognition: 0, rehearsal: 0, solves: 0 }));
    entry.solves++;
  }
  const { since, until } = progressRange({ today, range });
  const totals = { recognition: 0, rehearsal: 0, solves: 0, days: 0 };
  for (const entry of days.values())
    if (entry.day >= since && entry.day <= until) {
      totals.recognition += entry.recognition;
      totals.rehearsal += entry.rehearsal;
      totals.solves += entry.solves;
      totals.days++;
    }
  return { days, totals, since, until };
}
function filteredSolves(solves, { since = "", today, cube = "all" }) {
  return solves
    .filter((solve) => {
      const day = solveDay(solve);
      return (
        day >= since &&
        day <= today &&
        (cube === "all" || (solve.cubeId || "none") === cube)
      );
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
function selectionForSorted(solves, id) {
  const index = solves.findIndex((solve) => solve.id === id);
  if (index < 0) return null;
  return {
    solve: solves[index],
    number: index + 1,
    previousId: solves[index - 1]?.id,
    nextId: solves[index + 1]?.id,
  };
}
export function solveSelection(solves, options, id) {
  return selectionForSorted(filteredSolves(solves, options), id);
}
export function solveSummary(
  solves,
  {
    since = "",
    today,
    cube = "all",
    recentLimit = 12,
    distribution = false,
    overview = false,
    selectedId = null,
  },
) {
  const selected = filteredSolves(solves, { since, today, cube });
  let best = null,
    best5 = null,
    best12 = null,
    dnfs = 0,
    totalTime = 0,
    finiteTotal = 0;
  const points = [],
    window = [];
  for (const solve of selected) {
    const time = solveTime(solve);
    totalTime += solve.elapsed;
    if (Number.isFinite(time)) finiteTotal += time;
    if (Number.isFinite(time))
      best = best === null ? time : Math.min(best, time);
    else dnfs++;
    window.push(solve);
    if (window.length > 12) window.shift();
    const ao5 = recentStats(window, 5).average;
    const ao12 = recentStats(window, 12).average;
    if (ao5 !== null && Number.isFinite(ao5))
      best5 = best5 === null ? ao5 : Math.min(best5, ao5);
    if (ao12 !== null && Number.isFinite(ao12))
      best12 = best12 === null ? ao12 : Math.min(best12, ao12);
    points.push({ solve, time, ao5, ao12, number: points.length + 1 });
  }
  const visible = overview ? overviewPoints(points) : points.slice(-200);
  const finite = visible
    .flatMap((p) => [p.time, p.ao5, p.ao12])
    .filter((n) => n !== null && Number.isFinite(n));
  const maximum = Math.max(1000, ...finite) * 1.1;
  const x = (i) =>
    35 +
    ((visible[i].number - visible[0].number) * 280) /
      Math.max(1, visible.at(-1).number - visible[0].number);
  const y = (n) => 180 - (n * 155) / maximum;
  const path = (key) => {
    let connected = false;
    return visible
      .map((p, i) => {
        if (p[key] === null || !Number.isFinite(p[key])) {
          connected = false;
          return "";
        }
        const command = connected ? "L" : "M";
        connected = true;
        return `${command}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`;
      })
      .join(" ");
  };
  return {
    overview,
    selection: selectionForSorted(selected, selectedId),
    count: selected.length,
    totalTime,
    distribution: distribution
      ? solveDistribution(points.map((p) => p.time))
      : null,
    plusTwo: selected.filter((s) => s.penalty === "+2").length,
    mean:
      selected.length > dnfs ? finiteTotal / (selected.length - dnfs) : null,
    best,
    best5,
    best12,
    dnfs,
    ao5: points.at(-1)?.ao5 ?? null,
    ao12: points.at(-1)?.ao12 ?? null,
    points: visible.map((p, i) => ({
      ...p,

      x: x(i),
      y: Number.isFinite(p.time) ? y(p.time) : 12,
    })),
    pathTime: path("time"),
    path5: path("ao5"),
    path12: path("ao12"),
    maximum,
    recent: points.slice(-recentLimit).reverse(),
  };
}

// Equal-width, half-open bins (last bin includes the maximum); DNF is excluded.
export function solveDistribution(times) {
  const values = times.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { bins: [], median: null, q1: null, q3: null };
  const quantile = (fraction) => {
    const index = (values.length - 1) * fraction;
    const low = Math.floor(index);
    return (
      values[low] + (values[Math.ceil(index)] - values[low]) * (index - low)
    );
  };
  const minimum = values[0],
    maximum = values.at(-1);
  const target = Math.max(1000, (maximum - minimum) / 8);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const width = [1, 2, 5, 10].find((n) => n * magnitude >= target) * magnitude;
  const start = Math.floor(minimum / width) * width;
  const count = Math.max(1, Math.ceil((maximum - start) / width));
  const bins = Array.from({ length: count }, (_, i) => ({
    lower: start + i * width,
    upper: start + (i + 1) * width,
    count: 0,
  }));
  for (const value of values)
    bins[Math.min(count - 1, Math.floor((value - start) / width))].count++;
  return {
    bins,
    median: quantile(0.5),
    q1: quantile(0.25),
    q3: quantile(0.75),
  };
}

// Bounded full-history overview: preserve endpoints and each bucket's extrema/DNF.
function overviewPoints(points) {
  if (points.length <= 200) return points;
  const chosen = new Set([0, points.length - 1]);
  const width = Math.ceil(points.length / 50);
  for (let start = 0; start < points.length; start += width) {
    const end = Math.min(points.length, start + width);
    let fastest = start,
      slowest = start,
      dnf = -1;
    for (let i = start; i < end; i++) {
      if (!Number.isFinite(points[i].time)) {
        dnf = i;
        continue;
      }
      if (
        !Number.isFinite(points[fastest].time) ||
        points[i].time < points[fastest].time
      )
        fastest = i;
      if (
        !Number.isFinite(points[slowest].time) ||
        points[i].time > points[slowest].time
      )
        slowest = i;
    }
    chosen.add(fastest);
    chosen.add(slowest);
    chosen.add(end - 1);
    if (dnf >= 0) chosen.add(dnf);
  }
  return [...chosen].sort((a, b) => a - b).map((i) => points[i]);
}
