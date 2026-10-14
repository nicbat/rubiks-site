import {
  objectiveMethod,
  partialCases,
  twoLookCases,
} from "./learning-methods.js";
import { courseById, reviewIds } from "./courses.js";
export const STORAGE_KEY = "last-layer.progress.v2";
export const emptyProgress = () => ({
  version: 2,
  selected: [],
  variants: {},
  attempts: [],
});
// Explicit knowledge is separate from earned confidence and never invents history.
export function isKnown(progress, id, variant = 0) {
  return ["known", "twoLookKnown"].some((field) =>
    progress[field]?.[id]?.includes(variant),
  );
}
export function setKnown(progress, id, variant, known) {
  // Read legacy marks from either objective; all new declarations are global.
  for (const field of ["known", "twoLookKnown"]) {
    const variants = new Set(progress[field]?.[id] || []);
    variants.delete(variant);
    if (field === "known" && known) variants.add(variant);
    if (variants.size) {
      progress[field] ||= {};
      progress[field][id] = [...variants].sort((a, b) => a - b);
    } else if (progress[field]) {
      delete progress[field][id];
      if (!Object.keys(progress[field]).length) delete progress[field];
    }
  }
}
export function hasTransfer(progress, id, variant, method) {
  return (
    progress.transfers?.some(
      (t) => t.caseId === id && t.variant === variant && t.method === method,
    ) || false
  );
}
export function setTransfer(progress, id, variant, method, enabled) {
  if (!partialCases.includes(id) || !["full", "two-look"].includes(method))
    return;
  const next = (progress.transfers || []).filter(
    (t) => !(t.caseId === id && t.variant === variant && t.method === method),
  );
  if (enabled) next.push({ caseId: id, variant, method });
  if (next.length) progress.transfers = next;
  else delete progress.transfers;
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
    value.version !== 2 ||
    !Array.isArray(value.selected) ||
    !Array.isArray(value.attempts) ||
    !value.variants ||
    typeof value.variants !== "object" ||
    Array.isArray(value.variants)
  )
    throw Error("This is not a Last Layer progress file (version 2).");
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
  const marks = {};
  for (const field of ["known", "twoLookKnown"]) {
    const known = {};
    if (value[field] !== undefined) {
      if (
        !value[field] ||
        typeof value[field] !== "object" ||
        Array.isArray(value[field])
      )
        throw Error("The file contains invalid known algorithms.");
      for (const [id, indices] of Object.entries(value[field])) {
        if (
          !byId.has(id) ||
          (field === "twoLookKnown" && !partialCases.includes(id)) ||
          !Array.isArray(indices) ||
          indices.some(
            (v) => !Number.isInteger(v) || !byId.get(id).algorithms[v],
          )
        )
          throw Error("The file contains an unknown known algorithm variant.");
        if (indices.length)
          known[id] = [...new Set(indices)].sort((a, b) => a - b);
      }
    }
    if (Object.keys(known).length) marks[field] = known;
  }
  const extras = {};
  if (value.reviewed !== undefined) {
    if (
      !Array.isArray(value.reviewed) ||
      value.reviewed.some((id) => !reviewIds.includes(id))
    )
      throw Error("The file contains an unknown lesson.");
    extras.reviewed = [...new Set(value.reviewed)];
  }
  if (value.activeCourse !== undefined) {
    if (!courseById(value.activeCourse))
      throw Error("The file contains an unknown course.");
    extras.activeCourse = value.activeCourse;
  }
  if (value.resume !== undefined) {
    if (
      !value.resume ||
      typeof value.resume !== "object" ||
      Array.isArray(value.resume)
    )
      throw Error("The file contains invalid course positions.");
    extras.resume = {};
    for (const [id, module] of Object.entries(value.resume)) {
      if (!courseById(id)?.modules.includes(module))
        throw Error("The file contains an unknown course module.");
      extras.resume[id] = module;
    }
  }
  if (value.transfers !== undefined) {
    if (!Array.isArray(value.transfers) || value.transfers.length > 1000)
      throw Error("The file contains invalid progress links.");
    const seen = new Set();
    extras.transfers = value.transfers.map((t) => {
      if (
        !t ||
        !partialCases.includes(t.caseId) ||
        !Number.isInteger(t.variant) ||
        !byId.get(t.caseId)?.algorithms[t.variant] ||
        !["full", "two-look"].includes(t.method)
      )
        throw Error("The file contains an invalid progress link.");
      const key = `${t.caseId}:${t.variant}:${t.method}`;
      if (seen.has(key))
        throw Error("The file contains duplicate progress links.");
      seen.add(key);
      return { caseId: t.caseId, variant: t.variant, method: t.method };
    });
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
      (a.method !== undefined &&
        (!["full", "two-look"].includes(a.method) ||
          (a.method === "two-look" && !twoLookCases.includes(a.caseId)))) ||
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
      ...(a.method !== undefined ? { method: a.method } : {}),
    };
  });
  return {
    version: 2,
    selected: [...new Set(value.selected)],
    variants,
    ...marks,
    ...extras,
    attempts: attempts.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  };
}
export function statusFor(progress, id, variant = 0, method = "full") {
  const transfer = hasTransfer(progress, id, variant, method);
  const attempts = progress.attempts.filter(
    (a) =>
      a.caseId === id &&
      a.variant === variant &&
      (transfer ||
        objectiveMethod(id, a.method) === objectiveMethod(id, method) ||
        a.mode === "rehearsal"),
  );
  let days = new Set();
  for (const a of attempts) {
    if (a.mode !== "recognition") continue;
    if (a.result !== "confident") days.clear();
    else days.add(a.day);
  }
  return {
    label:
      isKnown(progress, id, variant, method) ||
      (transfer &&
        isKnown(progress, id, variant, method === "full" ? "two-look" : "full"))
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
