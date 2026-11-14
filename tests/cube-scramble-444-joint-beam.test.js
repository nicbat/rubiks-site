import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFourByFourJointBeam } from "../packages/cube-engine/scramble/four-by-four-joint-beam.js";
import {
  sampleFourByFourState,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { groupFourByFourOppositeCenters } from "../packages/cube-engine/scramble/four-by-four-centers.js";
import { searchFourByFourJointPhase2 } from "../packages/cube-engine/scramble/four-by-four-joint-phase2.js";
import { solveThreeByThree } from "../packages/cube-engine/scramble/three-by-three.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
test("beam reduces first uniform corpus target and independently reproduces all96 stickers", async () => {
  let seed = 0x444c0de;
  const randomUint32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const target = sampleFourByFourState({ randomUint32 }),
    copy = structuredClone(target);
  const first = groupFourByFourOppositeCenters(target, { maxNodes: 1470942 });
  const second = searchFourByFourJointPhase2(
    applyFourByFourMoves(target, first.algorithm),
    { budget: { nodes: 0, maxNodes: 1000000 }, maxCandidates: 1 },
  );
  const budget = { nodes: 31, maxNodes: 1000031 };
  const result = searchFourByFourJointBeam(second.candidates[0].state, {
    budget,
  });
  assert.equal(budget.nodes, 31 + result.nodes);
  assert.ok(result.nodes > result.expandedParents);
  assert.ok(result.moveCount <= 32);
  const finish = await solveThreeByThree(result.target, { maxNodes: 50000000 });
  const algorithm = [
    first.algorithm,
    second.candidates[0].algorithm,
    result.algorithm,
    finish.algorithm,
  ].join(" ");
  assertNxNOracle(fourByFourStateToFacelets(target), inverse(algorithm, 4), 4);
  assert.deepEqual(target, copy);
});
test("beam bounds, failure and cancellation preserve supplied state and exact budget", () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Rw2 U2 Fw2"),
    copy = structuredClone(state);
  const budget = { nodes: 7, maxNodes: 8 };
  assert.throws(() => searchFourByFourJointBeam(state, { budget }), {
    code: "JOINT_PHASE3_SEARCH_LIMIT",
  });
  assert.equal(budget.nodes, 8);
  assert.throws(
    () =>
      searchFourByFourJointBeam(state, {
        budget: { nodes: 0, maxNodes: 100 },
        maxDepth: 0,
      }),
    { code: "JOINT_PHASE3_DEPTH_LIMIT" },
  );
  for (const extra of [
    { beamWidth: 0 },
    { beamWidth: 4097 },
    { maxDepth: 33 },
    { wingPairs: 5 },
  ])
    assert.throws(
      () =>
        searchFourByFourJointBeam(state, {
          budget: { nodes: 0, maxNodes: 100 },
          ...extra,
        }),
      TypeError,
    );
  assert.throws(
    () =>
      searchFourByFourJointBeam(state, {
        budget: { nodes: 0, maxNodes: 100 },
        signal: AbortSignal.abort(),
      }),
    { name: "AbortError" },
  );
  assert.throws(
    () =>
      searchFourByFourJointBeam(applyFourByFourMoves(state, "Rw"), {
        budget: { nodes: 0, maxNodes: 100 },
      }),
    TypeError,
  );
  assert.deepEqual(state, copy);
  const solved = searchFourByFourJointBeam(solvedFourByFourState(), {
    budget: { nodes: 1, maxNodes: 1 },
    maxDepth: 0,
  });
  assert.equal(solved.algorithm, "");
  assert.equal(solved.nodes, 0);
});

test("beam accepts a generated goal at the exact child budget boundary", () => {
  const state = applyFourByFourMoves(solvedFourByFourState(), "Uw2");
  const budget = { nodes: 0, maxNodes: 2 };
  const result = searchFourByFourJointBeam(state, {
    budget,
    maxDepth: 1,
    beamWidth: 1,
  });
  assert.equal(result.nodes, 2);
  assert.equal(result.moveCount, 1);
  assert.deepEqual(result.state, solvedFourByFourState());
  assertNxNOracle(
    fourByFourStateToFacelets(result.state),
    "Uw2 " + result.algorithm,
    4,
  );
});

// Deliberately allocation-heavy reference: string keys and stable object sorting
// independently check packed-key collisions, insertion ties, and layer reuse.
async function referenceBeam(state, width, maxDepth) {
  const { fourByFourJointCenterContext } =
    await import("../packages/cube-engine/scramble/four-by-four-joint-centers.js");
  const { createFourByFourJointWingSearch } =
    await import("../packages/cube-engine/scramble/four-by-four-joint-wings.js");
  const c = fourByFourJointCenterContext(),
    w = createFourByFourJointWingSearch({ pairs: 4 }),
    bases = w.moves.map((x) => x.replace(/[2']/g, ""));
  const key = (c, r) => c + ":" + r.join(",");
  let nodes = 0,
    expandedParents = 0,
    collisions = 0;
  let layer = [
    { c: c.coordinate(state), r: w.coordinate(state), path: [], last: -1 },
  ];
  const visited = new Set([key(layer[0].c, layer[0].r)]);
  let hashCapacity = 1;
  while (hashCapacity < width * 40) hashCapacity *= 2;
  for (let depth = 0; depth <= maxDepth; depth++) {
    if (depth === maxDepth)
      return { failed: true, nodes, expandedParents, collisions };
    const next = new Map(),
      slots = new Map();
    for (const parent of layer) {
      expandedParents++;
      for (let m = 0; m < 20; m++) {
        if (parent.last >= 0 && bases[parent.last] === bases[m]) continue;
        nodes++;
        const center = c.move(parent.c, m),
          r = w.moveInto(parent.r, m, new Uint8Array(12));
        if (center === c.goal && r.every((v, i) => v === i))
          return {
            algorithm: [...parent.path, m].map((i) => w.moves[i]).join(" "),
            nodes,
            expandedParents,
            collisions,
          };
        const k = key(center, r);
        if (visited.has(k) || next.has(k)) continue;
        let packed = 0;
        for (const v of r) packed = packed * 16 + v;
        const slot =
          (Math.imul(
            (packed >>> 0) ^ Math.floor(packed / 4294967296),
            0x9e3779b1,
          ) ^
            Math.imul(center, 0x85ebca6b)) &
          (hashCapacity - 1);
        if (slots.has(slot) && slots.get(slot) !== k) collisions++;
        slots.set(slot, k);
        const a = c.distance(center),
          b = w.heuristic(r);
        next.set(k, {
          c: center,
          r,
          path: [...parent.path, m],
          last: m,
          max: Math.max(a, b),
          sum: a + b,
          key: k,
        });
      }
    }
    layer = [...next.values()]
      .sort((a, b) => a.max - b.max || a.sum - b.sum)
      .slice(0, width);
    for (const n of layer) visited.add(n.key);
  }
}

test("compact frontiers match independent string-key reference through collisions and reused layers", async () => {
  let collisions = 0;
  for (const alg of ["Rw2 U2 Fw2", "Uw2 R F Lw2 B'", "Fw2 Rw2 B L Uw2"]) {
    const state = applyFourByFourMoves(solvedFourByFourState(), alg),
      before = structuredClone(state);
    const reference = await referenceBeam(state, 16, 12);
    collisions += reference.collisions;
    const budget = { nodes: 0, maxNodes: 100000 };
    if (reference.failed)
      assert.throws(
        () =>
          searchFourByFourJointBeam(state, {
            budget,
            beamWidth: 16,
            maxDepth: 12,
          }),
        { code: "JOINT_PHASE3_DEPTH_LIMIT" },
      );
    else {
      const actual = searchFourByFourJointBeam(state, {
        budget,
        beamWidth: 16,
        maxDepth: 12,
      });
      assert.equal(actual.algorithm, reference.algorithm);
      assert.equal(actual.expandedParents, reference.expandedParents);
      assertNxNOracle(
        fourByFourStateToFacelets(actual.state),
        alg + " " + actual.algorithm,
        4,
      );
    }
    assert.equal(budget.nodes, reference.nodes);
    assert.deepEqual(state, before);
  }
  assert.ok(
    collisions > 100,
    `Collision path must be exercised: ${collisions}`,
  );
});

test("typed workspace remains fixed by width and depth with bounded hash load", async () => {
  const { fourByFourJointBeamWorkspace } =
    await import("../packages/cube-engine/scramble/four-by-four-joint-beam.js");
  for (const width of [1, 16, 1024, 4096])
    for (const depth of [0, 1, 32]) {
      const x = fourByFourJointBeamWorkspace(width, depth);
      assert.equal(x.candidateCapacity, width * 20);
      assert.equal(x.visitedEntries, 1 + depth * width);
      assert.ok(x.hashCapacity >= 2 * x.candidateCapacity);
      assert.ok(x.visitedCapacity >= 2 * x.visitedEntries);
      assert.equal(
        x.typedWorkspaceBytes,
        width * 98 +
          width * 20 * 21 +
          x.hashCapacity * 4 +
          x.visitedCapacity * 12 +
          24,
      );
      assert.ok(x.typedWorkspaceBytes < 10000000);
    }
  assert.throws(() => fourByFourJointBeamWorkspace(4097), TypeError);
  assert.throws(() => fourByFourJointBeamWorkspace(1, 33), TypeError);
});

test("selected-state visitation reduces formerly depth-exhausted corpus target without increasing caps", async () => {
  let seed = 0x444c0de;
  const randomUint32 = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  let target;
  for (let i = 0; i <= 3; i++) target = sampleFourByFourState({ randomUint32 });
  const first = groupFourByFourOppositeCenters(target, { maxNodes: 1470942 });
  const second = searchFourByFourJointPhase2(
    applyFourByFourMoves(target, first.algorithm),
    { budget: { nodes: 0, maxNodes: 1000000 }, maxCandidates: 8 },
  );
  const candidate = second.candidates[1];
  const reference = await referenceBeam(candidate.state, 1024, 32);
  assert.equal(reference.failed, undefined);
  const budget = { nodes: 0, maxNodes: 1000000 };
  const result = searchFourByFourJointBeam(candidate.state, { budget });
  assert.equal(result.algorithm, reference.algorithm);
  assert.equal(result.nodes, reference.nodes);
  assert.equal(result.expandedParents, reference.expandedParents);
  assert.ok(result.moveCount <= 32);
  assert.ok(result.nodes < 1000000);
  const finish = await solveThreeByThree(result.target, { maxNodes: 50000000 });
  assertNxNOracle(
    fourByFourStateToFacelets(target),
    inverse(
      [
        first.algorithm,
        candidate.algorithm,
        result.algorithm,
        finish.algorithm,
      ].join(" "),
      4,
    ),
    4,
  );
});
