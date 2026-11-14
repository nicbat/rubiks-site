// Original geometry-derived coordinates for the joint reduction boundary.
import {
  FOUR_BY_FOUR_COORDINATES,
  FOUR_BY_FOUR_MOVES,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourCenterMovePermutation,
  validateFourByFourState,
} from "./four-by-four-state.js";
const freeze = (values) => Object.freeze(Array.from(values));
/** Destination-to-source permutations; cornerOrientation is the additive twist. */
export const FOUR_BY_FOUR_JOINT_MOVE_METADATA = Object.freeze(
  FOUR_BY_FOUR_MOVES.map((move) => {
    const state = applyFourByFourMoves(solvedFourByFourState(), move);
    return Object.freeze({
      move,
      centers: freeze(fourByFourCenterMovePermutation(move)),
      wings: freeze(state.wingPermutation),
      corners: freeze(state.cornerPermutation),
      cornerOrientation: freeze(state.cornerOrientation),
    });
  }),
);
export const FOUR_BY_FOUR_PHASE3_MOVES = freeze(
  FOUR_BY_FOUR_MOVES.filter((move) =>
    move.includes("w")
      ? move.endsWith("2")
      : !["U", "D"].includes(move[0]) || move.endsWith("2"),
  ),
);
const generators = FOUR_BY_FOUR_JOINT_MOVE_METADATA.filter((m) =>
  FOUR_BY_FOUR_PHASE3_MOVES.includes(m.move),
);
const unseen = new Set(Array.from({ length: 24 }, (_, i) => i)),
  orbits = [];
while (unseen.size) {
  const queue = [unseen.values().next().value],
    visited = new Set(queue);
  for (let head = 0; head < queue.length; head++)
    for (const generator of generators) {
      const next = generator.wings[queue[head]];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  for (const slot of queue) unseen.delete(slot);
  orbits.push(freeze(queue.sort((a, b) => a - b)));
}
if (orbits.length !== 2 || orbits.some((orbit) => orbit.length !== 12))
  throw Error("Joint wing orbit invariant failed.");
export const FOUR_BY_FOUR_PHASE3_WING_ORBITS = Object.freeze(orbits);
const { centers, faces, wings } = FOUR_BY_FOUR_COORDINATES;
const udSlots = centers.flatMap((slot, i) =>
  ["U", "D"].includes(slot.faces[0]) ? [i] : [],
);
const solvedMask = udSlots.reduce(
  (mask, slot, bit) => mask | (centers[slot].faces[0] === "U" ? 1 << bit : 0),
  0,
);
const maskQueue = [solvedMask],
  maskSet = new Set(maskQueue);
const centerGenerators = generators.map((g) =>
  udSlots.map((slot) => udSlots.indexOf(g.centers[slot])),
);
if (centerGenerators.some((p) => p.includes(-1)))
  throw Error("Joint center subgroup invariant failed.");
for (let head = 0; head < maskQueue.length; head++)
  for (const permutation of centerGenerators) {
    const mask = permutation.reduce(
      (next, source, destination) =>
        next | (((maskQueue[head] >> source) & 1) << destination),
      0,
    );
    if (!maskSet.has(mask)) {
      maskSet.add(mask);
      maskQueue.push(mask);
    }
  }
if (maskQueue.length !== 12)
  throw Error("Joint UD mask orbit invariant failed.");
/** Bit order is centers filtered to U/D faces, retaining coordinate order. */
export const FOUR_BY_FOUR_PHASE3_UD_MASKS = freeze(
  maskQueue.sort((a, b) => a - b),
);
const orbitA = new Set(orbits[0]);
const identities = wings.map((wing) => [...wing.faces].sort().join(""));
const pairs = [0, 1, 2, 0, 1, 2];
/** Analyze reduction admissibility, not membership of the complete fixed-frame
 * cube in the move subgroup. Corners are unconstrained at this boundary; phase3
 * must additionally resolve reduced permutation parity before the 3x3 finish.
 * All flags are independent diagnostics, including for states outside phase1. */
export function analyzeFourByFourJointBoundary(state) {
  const valid = validateFourByFourState(state);
  const groupedColors = valid.centerColors.every(
    (color, slot) =>
      pairs[color] === pairs[faces.indexOf(centers[slot].faces[0])],
  );
  const udGrouped = udSlots.every((slot) =>
    [0, 3].includes(valid.centerColors[slot]),
  );
  const udMask = udSlots.reduce(
    (mask, slot, bit) => mask | (valid.centerColors[slot] === 0 ? 1 << bit : 0),
    0,
  );
  const restrictedUD = udGrouped && maskSet.has(udMask);
  let inversions = 0;
  for (let i = 0; i < 24; i++)
    for (let j = i + 1; j < 24; j++)
      inversions += valid.wingPermutation[i] > valid.wingPermutation[j] ? 1 : 0;
  const evenWingPermutation = inversions % 2 === 0;
  const orbitIdentityBalance = orbits.every(
    (orbit) =>
      new Set(orbit.map((slot) => identities[valid.wingPermutation[slot]]))
        .size === 12,
  );
  const evenHandedness =
    orbits[0].filter((slot) => !orbitA.has(valid.wingPermutation[slot]))
      .length %
      2 ===
    0;
  return {
    groupedColors,
    restrictedUD,
    evenWingPermutation,
    orbitIdentityBalance,
    evenHandedness,
    eligible:
      groupedColors &&
      restrictedUD &&
      evenWingPermutation &&
      orbitIdentityBalance &&
      evenHandedness,
    udMask,
  };
}
