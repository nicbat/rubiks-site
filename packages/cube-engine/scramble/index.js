import { getEventDefinition } from "../events/index.js";
export const MAX_SCRAMBLE_LENGTH = 4096;
export const MAX_SCRAMBLE_MOVES = 512;
const opposite = Object.freeze({
  white: "yellow",
  yellow: "white",
  green: "blue",
  blue: "green",
  red: "orange",
  orange: "red",
});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function createScrambleError(code, message = code) {
  if (!["UNSUPPORTED_EVENT", "GENERATION_FAILED", "ABORTED"].includes(code))
    throw new TypeError("Invalid scramble error code");
  const error = new Error(message);
  error.name = code === "ABORTED" ? "AbortError" : "ScrambleError";
  error.code = code;
  return error;
}
export function validateEventScramble(eventId, algorithm) {
  const event = getEventDefinition(eventId);
  if (!event) throw createScrambleError("UNSUPPORTED_EVENT");
  if (
    typeof algorithm !== "string" ||
    !algorithm.length ||
    algorithm.length > MAX_SCRAMBLE_LENGTH ||
    /[^URFDLBwxyz0-9' ]/.test(algorithm)
  )
    throw new TypeError("Invalid scramble notation");
  const moves = algorithm.split(" ");
  if (moves.length > MAX_SCRAMBLE_MOVES)
    throw new TypeError("Too many scramble moves");
  for (const token of moves) {
    if (/^[URFDLB](?:2|')?$/.test(token)) continue;
    if (event.blindfolded && /^[xyz](?:2|')?$/.test(token)) continue;
    const wide = /^(?:(\d+))?([URFDLB])w(?:2|')?$/.exec(token);
    const width = wide?.[1] === undefined ? 2 : Number(wide[1]);
    if (
      wide &&
      event.size >= 4 &&
      width >= 2 &&
      width <= Math.floor(event.size / 2) &&
      (wide[1] === undefined || String(width) === wide[1])
    )
      continue;
    throw new TypeError("Invalid scramble notation for event");
  }
  return algorithm;
}
export function validateScrambleGrip(grip) {
  if (
    !grip ||
    typeof grip !== "object" ||
    typeof grip.up !== "string" ||
    typeof grip.front !== "string" ||
    !own(opposite, grip.up) ||
    !own(opposite, grip.front) ||
    grip.up === grip.front ||
    opposite[grip.up] === grip.front
  )
    throw new TypeError("Invalid scramble grip");
  return { up: grip.up, front: grip.front };
}
export function validateScrambleProvenance(value) {
  if (
    !value ||
    typeof value !== "object" ||
    ![value.id, value.version].every(
      (s) =>
        typeof s === "string" &&
        s.trim() === s &&
        s.length > 0 &&
        s.length <= 128 &&
        !/[\u0000-\u001f\u007f]/.test(s),
    ) ||
    !["random-state", "random-move"].includes(value.method)
  )
    throw new TypeError("Invalid scramble provenance");
  return { id: value.id, version: value.version, method: value.method };
}
// This validates structure and notation, never distribution or WCA approval.
export function validateScrambleResult(value, expectedEventId) {
  const event = getEventDefinition(value?.eventId);
  if (!event) throw createScrambleError("UNSUPPORTED_EVENT");
  if (
    value.puzzleId !== event.puzzleId ||
    (expectedEventId !== undefined && event.id !== expectedEventId)
  )
    throw new TypeError("Scramble event mismatch");
  return {
    eventId: event.id,
    puzzleId: event.puzzleId,
    algorithm: validateEventScramble(event.id, value.algorithm),
    generator: validateScrambleProvenance(value.generator),
    grip: validateScrambleGrip(value.grip),
  };
}
