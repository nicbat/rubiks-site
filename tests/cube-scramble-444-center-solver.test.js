import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solveFourByFourCenters,
  fourByFourCenterSolverDiagnostics,
} from "../packages/cube-engine/scramble/four-by-four-center-solver.js";
import {
  sampleFourByFourState,
  solvedFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
  FOUR_BY_FOUR_MOVES,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (seed) => () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
};
const parity = (a) =>
  a.reduce((n, v, i) => n + a.slice(i + 1).filter((w) => w < v).length, 0) % 2;
test("complete center stage solves uniform states with bounded immutable conjugation resources", () => {
  const rng = seeded(0x444cc),
    solved = solvedFourByFourState();
  for (let i = 0; i < 256; i++) {
    const state = sampleFourByFourState({ randomUint32: rng }),
      copy = structuredClone(state);
    const result = solveFourByFourCenters(state),
      end = applyFourByFourMoves(state, result.algorithm);
    assert.deepEqual(end.centerColors, solved.centerColors);
    assert.deepEqual(state, copy);
    assert.equal(
      parity(end.cornerPermutation),
      parity(state.cornerPermutation),
    );
    assert.equal(parity(end.wingPermutation), parity(state.wingPermutation));
    assert.ok(result.cycles <= 22);
    assert.ok(result.moveCount <= 396);
    assert.equal(result.moveCount, result.algorithm.split(" ").length);
  }
  assert.deepEqual(fourByFourCenterSolverDiagnostics(), {
    conjugates: 12144,
    maxConjugationDepth: 5,
    retainedBytes: 41472,
    initializationScratchBytes: 38976,
    maxCycles: 22,
    maxUncompactedMoves: 396,
  });
});
test("full96-sticker independent oracle verifies completed center solutions and noncenter effects", () => {
  const rng = seeded(0x444face);
  for (let i = 0; i < 36; i++) {
    const setup = Array.from(
      { length: 40 },
      () => FOUR_BY_FOUR_MOVES[rng() % 36],
    ).join(" ");
    const state = applyFourByFourMoves(solvedFourByFourState(), setup),
      result = solveFourByFourCenters(state);
    const end = applyFourByFourMoves(state, result.algorithm);
    assert.deepEqual(end.centerColors, solvedFourByFourState().centerColors);
    assertNxNOracle(
      fourByFourStateToFacelets(end),
      `${setup} ${result.algorithm}`,
      4,
    );
  }
});
test("solved colors need no work; cancellation and invalid state fail without replacement", () => {
  const solved = solvedFourByFourState();
  assert.deepEqual(solveFourByFourCenters(solved), {
    algorithm: "",
    cycles: 0,
    moveCount: 0,
  });
  const c = new AbortController();
  c.abort();
  assert.throws(() => solveFourByFourCenters(solved, { signal: c.signal }), {
    code: "ABORTED",
  });
  const bad = structuredClone(solved);
  bad.centerColors[0] = 99;
  assert.throws(() => solveFourByFourCenters(bad));
  // A two-color transposition is legal via an invisible same-color label swap.
  const state = structuredClone(solved),
    a = 0,
    b = state.centerColors.findIndex((v) => v !== state.centerColors[0]);
  [state.centerColors[a], state.centerColors[b]] = [
    state.centerColors[b],
    state.centerColors[a],
  ];
  const result = solveFourByFourCenters(state);
  assert.deepEqual(
    applyFourByFourMoves(state, result.algorithm).centerColors,
    solved.centerColors,
  );
});

test("equal-color assignment optimization keeps constructive stages within integration headroom", () => {
  const randomUint32 = seeded(444);
  for (let i = 0; i < 40; i++) {
    const state = sampleFourByFourState({ randomUint32 });
    const result = solveFourByFourCenters(state);
    // Old sequential labeling spends178–335 moves on the reference1000-state
    // corpus. This leaves room for the independently implemented wing/333 stages.
    assert.ok(
      result.moveCount <= 180,
      `center stage used ${result.moveCount} moves`,
    );
    assert.deepEqual(
      applyFourByFourMoves(state, result.algorithm).centerColors,
      solvedFourByFourState().centerColors,
    );
    assert.deepEqual(solveFourByFourCenters(state), result);
  }
});
