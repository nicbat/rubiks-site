// Original raw-coordinate first-stage search. This groups one opposite color
// pair only; it does not solve centers individually, pair wings, or scramble 444.
import {
  FOUR_BY_FOUR_COORDINATES,
  FOUR_BY_FOUR_MOVES,
  fourByFourCenterMovePermutation,
  validateFourByFourState,
} from "./four-by-four-state.js";

const slots = 24,
  selected = 8;
const choose = Array.from(
  { length: slots + 1 },
  () => new Uint32Array(selected + 1),
);
for (let n = 0; n <= slots; n++) {
  choose[n][0] = 1;
  for (let k = 1; k <= Math.min(n, selected); k++)
    choose[n][k] = n === k ? 1 : choose[n - 1][k - 1] + choose[n - 1][k];
}
export const FOUR_BY_FOUR_CENTER_COORDINATES = choose[slots][selected];
const pairs = Object.freeze({ UD: [0, 3], RL: [1, 4], FB: [2, 5] });
const error = (code, message) => Object.assign(new Error(message), { code });
function rankUnchecked(mask) {
  let result = 0,
    count = 0;
  while (mask) {
    const bit = mask & -mask;
    result += choose[31 - Math.clz32(bit)][++count];
    mask ^= bit;
  }
  return result;
}
/** Colexicographic coordinate for exactly eight of the 24 center positions. */
export function rankFourByFourCenters(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask >= 2 ** slots)
    throw new TypeError("A 24-bit center mask is required.");
  let count = 0;
  for (let bits = mask; bits; bits &= bits - 1) count++;
  if (count !== selected)
    throw new TypeError("Exactly eight centers are required.");
  return rankUnchecked(mask);
}
export function unrankFourByFourCenters(index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= FOUR_BY_FOUR_CENTER_COORDINATES
  )
    throw new RangeError("Invalid opposite-center coordinate.");
  let mask = 0,
    position = slots - 1;
  for (let count = selected; count > 0; count--) {
    while (choose[position][count] > index) position--;
    mask |= 1 << position;
    index -= choose[position--][count];
  }
  return mask;
}
function pairColors(pair) {
  if (typeof pair !== "string" || !Object.hasOwn(pairs, pair))
    throw new TypeError("Expected center pair UD, RL or FB.");
  return pairs[pair];
}
export function fourByFourCenterMask(state, pair = "UD") {
  const colors = pairColors(pair);
  const validated = validateFourByFourState(state);
  let mask = 0;
  validated.centerColors.forEach((color, i) => {
    if (colors.includes(color)) mask |= 1 << i;
  });
  return mask;
}
function goalMask(pair) {
  const colors = pairColors(pair);
  let mask = 0;
  FOUR_BY_FOUR_COORDINATES.centers.forEach((slot, i) => {
    if (colors.includes(FOUR_BY_FOUR_COORDINATES.faces.indexOf(slot.faces[0])))
      mask |= 1 << i;
  });
  return mask;
}
let moveBits;
function transitions() {
  return (moveBits ||= FOUR_BY_FOUR_MOVES.map((move) => {
    const result = new Uint32Array(slots);
    fourByFourCenterMovePermutation(move).forEach((source, destination) => {
      result[source] = 1 << destination;
    });
    return result;
  }));
}
function moveMask(mask, bits) {
  let result = 0;
  while (mask) {
    const bit = mask & -mask;
    result |= bits[31 - Math.clz32(bit)];
    mask ^= bit;
  }
  return result;
}
export function moveFourByFourCenterCoordinate(index, move) {
  const mask = unrankFourByFourCenters(index);
  const moveIndex = FOUR_BY_FOUR_MOVES.indexOf(move);
  if (moveIndex < 0)
    throw new TypeError("Expected one canonical 4x4 outer or wide turn.");
  return rankUnchecked(moveMask(mask, transitions()[moveIndex]));
}
const inverseMove = (move) =>
  move.endsWith("2")
    ? move
    : move.endsWith("'")
      ? move.slice(0, -1)
      : move + "'";
/** Synchronous CPU search; run in a worker. No entropy or replacement sampling.
 * maxNodes bounds expanded coordinates, not edges (at most 36 per expansion).
 * Full search arrays are fixed-size and released after each call, not cached.
 */
export function groupFourByFourOppositeCenters(
  state,
  { pair = "UD", maxNodes } = {},
) {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1)
    throw new TypeError(
      "An explicit positive safe-integer maxNodes is required.",
    );
  const start = rankUnchecked(fourByFourCenterMask(state, pair));
  const goal = rankUnchecked(goalMask(pair));
  if (start === goal)
    return { algorithm: "", nodes: 0, discovered: 1, searchBytes: 0 };
  const count = FOUR_BY_FOUR_CENTER_COORDINATES;
  const makeSide = (root) => {
    const parent = new Int32Array(count).fill(-1);
    const move = new Uint8Array(count);
    const queue = new Uint32Array(count);
    parent[root] = root;
    queue[0] = root;
    return { parent, move, queue, from: 0, end: 1, tail: 1, root };
  };
  const sides = [makeSide(start), makeSide(goal)];
  const bits = transitions();
  let nodes = 0,
    discovered = 2;
  function finish(meeting) {
    const forward = [],
      backward = [];
    let i = meeting;
    while (i !== start) {
      forward.push(FOUR_BY_FOUR_MOVES[sides[0].move[i]]);
      i = sides[0].parent[i];
    }
    i = meeting;
    while (i !== goal) {
      backward.push(inverseMove(FOUR_BY_FOUR_MOVES[sides[1].move[i]]));
      i = sides[1].parent[i];
    }
    return {
      algorithm: [...forward.reverse(), ...backward].join(" "),
      nodes,
      discovered,
      searchBytes: count * 18,
    };
  }
  while (sides.every((side) => side.from < side.end)) {
    const sideIndex =
      sides[0].end - sides[0].from <= sides[1].end - sides[1].from ? 0 : 1;
    const side = sides[sideIndex],
      other = sides[1 - sideIndex];
    // Expand one whole frontier before choosing the smaller side again.
    while (side.from < side.end) {
      if (nodes === maxNodes)
        throw error(
          "CENTER_SEARCH_LIMIT",
          "Opposite-center search exhausted its node budget; retain the original target.",
        );
      nodes++;
      const current = side.queue[side.from++];
      const mask = unrankFourByFourCenters(current);
      for (let m = 0; m < bits.length; m++) {
        const next = rankUnchecked(moveMask(mask, bits[m]));
        if (side.parent[next] !== -1) continue;
        side.parent[next] = current;
        side.move[next] = m;
        side.queue[side.tail++] = next;
        discovered++;
        if (other.parent[next] !== -1) return finish(next);
      }
    }
    side.end = side.tail;
  }
  throw error(
    "CENTER_SEARCH_UNREACHABLE",
    "Opposite-center graph did not reach the target.",
  );
}
