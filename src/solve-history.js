export const SOLVES_KEY = "last-layer.solves.v1";

export function validateSolves(value) {
  if (!Array.isArray(value)) throw new Error("Invalid solve history");
  const ids = new Set();
  return value.map((solve) => {
    if (
      !solve ||
      typeof solve.id !== "string" ||
      !solve.id ||
      (solve.cubeId !== undefined &&
        solve.cubeId !== null &&
        (typeof solve.cubeId !== "string" || !solve.cubeId)) ||
      ids.has(solve.id) ||
      !Number.isFinite(solve.elapsed) ||
      solve.elapsed < 0 ||
      typeof solve.date !== "string" ||
      !Number.isFinite(Date.parse(solve.date)) ||
      typeof solve.scramble !== "string" ||
      !/^[UDRLFB](?:2|')?(?: [UDRLFB](?:2|')?){19}$/.test(solve.scramble)
    )
      throw new Error("Invalid solve history");
    ids.add(solve.id);
    return {
      id: solve.id,
      ...(solve.cubeId !== undefined ? { cubeId: solve.cubeId } : {}),
      elapsed: solve.elapsed,
      date: solve.date,
      scramble: solve.scramble,
    };
  });
}

export function recentStats(solves, count) {
  const times = solves
    .slice(-count)
    .map((s) => s.elapsed)
    .sort((a, b) => a - b);
  return {
    best: times.length ? times[0] : null,
    average:
      times.length === count
        ? times.slice(1, -1).reduce((sum, time) => sum + time, 0) / (count - 2)
        : null,
  };
}
