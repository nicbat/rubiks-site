import definitions from "../data/learning-methods.json" with { type: "json" };

// Partial-pattern recognition is a distinct objective even with identical moves.
export const partialCases = Object.values(definitions).flatMap((section) =>
  section.groups
    .filter((group) => group.mask)
    .flatMap((group) => group.caseIds),
);
export const twoLookCases = Object.values(definitions).flatMap((section) =>
  section.groups.flatMap((group) => group.caseIds),
);
export const objectiveMethod = (id, method = "full") =>
  method === "two-look" && partialCases.includes(id) ? "two-look" : "full";

export const learningMethods = [
  { value: "full", label: "Full OLL / PLL" },
  { value: "two-look", label: "2-look OLL / PLL" },
];

export function recommendedVariant(c, method = "full") {
  return method === "two-look"
    ? (definitions[c.section]?.recommendedVariants?.[c.id] ??
        c.preferredVariant)
    : c.preferredVariant;
}

// Retain original case objects: shared IDs and variant indices keep practice and
// saved progress consistent when switching between full and two-look learning.
export function methodGroups(catalog, section, method = "full") {
  const cases = catalog.filter((c) => c.section === section);
  if (method === "two-look") {
    const definition = definitions[section];
    if (!definition) return [];
    const byId = new Map(cases.map((c) => [c.id, c]));
    return definition.groups.map((group) => ({
      name: group.name,
      description: group.description,
      labels: { ...group.labels },
      source: definition.source,
      mask: group.mask,
      cases: group.caseIds.map((id) => byId.get(id)).filter(Boolean),
    }));
  }
  return [...new Set(cases.map((c) => c.group))].map((name) => ({
    name,
    description: "",
    labels: {},
    cases: cases.filter((c) => c.group === name),
  }));
}
