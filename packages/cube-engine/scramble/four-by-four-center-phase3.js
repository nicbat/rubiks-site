// Original complete product coordinate for three grouped opposite center pairs.
import {
  FOUR_BY_FOUR_COORDINATES,
  FOUR_BY_FOUR_MOVES,
  fourByFourCenterMovePermutation,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { checkAbort } from "./random-source.js";
const pairs = [
  [0, 3],
  [1, 4],
  [2, 5],
];
const { faces, centers } = FOUR_BY_FOUR_COORDINATES;
const slots = pairs.map((pair) =>
  centers.flatMap((slot, i) =>
    pair.includes(faces.indexOf(slot.faces[0])) ? [i] : [],
  ),
);
const masks = Array.from({ length: 256 }, (_, mask) => mask).filter((mask) => {
  let count = 0;
  for (let bits = mask; bits; bits &= bits - 1) count++;
  return count === 4;
});
const ranks = new Int16Array(256).fill(-1);
masks.forEach((mask, i) => (ranks[mask] = i));
const moves = FOUR_BY_FOUR_MOVES.filter(
  (move) => !move.includes("w") || move.endsWith("2"),
);
const size = 70 ** 3;
const encode = ([a, b, c]) => a * 4900 + b * 70 + c;
const decode = (index) => [
  Math.floor(index / 4900),
  Math.floor(index / 70) % 70,
  index % 70,
];
const goal = encode(
  slots.map(
    (indices, pair) =>
      ranks[
        indices.reduce(
          (mask, slot, bit) =>
            mask |
            ((faces.indexOf(centers[slot].faces[0]) === pairs[pair][0]
              ? 1
              : 0) <<
              bit),
          0,
        )
      ],
  ),
);
let table;
function initialize(signal) {
  if (table) return table;
  const transitions = slots.map((indices) =>
    moves.map((move) => {
      const permutation = fourByFourCenterMovePermutation(move);
      const localSources = indices.map((destination) =>
        indices.indexOf(permutation[destination]),
      );
      if (localSources.includes(-1))
        throw Error("Phase-three move leaves its center pair.");
      return Uint8Array.from(
        masks,
        (mask) =>
          ranks[
            localSources.reduce(
              (next, source, destination) =>
                next | (((mask >> source) & 1) << destination),
              0,
            )
          ],
      );
    }),
  );
  const distance = new Uint8Array(size).fill(255),
    queue = new Uint32Array(size);
  distance[goal] = 0;
  queue[0] = goal;
  let tail = 1,
    maximumDepth = 0;
  const nextIndex = (index, move) => {
    const [a, b, c] = decode(index);
    return (
      transitions[0][move][a] * 4900 +
      transitions[1][move][b] * 70 +
      transitions[2][move][c]
    );
  };
  for (let head = 0; head < tail; head++) {
    if ((head & 1023) === 0) checkAbort(signal);
    const current = queue[head];
    for (let move = 0; move < moves.length; move++) {
      const next = nextIndex(current, move);
      if (distance[next] !== 255) continue;
      distance[next] = distance[current] + 1;
      maximumDepth = Math.max(maximumDepth, distance[next]);
      queue[tail++] = next;
    }
  }
  if (tail !== size) throw Error("Incomplete phase-three center graph.");
  checkAbort(signal);
  table = { distance, nextIndex, maximumDepth, count: tail };
  return table;
}
function coordinate(state) {
  const validated = validateFourByFourState(state);
  return encode(
    slots.map((indices, pair) => {
      let mask = 0;
      indices.forEach((slot, bit) => {
        const color = validated.centerColors[slot];
        if (!pairs[pair].includes(color))
          throw new TypeError(
            "Group all opposite center pairs before phase three.",
          );
        if (color === pairs[pair][0]) mask |= 1 << bit;
      });
      return ranks[mask];
    }),
  );
}
/** Exact shortest path within the pair-preserving move set; at most 11 moves.
 * This solves centers only and can change corners and wings. */
export function finishFourByFourCenters(state, { signal } = {}) {
  checkAbort(signal);
  let current = coordinate(state);
  if (current === goal) return { algorithm: "", moveCount: 0 };
  const t = initialize(signal),
    solution = [];
  while (current !== goal) {
    checkAbort(signal);
    let found = false;
    for (let move = 0; move < moves.length; move++) {
      const next = t.nextIndex(current, move);
      if (t.distance[next] !== t.distance[current] - 1) continue;
      solution.push(moves[move]);
      current = next;
      found = true;
      break;
    }
    if (!found) throw Error("Phase-three center distance invariant failed.");
  }
  return { algorithm: solution.join(" "), moveCount: solution.length };
}
export function fourByFourCenterPhase3Diagnostics() {
  const t = initialize();
  return {
    coordinates: t.count,
    maximumDepth: t.maximumDepth,
    retainedBytes: size + 3 * 24 * 70,
    queueBytes: size * 4,
  };
}
