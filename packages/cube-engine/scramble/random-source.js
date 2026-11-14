import { createScrambleError } from "./index.js";
export function checkAbort(signal) {
  if (signal?.aborted) throw createScrambleError("ABORTED");
}
export function secureUint32() {
  if (!globalThis.crypto?.getRandomValues)
    throw createScrambleError(
      "GENERATION_FAILED",
      "Secure randomness unavailable",
    );
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
export function uniformInteger(bound, randomUint32 = secureUint32, signal) {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 2 ** 32)
    throw createScrambleError("GENERATION_FAILED", "Invalid random bound");
  const cutoff = Math.floor(2 ** 32 / bound) * bound;
  for (;;) {
    checkAbort(signal);
    let word;
    try {
      word = randomUint32();
    } catch {
      throw createScrambleError(
        "GENERATION_FAILED",
        "Secure random source failed",
      );
    }
    if (!Number.isInteger(word) || word < 0 || word >= 2 ** 32)
      throw createScrambleError("GENERATION_FAILED", "Invalid random uint32");
    if (word < cutoff) return word % bound;
  }
}
