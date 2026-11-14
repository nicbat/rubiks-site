// Bounded internal composition. Never changes the public 512-move scramble cap.
const axis = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const order = [
  "U",
  "Uw",
  "D",
  "Dw",
  "R",
  "Rw",
  "L",
  "Lw",
  "F",
  "Fw",
  "B",
  "Bw",
];
/** Join up to four individually bounded stage algorithms, commuting only turns
 * about the same axis. No rotations, heuristic rewrites, or target replacement. */
export function joinFourByFourStages(stages) {
  if (!Array.isArray(stages) || stages.length > 4)
    throw new TypeError("Expected at most four 4x4 stages.");
  const stack = [];
  for (const algorithm of stages) {
    if (
      typeof algorithm !== "string" ||
      algorithm.length > 4096 ||
      /[^URFDLBw2' ]/.test(algorithm) ||
      (algorithm &&
        !/^[URFDLB]w?(?:2|')?(?: [URFDLB]w?(?:2|')?)*$/.test(algorithm))
    )
      throw new TypeError("Invalid 4x4 stage algorithm.");
    const tokens = algorithm ? algorithm.split(" ") : [];
    if (tokens.length > 512)
      throw new TypeError("Too many moves in 4x4 stage.");
    for (const token of tokens) {
      const face = token.replace(/[2']$/, "");
      const turns = token.endsWith("2") ? 2 : token.endsWith("'") ? 3 : 1;
      const a = axis[token[0]];
      if (stack.at(-1)?.axis !== a) stack.push({ axis: a, turns: new Map() });
      const current = stack.at(-1).turns;
      const amount = ((current.get(face) || 0) + turns) % 4;
      if (amount) current.set(face, amount);
      else current.delete(face);
      if (!current.size) stack.pop();
    }
  }
  return stack
    .flatMap(({ turns }) =>
      order
        .filter((face) => turns.has(face))
        .map((face) => face + ["", "", "2", "'"][turns.get(face)]),
    )
    .join(" ");
}
