import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOUR_BY_FOUR_CENTER_COORDINATES,
  rankFourByFourCenters,
  unrankFourByFourCenters,
  fourByFourCenterMask,
  moveFourByFourCenterCoordinate,
  groupFourByFourOppositeCenters,
} from "../packages/cube-engine/scramble/four-by-four-centers.js";
import {
  FOUR_BY_FOUR_MOVES,
  FOUR_BY_FOUR_COORDINATES,
  solvedFourByFourState,
  sampleFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
function seeded(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}
const pairFaces = { UD: ["U", "D"], RL: ["R", "L"], FB: ["F", "B"] };
function assertGrouped(state, pair) {
  const faces = pairFaces[pair];
  FOUR_BY_FOUR_COORDINATES.centers.forEach((slot, i) => {
    assert.equal(
      faces.includes(FOUR_BY_FOUR_COORDINATES.faces[state.centerColors[i]]),
      faces.includes(slot.faces[0]),
    );
  });
}
test("all 735471 opposite-center coordinates are bijective with exact boundary masks", () => {
  assert.equal(FOUR_BY_FOUR_CENTER_COORDINATES, 735471);
  assert.equal(unrankFourByFourCenters(0), 255);
  assert.equal(unrankFourByFourCenters(1), 383);
  assert.equal(unrankFourByFourCenters(735470), 0xff0000);
  for (let i = 0; i < FOUR_BY_FOUR_CENTER_COORDINATES; i++) {
    assert.equal(rankFourByFourCenters(unrankFourByFourCenters(i)), i);
  }
  for (const bad of [-1, 2 ** 24, 0, 127, 511, NaN, 1.5])
    assert.throws(() => rankFourByFourCenters(bad));
  for (const bad of [-1, 735471, NaN, 1.5])
    assert.throws(() => unrankFourByFourCenters(bad));
});
test("all 36 coordinate transitions match full state and independent 96-sticker moves", () => {
  const setup = "Rw U Fw2 R B' Uw F2 Lw' D";
  const state = applyFourByFourMoves(solvedFourByFourState(), setup);
  for (const move of FOUR_BY_FOUR_MOVES) {
    const next = applyFourByFourMoves(state, move);
    for (const pair of Object.keys(pairFaces)) {
      assert.equal(
        moveFourByFourCenterCoordinate(
          rankFourByFourCenters(fourByFourCenterMask(state, pair)),
          move,
        ),
        rankFourByFourCenters(fourByFourCenterMask(next, pair)),
      );
    }
    assertNxNOracle(fourByFourStateToFacelets(next), `${setup} ${move}`, 4);
  }
  assert.throws(() => moveFourByFourCenterCoordinate(0, "x"));
  assert.throws(() => fourByFourCenterMask(state, "UF"));
  for (const pair of [["UD"], { toString: () => "UD" }, null])
    assert.throws(() => fourByFourCenterMask(state, pair), TypeError);
});
test("bounded first-stage search groups each opposite pair without changing the supplied state", () => {
  const random = seeded(0x444ce17);
  for (let sample = 0; sample < 9; sample++) {
    const setup = Array.from(
      { length: 24 },
      () => FOUR_BY_FOUR_MOVES[random() % FOUR_BY_FOUR_MOVES.length],
    ).join(" ");
    const state = applyFourByFourMoves(solvedFourByFourState(), setup);
    const original = structuredClone(state);
    const pair = Object.keys(pairFaces)[sample % 3];
    const result = groupFourByFourOppositeCenters(state, {
      pair,
      maxNodes: 200000,
    });
    assert.ok(result.nodes <= 200000);
    assert.equal(result.searchBytes, 13238478);
    const grouped = applyFourByFourMoves(state, result.algorithm);
    assertGrouped(grouped, pair);
    assertNxNOracle(
      fourByFourStateToFacelets(grouped),
      `${setup} ${result.algorithm}`,
      4,
    );
    assert.deepEqual(state, original);
  }
});
test("uniform sampled center states can be grouped and failed budgets retain exact targets", () => {
  const randomUint32 = seeded(0x444cab);
  for (let i = 0; i < 6; i++) {
    const state = sampleFourByFourState({ randomUint32 });
    const original = structuredClone(state);
    assert.throws(
      () => groupFourByFourOppositeCenters(state, { maxNodes: 1 }),
      { code: "CENTER_SEARCH_LIMIT" },
    );
    assert.deepEqual(state, original);
    const result = groupFourByFourOppositeCenters(state, { maxNodes: 200000 });
    assertGrouped(applyFourByFourMoves(state, result.algorithm), "UD");
    assert.deepEqual(state, original);
  }
  const solved = solvedFourByFourState();
  assert.deepEqual(groupFourByFourOppositeCenters(solved, { maxNodes: 1 }), {
    algorithm: "",
    nodes: 0,
    discovered: 1,
    searchBytes: 0,
  });
  for (const maxNodes of [
    undefined,
    0,
    -1,
    1.5,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() => groupFourByFourOppositeCenters(solved, { maxNodes }));
});
