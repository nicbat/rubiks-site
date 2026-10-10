// Build a fresh snapshot per render: imports, in-place edits, and new attempts
// cannot leave cached confidence behind. History is scanned once for all cases.
export function createProgressIndex(progress) {
  const selected = new Set(progress.selected);
  const cases = new Map();
  const days = new Set();
  const attemptsByDay = new Map();
  for (const attempt of progress.attempts) {
    days.add(attempt.day);
    attemptsByDay.set(attempt.day, (attemptsByDay.get(attempt.day) || 0) + 1);
    let variants = cases.get(attempt.caseId);
    if (!variants) cases.set(attempt.caseId, (variants = new Map()));
    let summary = variants.get(attempt.variant);
    if (!summary)
      variants.set(
        attempt.variant,
        (summary = { attempts: 0, days: new Set() }),
      );
    summary.attempts++;
    if (attempt.mode !== "recognition") continue;
    if (attempt.result === "confident") summary.days.add(attempt.day);
    else summary.days.clear();
  }
  return {
    hasAttempts: (id) => cases.has(id),
    isSelected: (id) => selected.has(id),
    practiceDays: days.size,
    attemptsOn: (day) => attemptsByDay.get(day) || 0,
    statusFor(id, variant = 0) {
      const summary = cases.get(id)?.get(variant);
      const count = summary?.attempts || 0;
      const confidentDays = summary?.days.size || 0;
      return {
        label:
          confidentDays >= 3
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
