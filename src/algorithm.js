import { tokens } from "./cube.js";
import { escape } from "./html.js";

// Compile once; longest matches take precedence over their shorter sub-triggers.
export function createAlgorithmRenderer(triggers) {
  const patterns = triggers
    .map((trigger) => ({ ...trigger, tokens: tokens(trigger.moves) }))
    .filter((trigger) => trigger.tokens.length)
    .sort((a, b) => b.tokens.length - a.tokens.length);
  return function chunks(moves) {
    const movesList = tokens(moves);
    const matchAt = (i) =>
      patterns.find((trigger) =>
        trigger.tokens.every((move, j) => movesList[i + j] === move),
      );
    const out = [];
    for (let i = 0; i < movesList.length;) {
      const match = matchAt(i);
      if (match) {
        out.push(
          `<details class="trigger"><summary>${escape(match.moves)}</summary><span>${escape(match.name)}</span></details>`,
        );
        i += match.tokens.length;
      } else {
        const plain = [];
        do {
          plain.push(movesList[i++]);
        } while (i < movesList.length && !matchAt(i));
        out.push(`<span class="plain-moves">${escape(plain.join(" "))}</span>`);
      }
    }
    return `<div class="algorithm" aria-label="Algorithm">${out.join("")}</div>`;
  };
}
