export const STORAGE_KEY = "last-layer.progress.v1";
export const emptyProgress = () => ({
  version: 1,
  selected: [],
  variants: {},
  attempts: [],
});
// Explicit knowledge is separate from earned confidence and never invents history.
export function isKnown(progress, id, variant = 0) {
  return progress.known?.[id]?.includes(variant) || false;
}
export function setKnown(progress, id, variant, known) {
  const variants = new Set(progress.known?.[id] || []);
  if (known) variants.add(variant);
  else variants.delete(variant);
  if (variants.size) {
    progress.known ||= {};
    progress.known[id] = [...variants].sort((a, b) => a - b);
  } else if (progress.known) {
    delete progress.known[id];
    if (!Object.keys(progress.known).length) delete progress.known;
  }
}
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
// Imported history must be valid before it can affect confidence or storage.
function validDay(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === day
  );
}
function validTimestamp(at) {
  if (typeof at !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      at,
    );
  if (
    !match ||
    !validDay(match[1]) ||
    +match[2] > 23 ||
    +match[3] > 59 ||
    +match[4] > 59
  )
    return false;
  return Number.isFinite(Date.parse(at));
}
export function validateProgress(value, catalog) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1 ||
    !Array.isArray(value.selected) ||
    !Array.isArray(value.attempts) ||
    !value.variants ||
    typeof value.variants !== "object" ||
    Array.isArray(value.variants)
  )
    throw Error("This is not a Last Layer progress file (version 1).");
  if (value.attempts.length > 100000)
    throw Error("This file has too many attempts.");
  const byId = new Map(catalog.map((c) => [c.id, c]));
  if (value.selected.some((id) => !byId.has(id)))
    throw Error("The file contains unknown cases.");
  const variants = {};
  for (const [id, v] of Object.entries(value.variants)) {
    if (!byId.has(id) || !Number.isInteger(v) || !byId.get(id).algorithms[v])
      throw Error("The file contains an unknown algorithm variant.");
    variants[id] = v;
  }
  const known = {};
  if (value.known !== undefined) {
    if (
      !value.known ||
      typeof value.known !== "object" ||
      Array.isArray(value.known)
    )
      throw Error("The file contains invalid known algorithms.");
    for (const [id, indices] of Object.entries(value.known)) {
      if (
        !byId.has(id) ||
        !Array.isArray(indices) ||
        indices.some((v) => !Number.isInteger(v) || !byId.get(id).algorithms[v])
      )
        throw Error("The file contains an unknown known algorithm variant.");
      if (indices.length)
        known[id] = [...new Set(indices)].sort((a, b) => a - b);
    }
  }
  const attempts = value.attempts.map((a) => {
    if (
      !a ||
      typeof a !== "object" ||
      Array.isArray(a) ||
      !byId.has(a.caseId) ||
      !["help", "effort", "confident"].includes(a.result) ||
      !["recognition", "rehearsal"].includes(a.mode) ||
      !Number.isInteger(a.variant) ||
      !byId.get(a.caseId).algorithms[a.variant] ||
      !validTimestamp(a.at) ||
      !validDay(a.day)
    )
      throw Error("The file contains an invalid practice result.");
    return {
      caseId: a.caseId,
      result: a.result,
      mode: a.mode,
      variant: a.variant,
      at: a.at,
      day: a.day,
    };
  });
  return {
    version: 1,
    selected: [...new Set(value.selected)],
    variants,
    ...(Object.keys(known).length ? { known } : {}),
    attempts: attempts.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  };
}
export function statusFor(progress, id, variant = 0) {
  const attempts = progress.attempts.filter(
    (a) => a.caseId === id && a.variant === variant,
  );
  let days = new Set();
  for (const a of attempts) {
    if (a.mode !== "recognition") continue;
    if (a.result !== "confident") days.clear();
    else days.add(a.day);
  }
  return {
    label: isKnown(progress, id, variant)
      ? "Already known"
      : days.size >= 3
        ? "Confident"
        : attempts.length
          ? "Needs practice"
          : progress.selected.includes(id)
            ? "Learning"
            : "Not started",
    days: days.size,
    attempts: attempts.length,
  };
}
