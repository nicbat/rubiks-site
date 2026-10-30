import { methodGroups } from "./learning-methods.js";

// Small existing curriculum groups; choosing one never changes saved variants,
// known marks, or the learner's current recognition method.
export function starterGroups(catalog) {
  return ["OLL", "PLL"].flatMap((section) =>
    methodGroups(catalog, section, "two-look").map((group, index) => ({
      ...group,
      index: `${section}-${index}`,
      name: `${section} · ${group.name.replace(/^\d+\.\s*/, "")}`,
    })),
  );
}

export function updateCaseSelection(selected, ids, checked, eligible) {
  const allowed = new Set(eligible);
  const next = new Set(selected.filter((id) => allowed.has(id)));
  for (const id of ids) {
    if (!allowed.has(id)) continue;
    if (checked) next.add(id);
    else next.delete(id);
  }
  return [...next];
}
