import { objectiveMethod } from "./learning-methods.js";

// One history scan. Summaries cover both objectives and their explicitly linked
// view; sharing a course never copies an attempt or multiplies activity totals.
export function createProgressIndex(progress, defaultMethod = "full") {
  const selected = new Set(progress.selected);
  const known = new Map();
  for (const field of ["known", "twoLookKnown"])
    for (const [id, variants] of Object.entries(progress[field] || {}))
      for (const variant of variants) known.set(`${id}:${variant}`, true);
  const transfers = new Set(
    (progress.transfers || []).map(
      (t) => `${t.caseId}:${t.variant}:${t.method}`,
    ),
  );
  const cases = new Set();
  const summaries = new Map();
  const days = new Set();
  const attemptsByDay = new Map();
  for (const attempt of progress.attempts) {
    days.add(attempt.day);
    attemptsByDay.set(attempt.day, (attemptsByDay.get(attempt.day) || 0) + 1);
    cases.add(attempt.caseId);
    const method = objectiveMethod(attempt.caseId, attempt.method);
    for (const target of ["full", "two-look", "linked"]) {
      if (
        target !== "linked" &&
        target !== method &&
        attempt.mode !== "rehearsal"
      )
        continue;
      const key = `${attempt.caseId}:${attempt.variant}:${target}`;
      let summary = summaries.get(key);
      if (!summary)
        summaries.set(key, (summary = { attempts: 0, days: new Set() }));
      summary.attempts++;
      if (attempt.mode !== "recognition") continue;
      if (attempt.result !== "confident") summary.days.clear();
      else summary.days.add(attempt.day);
    }
  }
  function isKnown(id, variant = 0) {
    return known.has(`${id}:${variant}`);
  }
  return {
    isKnown,
    isFamiliar: (id, variant = 0) =>
      ["full", "two-look"].some(
        (method) =>
          isKnown(id, variant) ||
          (summaries.get(`${id}:${variant}:${method}`)?.days.size || 0) >= 3,
      ),
    isSelected: (id) => selected.has(id),
    hasAttempts: (id) => cases.has(id),
    practiceDays: days.size,
    attemptsOn: (day) => attemptsByDay.get(day) || 0,
    statusFor(id, variant = 0, method = defaultMethod) {
      const target = transfers.has(`${id}:${variant}:${method}`)
        ? "linked"
        : objectiveMethod(id, method);
      const summary = summaries.get(`${id}:${variant}:${target}`);
      const count = summary?.attempts || 0;
      const confidentDays = summary?.days.size || 0;
      return {
        label: isKnown(id, variant, method)
          ? "Already known"
          : confidentDays >= 3
            ? "Confident"
            : count
              ? "Needs practice"
              : selected.has(id)
                ? "Learning"
                : "Not started",
        days: confidentDays,
        attempts: count,
      };
    },
  };
}
