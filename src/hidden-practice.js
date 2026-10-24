import { methodGroups, recommendedVariant } from "./learning-methods.js";
import { learnedStatus } from "./library.js";
import { withCaseProperties } from "./bulk-properties.js";

// Consume the existing render index; never scan attempt history per case.
export function hiddenPracticeCases(
  catalog,
  progress,
  { source = "learning", section = "both", method = "full" } = {},
  index,
) {
  const available = new Set(
    ["OLL", "PLL"]
      .filter((name) => section === "both" || section === name)
      .flatMap((name) =>
        methodGroups(catalog, name, method).flatMap((group) =>
          group.cases.map((c) => c.id),
        ),
      ),
  );
  const selected = new Set(progress.selected);
  return catalog.filter((c) => {
    if (!available.has(c.id)) return false;
    if (source !== "known") return selected.has(c.id);
    const variant = progress.variants[c.id] ?? recommendedVariant(c, method);
    return learnedStatus(index.statusFor(c.id, variant, method));
  });
}

// One candidate/save combines the explicit declaration with a real difficult
// attempt. Prior confidence and history are retained, then recalculated normally.
export function withRelearnedCase(progress, attempt) {
  const next = withCaseProperties(
    progress,
    [{ id: attempt.caseId, variant: attempt.variant }],
    { known: "remove", learningSet: "add" },
  );
  next.attempts = [
    ...progress.attempts,
    { ...attempt, result: "help", mode: "recognition" },
  ];
  return next;
}
