import { tokens } from "./cube.js";

// Compile once. Longest matches win; stable sorting preserves catalog tie order.
export function createAlgorithmTokenizer(triggers) {
  const patterns = triggers
    .map((trigger) => ({ ...trigger, tokens: tokens(trigger.moves) }))
    .filter((trigger) => trigger.tokens.length)
    .sort((a, b) => b.tokens.length - a.tokens.length);
  return (moves) => {
    const list = tokens(moves);
    const chunks = [];
    for (let i = 0; i < list.length;) {
      const match = patterns.find((pattern) =>
        pattern.tokens.every((move, j) => list[i + j] === move),
      );
      if (match) {
        chunks.push({ name: match.name, moves: match.moves });
        i += match.tokens.length;
      } else {
        const last = chunks.at(-1);
        if (last && !last.name) last.moves += " " + list[i++];
        else chunks.push({ moves: list[i++] });
      }
    }
    return chunks;
  };
}
