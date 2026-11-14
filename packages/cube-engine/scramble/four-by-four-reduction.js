// Internal reduction boundary only: no wing pairing or parity repair. Fixed
// centers must already match the engine's U/R/F/D/L/B reference frame.
import {
  FOUR_BY_FOUR_COORDINATES,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { THREE_BY_THREE_COORDINATES } from "./three-by-three.js";

const { faces, centers, wings, corners } = FOUR_BY_FOUR_COORDINATES;
const edges = THREE_BY_THREE_COORDINATES.edges;
const identity = (labels) => [...labels].sort().join("");
const edgeSlots = edges.map((edge) =>
  wings.flatMap((slot, index) =>
    identity(slot.faces) === identity(edge) ? [index] : [],
  ),
);
// Fail loudly if either shared coordinate model changes incompatibly.
if (
  edgeSlots.some((slots) => slots.length !== 2) ||
  corners.some(
    (slot, i) => slot.faces.join("") !== THREE_BY_THREE_COORDINATES.corners[i],
  )
)
  throw Error("Incompatible reduction coordinates");
const edgeIds = new Map(edges.map((edge, i) => [identity(edge), i]));
const error = (code, message, details) =>
  Object.assign(new Error(message), { code, ...details });
function parity(permutation) {
  let value = 0;
  for (let i = 0; i < permutation.length; i++)
    for (let j = i + 1; j < permutation.length; j++)
      if (permutation[i] > permutation[j]) value ^= 1;
  return value;
}

/** Diagnose both independent reduced parities without repairing or normalizing.
 * Structural failures throw CENTERS_UNSOLVED or WINGS_UNPAIRED with slot indices.
 * A parity-bearing target is diagnostic only, not a legal 3x3 solver input. */
export function analyzeFourByFourReduction(value) {
  const state = validateFourByFourState(value);
  const slots = centers.flatMap((slot, i) =>
    faces[state.centerColors[i]] !== slot.faces[0] ? [i] : [],
  );
  if (slots.length)
    throw error(
      "CENTERS_UNSOLVED",
      "Solve centers in the fixed reference frame before reduction.",
      { slots },
    );
  const edgePermutation = [],
    edgeOrientation = [],
    unpaired = [];
  edges.forEach((edge, i) => {
    // Slot orientation matters: equal unordered colors alone would accept a
    // crossed pair whose two stickers on the same face do not match.
    const colors = edgeSlots[i].map((index) =>
      [...edge]
        .map((face) => {
          const side = wings[index].faces.indexOf(face);
          return wings[state.wingPermutation[index]].faces[side];
        })
        .join(""),
    );
    if (colors[0] !== colors[1]) {
      unpaired.push(i);
      return;
    }
    const source = edgeIds.get(identity(colors[0]));
    if (source === undefined) throw Error("Invalid reduced edge colors");
    edgePermutation[i] = source;
    edgeOrientation[i] = edges[source].indexOf(colors[0][0]);
  });
  if (unpaired.length)
    throw error(
      "WINGS_UNPAIRED",
      "Pair both ordered wing colors before reduction.",
      { edgeSlots: unpaired },
    );
  if (new Set(edgePermutation).size !== 12)
    throw Error("Invalid reduced edge permutation");
  const target = {
    cornerPermutation: state.cornerPermutation,
    cornerOrientation: state.cornerOrientation,
    edgePermutation,
    edgeOrientation,
  };
  return {
    target,
    edgeFlipParity:
      edgeOrientation.reduce((sum, orientation) => sum ^ orientation, 0) === 1,
    permutationParityMismatch:
      parity(edgePermutation) !== parity(state.cornerPermutation),
  };
}

/** Strict exact-target conversion. Only a legal 3x3 target is returned. */
export function reduceFourByFourToThree(state) {
  const result = analyzeFourByFourReduction(state);
  const { edgeFlipParity, permutationParityMismatch } = result;
  if (edgeFlipParity || permutationParityMismatch)
    throw error(
      edgeFlipParity && permutationParityMismatch
        ? "BOTH_PARITIES"
        : edgeFlipParity
          ? "EDGE_FLIP_PARITY"
          : "PERMUTATION_PARITY",
      "Reduced parity must be repaired before invoking the 3x3 solver.",
      { edgeFlipParity, permutationParityMismatch },
    );
  return result.target;
}
