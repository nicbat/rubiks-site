// A small linear congruential generator: deterministic decoration from a
// seed, returning floats in [0, 1). Not for anything that must be fair.
export const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
};
