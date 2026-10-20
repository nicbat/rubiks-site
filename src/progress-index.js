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
  const attemptsByDay = new Map();
  // Resolve each case/variant once per attempt instead of allocating composite
  // string keys for every objective. Buckets belong to this snapshot only.
  function bucketFor(id, variant) {
    let variants = summaries.get(id);
    if (!variants) summaries.set(id, (variants = new Map()));
    let bucket = variants.get(variant);
    if (!bucket) variants.set(variant, (bucket = {}));
    return bucket;
  }
  for (const transfer of progress.transfers || [])
    bucketFor(transfer.caseId, transfer.variant).linked = {
      attempts: 0,
      days: new Set(),
    };
  function record(bucket, target, mode, result, day) {
    const summary = (bucket[target] ||= { attempts: 0, days: new Set() });
    summary.attempts++;
    if (mode !== "recognition") return;
    if (result !== "confident") summary.days.clear();
    else summary.days.add(day);
  }
  for (const attempt of progress.attempts) {
    const { caseId, variant, mode, result, day } = attempt;
    let activity = attemptsByDay.get(day);
    if (!activity)
      attemptsByDay.set(
        day,
        (activity = { day, recognition: 0, rehearsal: 0 }),
      );
    activity[mode]++;
    cases.add(caseId);
    const method = objectiveMethod(caseId, attempt.method);
    const bucket = bucketFor(caseId, variant);
    record(bucket, method, mode, result, day);
    if (mode === "rehearsal")
      record(
        bucket,
        method === "full" ? "two-look" : "full",
        mode,
        result,
        day,
      );
    // Combined recognition is needed only for explicitly linked variants.
    if (bucket.linked) record(bucket, "linked", mode, result, day);
  }
  function summaryFor(id, variant, method) {
    return summaries.get(id)?.get(variant)?.[method];
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
          (summaryFor(id, variant, method)?.days.size || 0) >= 3,
      ),
    isSelected: (id) => selected.has(id),
    hasAttempts: (id) => cases.has(id),
    practiceDays: attemptsByDay.size,
    dailyActivity: () => [...attemptsByDay.values()].map((day) => ({ ...day })),
    attemptsOn: (day) => {
      const activity = attemptsByDay.get(day);
      return activity ? activity.recognition + activity.rehearsal : 0;
    },
    statusFor(id, variant = 0, method = defaultMethod) {
      const target = transfers.has(`${id}:${variant}:${method}`)
        ? "linked"
        : objectiveMethod(id, method);
      const summary = summaryFor(id, variant, target);
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
