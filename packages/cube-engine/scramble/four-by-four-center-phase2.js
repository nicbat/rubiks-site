// Original second center stage: preserve the grouped UD colors, place RL colors
// on the RL faces. Colors within each opposite pair remain unsorted.
import {
  FOUR_BY_FOUR_COORDINATES,
  FOUR_BY_FOUR_MOVES,
  fourByFourCenterMovePermutation,
  validateFourByFourState,
  applyFourByFourMoves,
  solvedFourByFourState,
} from "./four-by-four-state.js";
import { checkAbort } from "./random-source.js";
const slots = FOUR_BY_FOUR_COORDINATES.centers;
const outside = slots.flatMap((slot, i) =>
  ["U", "D"].includes(slot.faces[0]) ? [] : [i],
);
const ud = slots.flatMap((slot, i) =>
  ["U", "D"].includes(slot.faces[0]) ? [i] : [],
);
const udSet = new Set(ud);
const moves = FOUR_BY_FOUR_MOVES.filter((move) => {
  const p = fourByFourCenterMovePermutation(move);
  return p.every(
    (source, destination) => udSet.has(source) === udSet.has(destination),
  );
});
export const FOUR_BY_FOUR_CENTER_PHASE2_MOVES = Object.freeze(moves);
const count = 25740;
const parity = (values) => {
  let result = 0;
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      if (values[i] > values[j]) result ^= 1;
  return result;
};
const moveParity = moves.map((move) =>
  parity(applyFourByFourMoves(solvedFourByFourState(), move).wingPermutation),
);
const choose = Array.from({ length: 17 }, () => new Uint16Array(9));
for (let n = 0; n <= 16; n++) {
  choose[n][0] = 1;
  for (let k = 1; k <= Math.min(n, 8); k++)
    choose[n][k] = n === k ? 1 : choose[n - 1][k - 1] + choose[n - 1][k];
}
function rank(mask) {
  let result = 0,
    k = 0;
  for (let i = 0; i < 16; i++) if (mask & (1 << i)) result += choose[i][++k];
  return result;
}
function unrank(index) {
  let p = 15,
    mask = 0;
  for (let k = 8; k > 0; k--) {
    while (choose[p][k] > index) p--;
    mask |= 1 << p;
    index -= choose[p--][k];
  }
  return mask;
}
const goal = rank(
  outside.reduce(
    (mask, slot, i) =>
      mask | (["R", "L"].includes(slots[slot].faces[0]) ? 1 << i : 0),
    0,
  ),
);
const inverse = (m) =>
  m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'";
let table;
function initialize(signal) {
  if (table) return table;
  const transforms = moves.map((move) => {
    const permutation = fourByFourCenterMovePermutation(move);
    return outside.map((destination) =>
      outside.indexOf(permutation[destination]),
    );
  });
  const nextMove = new Uint8Array(count).fill(255),
    parent = new Uint16Array(count),
    queue = new Uint16Array(count),
    depth = new Uint8Array(count);
  let tail = 1,
    maxDepth = 0;
  queue[0] = goal * 2;
  nextMove[goal * 2] = 254;
  parent[goal * 2] = goal * 2;
  for (let head = 0; head < tail; head++) {
    checkAbort(signal);
    const current = queue[head],
      mask = unrank(current >>> 1);
    for (let m = 0; m < moves.length; m++) {
      let changed = 0;
      for (let i = 0; i < 16; i++)
        if (mask & (1 << transforms[m][i])) changed |= 1 << i;
      const next = rank(changed) * 2 + ((current & 1) ^ moveParity[m]);
      if (nextMove[next] !== 255) continue;
      nextMove[next] = moves.indexOf(inverse(moves[m]));
      parent[next] = current;
      depth[next] = depth[current] + 1;
      maxDepth = Math.max(maxDepth, depth[next]);
      queue[tail++] = next;
    }
  }
  table = { nextMove, parent, maxDepth, reached: tail };
  return table;
}
export function groupFourByFourSecondCenters(
  state,
  { signal, requireEvenWings = true } = {},
) {
  checkAbort(signal);
  if (typeof requireEvenWings !== "boolean")
    throw new TypeError("requireEvenWings must be boolean");
  const valid = validateFourByFourState(state);
  if (
    valid.centerColors.some(
      (color, i) => udSet.has(i) !== (color === 0 || color === 3),
    )
  )
    throw new TypeError("Group UD centers before phase2");
  let mask = 0;
  outside.forEach((slot, i) => {
    if ([1, 4].includes(valid.centerColors[slot])) mask |= 1 << i;
  });
  let coordinate =
    rank(mask) * 2 + (requireEvenWings ? parity(valid.wingPermutation) : 0);
  if (coordinate === goal * 2) return { algorithm: "", moveCount: 0 };
  const t = initialize(signal);
  if (t.nextMove[coordinate] === 255)
    throw Object.assign(Error("Center phase2 coordinate unreachable"), {
      code: "CENTER_PHASE2_UNREACHABLE",
    });
  const result = [];
  while (coordinate !== goal * 2) {
    checkAbort(signal);
    result.push(moves[t.nextMove[coordinate]]);
    coordinate = t.parent[coordinate];
  }
  return { algorithm: result.join(" "), moveCount: result.length };
}
export function fourByFourCenterPhase2Diagnostics({ signal } = {}) {
  const t = initialize(signal);
  return {
    coordinates: count,
    reached: t.reached,
    moves: moves.length,
    maxDepth: t.maxDepth,
    retainedBytes: t.nextMove.byteLength + t.parent.byteLength,
    initializationScratchBytes: count * 3,
  };
}
