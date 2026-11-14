import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFourByFourJointWingSearch,
  relativeFourByFourWings,
  moveFourByFourRelativeWings,
  fourByFourWingPairingHeuristic,
  fourByFourJointWingDiagnostics,
} from "../packages/cube-engine/scramble/four-by-four-joint-wings.js";
import {
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const identity = () => Uint8Array.from({ length: 12 }, (_, i) => i);
const swap = (a, i, j) => {
  [a[i], a[j]] = [a[j], a[i]];
};
const seeded = (initial) => {
  let x = initial;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
};

test("aborted initialization publishes nothing and a subsequent complete bounded database is usable", () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () => createFourByFourJointWingSearch({ signal: controller.signal }),
    { name: "AbortError" },
  );
  const info = fourByFourJointWingDiagnostics();
  assert.deepEqual(info, {
    partialCoordinates: 1320,
    coordinates: 1742400,
    goalCoordinates: 1320,
    maximumDistance: 7,
    retainedBytes: 1743120,
    queueBytes: 6969600,
    transitionBytes: 105600,
  });
  info.coordinates = 0;
  assert.equal(fourByFourJointWingDiagnostics().coordinates, 1742400);
  assert.equal(fourByFourWingPairingHeuristic(identity()), 0);
  assert.throws(
    () => fourByFourJointWingDiagnostics({ signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("relative transition matches exact physical state on all generators and seeded walks with independent 96-sticker oracle", () => {
  const ctx = createFourByFourJointWingSearch(),
    random = seeded(0x444aabb);
  for (let trial = 0; trial < 24; trial++) {
    let state = solvedFourByFourState(),
      relative = ctx.coordinate(state);
    const path = [];
    for (let step = 0; step < 30; step++) {
      for (let m = 0; m < ctx.moves.length; m++) {
        const next = applyFourByFourMoves(state, ctx.moves[m]);
        assert.deepEqual(
          moveFourByFourRelativeWings(relative, m),
          ctx.coordinate(next),
        );
      }
      const m = random() % ctx.moves.length;
      path.push(ctx.moves[m]);
      relative = ctx.moveInto(relative, m, new Uint8Array(12));
      state = applyFourByFourMoves(state, ctx.moves[m]);
    }
    assertNxNOracle(fourByFourStateToFacelets(state), path.join(" "), 4);
    assert.deepEqual(relative, ctx.coordinate(state));
  }
});

test("pattern bound is admissible across exact shallow relative BFS and is zero only at paired goals", () => {
  const ctx = createFourByFourJointWingSearch(),
    start = identity(),
    seen = new Set([start.join(",")]);
  let frontier = [start];
  for (let depth = 0; depth <= 4; depth++) {
    const next = [];
    for (const r of frontier) {
      const h = ctx.heuristic(r);
      assert.ok(h <= depth, `${h} exceeds exact depth ${depth}`);
      assert.equal(
        h === 0,
        r.every((v, i) => v === i),
      );
      if (depth === 4) continue;
      for (let m = 0; m < ctx.moves.length; m++) {
        const moved = ctx.moveInto(r, m, new Uint8Array(12)),
          key = moved.join(",");
        if (!seen.has(key)) {
          seen.add(key);
          next.push(moved);
        }
      }
    }
    frontier = next;
  }
  assert.ok(seen.size > 1000);
});

test("bounds also apply to paths starting at nonidentity legal paired cube states", () => {
  const ctx = createFourByFourJointWingSearch(),
    random = seeded(444);
  for (let trial = 0; trial < 100; trial++) {
    let state = applyFourByFourMoves(solvedFourByFourState(), "U R F' D B2 L");
    assert.equal(ctx.heuristic(ctx.coordinate(state)), 0);
    for (let depth = 1; depth <= 12; depth++) {
      state = applyFourByFourMoves(state, ctx.moves[random() % 20]);
      assert.ok(ctx.heuristic(ctx.coordinate(state)) <= depth);
    }
  }
});

test("strict public boundaries reject malformed or ineligible wings without imposing center or PLL goals", () => {
  for (const value of [
    null,
    [],
    Array(12).fill(0),
    [...identity().slice(0, 11), 12],
    Float64Array.from(identity()),
  ])
    assert.throws(() => fourByFourWingPairingHeuristic(value), TypeError);
  const odd = identity();
  swap(odd, 0, 1);
  assert.throws(() => fourByFourWingPairingHeuristic(odd), TypeError);
  for (const index of [-1, 20, 0.5, NaN])
    assert.throws(
      () => moveFourByFourRelativeWings(identity(), index),
      TypeError,
    );
  for (const pairs of [
    [[0, 5]],
    [
      [3, 15],
      [0, 5],
    ],
    [
      [0, 1],
      [5, 2],
    ],
  ]) {
    const state = solvedFourByFourState();
    for (const [a, b] of pairs) swap(state.wingPermutation, a, b);
    assert.throws(() => relativeFourByFourWings(state), TypeError);
  }
  const state = solvedFourByFourState();
  swap(state.cornerPermutation, 0, 1);
  swap(state.centerColors, 0, 5);
  assert.deepEqual(relativeFourByFourWings(state), identity());
});

test("coordinate and hot-loop buffers are detached and metadata is immutable", () => {
  const ctx = createFourByFourJointWingSearch(),
    state = solvedFourByFourState(),
    before = structuredClone(state),
    r = ctx.coordinate(state);
  const output = new Uint8Array(12);
  assert.equal(ctx.moveInto(r, 0, output), output);
  assert.deepEqual(r, identity());
  assert.throws(() => ctx.moveInto(r, 0, r), TypeError);
  r[0] = 99;
  assert.deepEqual(ctx.coordinate(state), identity());
  assert.deepEqual(state, before);
  for (const value of [ctx, ctx.moves, ctx.orbitA, ctx.orbitB])
    assert.ok(Object.isFrozen(value));
});
