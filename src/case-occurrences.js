import definitions from "../data/case-occurrences.json" with { type: "json" };

// Standard solve-stage probabilities include skips. Keep these separate from
// the algorithm importer and practice selection, which has its own frequencies.
export function occurrenceStage(section) {
  return definitions[section] ?? null;
}

export function occurrenceFor(c) {
  const stage = occurrenceStage(c.section);
  const weight = stage?.weights[c.id];
  if (!weight) return null;
  let divisor = weight;
  let remainder = stage.denominator;
  while (remainder) [divisor, remainder] = [remainder, divisor % remainder];
  return {
    numerator: weight / divisor,
    denominator: stage.denominator / divisor,
    fraction: `${weight / divisor}/${stage.denominator / divisor}`,
  };
}
