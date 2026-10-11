import { caseCube } from "./cube.js";
import { diagram } from "./diagram.js";

// Cache final strings, never mutable facelets. Include every rendering input;
// editing a catalog algorithm or switching variants needs no invalidation hook.
// Bound memory even when callers supply an unlimited number of custom cases.
export function createCaseDiagramRenderer(limit = 256) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError("Cache limit must be a positive integer");
  const cache = new Map();
  return function renderCaseDiagram(
    moves,
    section,
    label,
    { arrows = false, mask } = {},
  ) {
    const key = JSON.stringify([moves, section, label, Boolean(arrows), mask]);
    if (cache.has(key)) {
      const svg = cache.get(key);
      cache.delete(key);
      cache.set(key, svg);
      return svg;
    }
    const svg = diagram(caseCube(moves), section, label, { arrows, mask });
    cache.set(key, svg);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return svg;
  };
}
export const caseDiagram = createCaseDiagramRenderer();
