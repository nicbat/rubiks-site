import { validDay, validTimestamp } from "./dates.js";
export const SOLVES_KEY = "last-layer.solves.v1";
export const MAX_SOLVE_NOTES_LENGTH = 5000;

// Build a candidate without changing live history; publish only after saving it.
export function withSolveChanges(solves, ids, change) {
  const selected = new Set(ids);
  if (change.type === "delete")
    return solves.filter((solve) => !selected.has(solve.id));
  if (change.type !== "cube") throw new Error("Invalid solve change");
  if (
    change.cubeId !== null &&
    (typeof change.cubeId !== "string" || !change.cubeId)
  )
    throw new Error("Invalid cube selection");
  return solves.map((solve) =>
    selected.has(solve.id) ? { ...solve, cubeId: change.cubeId } : solve,
  );
}

export function validateSolves(value) {
  if (!Array.isArray(value) || value.length > 100000)
    throw new Error("Invalid solve history");
  const ids = new Set();
  return value
    .map((solve) => {
      if (
        !solve ||
        typeof solve.id !== "string" ||
        !solve.id ||
        (solve.cubeId !== undefined &&
          solve.cubeId !== null &&
          (typeof solve.cubeId !== "string" || !solve.cubeId)) ||
        ids.has(solve.id) ||
        (solve.notes !== undefined &&
          (typeof solve.notes !== "string" ||
            solve.notes.length > MAX_SOLVE_NOTES_LENGTH)) ||
        (solve.penalty !== undefined &&
          !["+2", "dnf"].includes(solve.penalty)) ||
        !Number.isFinite(solve.elapsed) ||
        solve.elapsed < 0 ||
        !validTimestamp(solve.date) ||
        (solve.day !== undefined && !validDay(solve.day)) ||
        typeof solve.scramble !== "string" ||
        !/^[UDRLFB](?:2|')?(?: [UDRLFB](?:2|')?){19}$/.test(solve.scramble)
      )
        throw new Error("Invalid solve history");
      ids.add(solve.id);
      return {
        id: solve.id,
        ...(solve.cubeId !== undefined ? { cubeId: solve.cubeId } : {}),
        elapsed: solve.elapsed,
        ...(solve.penalty !== undefined ? { penalty: solve.penalty } : {}),
        date: solve.date,
        ...(solve.day !== undefined ? { day: solve.day } : {}),
        scramble: solve.scramble,
        ...(solve.notes !== undefined ? { notes: solve.notes } : {}),
      };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function solveTime(solve) {
  return solve.penalty === "dnf"
    ? Infinity
    : solve.elapsed + (solve.penalty === "+2" ? 2000 : 0);
}

export function recentStats(solves, count) {
  const times = solves
    .slice(-count)
    .map(solveTime)
    .sort((a, b) => a - b);
  return {
    best: times.length ? times[0] : null,
    average:
      times.length === count
        ? times.slice(1, -1).reduce((sum, time) => sum + time, 0) / (count - 2)
        : null,
  };
}
