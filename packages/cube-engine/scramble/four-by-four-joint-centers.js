import {
  FOUR_BY_FOUR_COORDINATES,
  validateFourByFourState,
} from "./four-by-four-state.js";
import {
  FOUR_BY_FOUR_PHASE3_MOVES as moves,
  FOUR_BY_FOUR_PHASE3_WING_ORBITS as orbits,
  FOUR_BY_FOUR_PHASE3_UD_MASKS as udMasks,
  FOUR_BY_FOUR_JOINT_MOVE_METADATA as metadata,
  analyzeFourByFourJointBoundary,
} from "./four-by-four-joint-coordinates.js";
import { checkAbort } from "./random-source.js";
const { centers, faces, wings } = FOUR_BY_FOUR_COORDINATES;
const pairs = [
  [0, 3],
  [1, 4],
  [2, 5],
];
const slots = pairs.map((pair) =>
  centers.flatMap((slot, i) =>
    pair.includes(faces.indexOf(slot.faces[0])) ? [i] : [],
  ),
);
const masks = Array.from({ length: 256 }, (_, i) => i).filter((mask) => {
  let count = 0;
  for (let bits = mask; bits; bits &= bits - 1) count++;
  return count === 4;
});
const sets = [udMasks, masks, masks];
const ranks = sets.map((values) => {
  const r = new Int16Array(256).fill(-1);
  values.forEach((mask, i) => (r[mask] = i));
  return r;
});
const parity = (p) => {
  let n = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) n ^= 1;
  return n;
};
const edgeIdentity = (slot) => [...wings[slot].faces].sort().join("");
const edgeIds = new Map(orbits[0].map((slot, i) => [edgeIdentity(slot), i]));
const generators = moves.map((move) => metadata.find((m) => m.move === move));
const parityDelta = generators.map(
  (m) =>
    parity(m.corners) ^
    parity(orbits[0].map((slot) => orbits[0].indexOf(m.wings[slot]))),
);
const encode = (a, b, c, p) => ((a * 70 + b) * 70 + c) * 2 + p;
const goalParts = slots.map(
  (indices, pair) =>
    ranks[pair][
      indices.reduce(
        (mask, slot, bit) =>
          mask |
          ((faces.indexOf(centers[slot].faces[0]) === pairs[pair][0] ? 1 : 0) <<
            bit),
        0,
      )
    ],
);
const goal = encode(...goalParts, 0),
  count = 117600;
let cached;
export function fourByFourJointCenterContext(signal) {
  checkAbort(signal);
  if (cached) return cached;
  const transitions = slots.map((indices, pair) =>
    generators.map((g) => {
      const local = indices.map((slot) => indices.indexOf(g.centers[slot]));
      if (local.includes(-1)) throw Error("Joint center move leaves pair.");
      return Uint8Array.from(sets[pair], (mask) => {
        const next = local.reduce(
          (value, source, destination) =>
            value | (((mask >> source) & 1) << destination),
          0,
        );
        if (ranks[pair][next] < 0)
          throw Error("Joint center move leaves restricted orbit.");
        return ranks[pair][next];
      });
    }),
  );
  const move = (index, m) => {
    const base = index >>> 1;
    return encode(
      transitions[0][m][Math.floor(base / 4900)],
      transitions[1][m][Math.floor(base / 70) % 70],
      transitions[2][m][base % 70],
      (index & 1) ^ parityDelta[m],
    );
  };
  const distance = new Uint8Array(count).fill(255),
    queue = new Uint32Array(count);
  queue[0] = goal;
  distance[goal] = 0;
  let tail = 1,
    maximumDepth = 0;
  for (let head = 0; head < tail; head++) {
    if ((head & 1023) === 0) checkAbort(signal);
    const current = queue[head];
    for (let m = 0; m < moves.length; m++) {
      const next = move(current, m);
      if (distance[next] !== 255) continue;
      distance[next] = distance[current] + 1;
      maximumDepth = Math.max(maximumDepth, distance[next]);
      queue[tail++] = next;
    }
  }
  if (tail !== count)
    throw Error(`Joint center parity graph incomplete: ${tail}`);
  function coordinate(value) {
    const state = validateFourByFourState(value);
    if (!analyzeFourByFourJointBoundary(state).eligible)
      throw new TypeError("A valid joint phase-three boundary is required.");
    const parts = slots.map(
      (indices, pair) =>
        ranks[pair][
          indices.reduce(
            (mask, slot, bit) =>
              mask |
              ((state.centerColors[slot] === pairs[pair][0] ? 1 : 0) << bit),
            0,
          )
        ],
    );
    const relativeParity =
      parity(state.cornerPermutation) ^
      parity(
        orbits[0].map((slot) =>
          edgeIds.get(edgeIdentity(state.wingPermutation[slot])),
        ),
      );
    return encode(...parts, relativeParity);
  }
  cached = Object.freeze({
    coordinate,
    move,
    distance: (index) => distance[index],
    goal,
    diagnostics: Object.freeze({
      coordinates: count,
      reached: tail,
      maximumDepth,
      retainedTableBytes: count + 20 * (12 + 70 + 70) + 3 * 256 * 2,
      queueBytes: count * 4,
    }),
  });
  return cached;
}
