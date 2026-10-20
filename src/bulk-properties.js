import { setKnown } from "./progress.js";

// Return a candidate for one save; failed writes can retain the original progress.
// Choices capture each case's currently displayed algorithm variant.
export function withCaseProperties(
  progress,
  choices,
  { known = "keep", learningSet = "keep" } = {},
) {
  if (
    ![known, learningSet].every((value) =>
      ["keep", "add", "remove"].includes(value),
    )
  )
    throw Error("Invalid bulk property change.");
  const next = { ...progress };
  if (known !== "keep") {
    for (const field of ["known", "twoLookKnown"])
      if (progress[field]) next[field] = { ...progress[field] };
    for (const { id, variant } of choices)
      setKnown(next, id, variant, known === "add");
  }
  if (learningSet !== "keep") {
    const selected = new Set(progress.selected);
    for (const { id } of choices) {
      if (learningSet === "add") selected.add(id);
      else selected.delete(id);
    }
    next.selected = [...selected];
  }
  return next;
}
