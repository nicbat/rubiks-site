import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOUR_BY_FOUR_COORDINATES,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import {
  FOUR_BY_FOUR_PHASE3_MOVES as moves,
  FOUR_BY_FOUR_PHASE3_WING_ORBITS as orbits,
  FOUR_BY_FOUR_PHASE3_UD_MASKS as masks,
  FOUR_BY_FOUR_JOINT_MOVE_METADATA as metadata,
  analyzeFourByFourJointBoundary as analyze,
} from "../packages/cube-engine/scramble/four-by-four-joint-coordinates.js";
import { analyzeFourByFourReduction } from "../packages/cube-engine/scramble/four-by-four-reduction.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const swap = (array, a, b) => {
  [array[a], array[b]] = [array[b], array[a]];
};
const flags = [
  "groupedColors",
  "restrictedUD",
  "evenWingPermutation",
  "orbitIdentityBalance",
  "evenHandedness",
];
function onlyFailure(state, flag) {
  const result = analyze(state);
  for (const name of flags) assert.equal(result[name], name !== flag, name);
  assert.equal(result.eligible, false);
}
test("derived inventories have exact orbit sizes and frozen geometry metadata", () => {
  assert.equal(moves.length, 20);
  assert.equal(metadata.length, 36);
  assert.deepEqual(
    masks,
    [15, 51, 60, 85, 90, 102, 153, 165, 170, 195, 204, 240],
  );
  assert.deepEqual(orbits[0], [0, 3, 5, 6, 8, 11, 13, 14, 16, 19, 21, 22]);
  assert.deepEqual(
    orbits.flat().sort((a, b) => a - b),
    Array.from({ length: 24 }, (_, i) => i),
  );
  for (const object of [
    moves,
    masks,
    orbits,
    ...orbits,
    metadata,
    ...metadata,
    ...metadata.flatMap((m) => [
      m.centers,
      m.wings,
      m.corners,
      m.cornerOrientation,
    ]),
  ])
    assert.ok(Object.isFrozen(object));
  assert.throws(() => {
    metadata[0].wings[0] = 99;
  }, TypeError);
});
test("all generators and seeded subgroup chains satisfy boundary and independent 96-sticker oracle", () => {
  let seed = 0x42a967;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const algorithms = [
    "",
    ...moves,
    ...Array.from({ length: 24 }, () =>
      Array.from({ length: 35 }, () => moves[random() % moves.length]).join(
        " ",
      ),
    ),
  ];
  for (const algorithm of algorithms) {
    const state = applyFourByFourMoves(solvedFourByFourState(), algorithm);
    assert.equal(analyze(state).eligible, true, algorithm);
    assertNxNOracle(fourByFourStateToFacelets(state), algorithm, 4);
  }
});
test("move metadata composes exact arbitrary-state coordinates including corner twist", () => {
  const state = applyFourByFourMoves(
    solvedFourByFourState(),
    "Rw U Fw' D2 L B Uw",
  );
  for (const m of metadata) {
    const expected = applyFourByFourMoves(state, m.move);
    assert.deepEqual(
      {
        centerColors: m.centers.map((s) => state.centerColors[s]),
        wingPermutation: m.wings.map((s) => state.wingPermutation[s]),
        cornerPermutation: m.corners.map((s) => state.cornerPermutation[s]),
        cornerOrientation: m.corners.map(
          (s, d) => (state.cornerOrientation[s] + m.cornerOrientation[d]) % 3,
        ),
      },
      expected,
      m.move,
    );
  }
});
test("global wing parity, handedness and identity balance are independent obstructions", () => {
  const odd = solvedFourByFourState();
  swap(odd.wingPermutation, 0, 5);
  onlyFailure(odd, "evenWingPermutation");
  const handed = solvedFourByFourState();
  swap(handed.wingPermutation, 3, 15);
  swap(handed.wingPermutation, 0, 5);
  onlyFailure(handed, "evenHandedness");
  const unbalanced = solvedFourByFourState();
  swap(unbalanced.wingPermutation, 0, 1);
  swap(unbalanced.wingPermutation, 5, 2);
  onlyFailure(unbalanced, "orbitIdentityBalance");
  for (const state of [odd, handed, unbalanced])
    for (const move of moves) {
      const next = analyze(applyFourByFourMoves(state, move)),
        original = analyze(state);
      for (const name of flags)
        assert.equal(next[name], original[name], `${name}/${move}`);
    }
});
test("UD restriction distinguishes grouped centers that cannot enter restricted subgroup", () => {
  const state = solvedFourByFourState();
  const ud = FOUR_BY_FOUR_COORDINATES.centers.flatMap((s, i) =>
    ["U", "D"].includes(s.faces[0]) ? [i] : [],
  );
  ud.forEach(
    (slot, bit) => (state.centerColors[slot] = (23 >> bit) & 1 ? 0 : 3),
  );
  onlyFailure(state, "restrictedUD");
  const broken = applyFourByFourMoves(solvedFourByFourState(), "Rw");
  assert.equal(analyze(broken).groupedColors, false);
  for (const move of moves)
    assert.equal(
      analyze(applyFourByFourMoves(state, move)).restrictedUD,
      false,
    );
});
test("boundary permits reduced PLL parity for later resolution, without claiming solved or full subgroup membership", () => {
  const state = solvedFourByFourState();
  [state.cornerPermutation[0], state.cornerPermutation[1]] = [1, 0];
  assert.equal(analyze(state).eligible, true);
  assert.equal(
    analyzeFourByFourReduction(state).permutationParityMismatch,
    true,
  );
});
test("validation rejects malformed coordinates and analysis cannot mutate caller state or shared results", () => {
  const state = solvedFourByFourState(),
    before = structuredClone(state);
  for (const value of Object.values(state)) Object.freeze(value);
  Object.freeze(state);
  const result = analyze(state);
  result.eligible = false;
  assert.equal(analyze(state).eligible, true);
  assert.deepEqual(state, before);
  assert.throws(
    () => analyze({ ...before, wingPermutation: Array(24).fill(0) }),
    TypeError,
  );
  assert.throws(() => analyze(null), TypeError);
});

test("legal reduced endpoints remain eligible under restricted search excursions", () => {
  // These start at nontrivial legal 3x3 endpoints, not only the solved full cube.
  // Reversing the excursion is a constructive reduction witness for each case.
  const outer = metadata
    .filter(({ move }) => !move.includes("w"))
    .map(({ move }) => move);
  let seed = 0x744422;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  for (let sample = 0; sample < 20; sample++) {
    const prefix = Array.from(
      { length: 25 },
      () => outer[random() % outer.length],
    ).join(" ");
    const endpoint = applyFourByFourMoves(solvedFourByFourState(), prefix);
    const reduced = analyzeFourByFourReduction(endpoint);
    assert.equal(reduced.edgeFlipParity, false);
    assert.equal(reduced.permutationParityMismatch, false);
    assert.equal(analyze(endpoint).eligible, true);
    const excursion = Array.from(
      { length: 25 },
      () => moves[random() % moves.length],
    ).join(" ");
    const state = applyFourByFourMoves(endpoint, excursion);
    assert.equal(analyze(state).eligible, true);
    assertNxNOracle(
      fourByFourStateToFacelets(state),
      prefix + " " + excursion,
      4,
    );
  }
});
