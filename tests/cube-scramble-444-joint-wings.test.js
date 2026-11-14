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
    retainedBytes: 1751312,
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

test("four-pair quotient is complete, bounded, abortable and dominates the three-pair relaxation", () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      createFourByFourJointWingSearch({ pairs: 4, signal: controller.signal }),
    { name: "AbortError" },
  );
  const strong = createFourByFourJointWingSearch({ pairs: 4 }),
    weak = createFourByFourJointWingSearch();
  assert.deepEqual(fourByFourJointWingDiagnostics({ pairs: 4 }), {
    partialCoordinates: 11880,
    coordinates: 5880600,
    goalCoordinates: 495,
    maximumDistance: 8,
    retainedBytes: 5889512,
    queueBytes: 23522400,
    transitionBytes: 1075140,
  });
  const random = seeded(444);
  let improvements = 0;
  for (let trial = 0; trial < 10000; trial++) {
    const r = identity();
    for (let i = 11; i > 0; i--) {
      const j = random() % (i + 1);
      swap(r, i, j);
    }
    let parity = 0;
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < i; j++) if (r[j] > r[i]) parity ^= 1;
    if (parity) swap(r, 0, 1);
    const a = weak.heuristic(r),
      b = strong.heuristic(r);
    assert.ok(b >= a);
    assert.ok(b <= 8);
    if (b > a) improvements++;
    assert.equal(
      b === 0,
      r.every((v, i) => v === i),
    );
  }
  assert.ok(improvements > 3000, `Only ${improvements} stronger bounds`);
  for (const pairs of [0, 2, 5, null, "4"])
    assert.throws(() => createFourByFourJointWingSearch({ pairs }), TypeError);
});

test("four-pair canonical relabeling preserves admissibility against exact BFS and independently verified paired excursions", () => {
  const ctx = createFourByFourJointWingSearch({ pairs: 4 }),
    start = identity(),
    seen = new Set([start.join(",")]);
  let frontier = [start];
  for (let depth = 0; depth <= 4; depth++) {
    const next = [];
    for (const r of frontier) {
      assert.ok(ctx.heuristic(r) <= depth);
      assert.equal(
        ctx.heuristic(r) === 0,
        r.every((v, i) => v === i),
      );
      if (depth === 4) continue;
      for (let m = 0; m < 20; m++) {
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
  const random = seeded(0x4444abcd);
  for (let trial = 0; trial < 40; trial++) {
    const path = ["U", "R", "F'", "D", "B2", "L"];
    let state = applyFourByFourMoves(solvedFourByFourState(), path.join(" "));
    assert.equal(ctx.heuristic(ctx.coordinate(state)), 0);
    for (let depth = 1; depth <= 12; depth++) {
      const move = ctx.moves[random() % 20];
      path.push(move);
      state = applyFourByFourMoves(state, move);
      assert.ok(ctx.heuristic(ctx.coordinate(state)) <= depth);
    }
    assertNxNOracle(fourByFourStateToFacelets(state), path.join(" "), 4);
  }
});
