import { tokens } from "../src/cube.js";

// Catalog maintenance only: case diagrams are derived from these moves, so
// removing a leading regrip also changes the displayed starting orientation.
// Keep rotations within the algorithm and preserve its finger-trick grouping.
export function removeLeadingY(moves) {
  tokens(moves);
  return moves.trim().replace(/^(?:y[23]?'?(?:\s+|$))+/, "");
}
