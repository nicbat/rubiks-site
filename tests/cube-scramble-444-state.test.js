import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solvedFourByFourState,
  sampleFourByFourState,
  validateFourByFourState,
  applyFourByFourMoves,
  fourByFourStateToFacelets,
  FOUR_BY_FOUR_MOVES,
  FOUR_BY_FOUR_COORDINATES,
  fourByFourCenterMovePermutation,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (initial) => {
  let x = initial;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
};
const parity = (a) =>
  a.reduce((s, v, i) => s + a.slice(i + 1).filter((w) => w < v).length, 0) % 2;
test("all36 transitions and seeded move sequences match independent96-sticker oracle", () => {
  for (const move of FOUR_BY_FOUR_MOVES)
    assertNxNOracle(
      fourByFourStateToFacelets(
        applyFourByFourMoves(solvedFourByFourState(), move),
      ),
      move,
      4,
    );
  const random = seeded(0x444abcd);
  for (let run = 0; run < 60; run++) {
    const moves = Array.from(
      { length: 50 },
      () => FOUR_BY_FOUR_MOVES[random() % 36],
    );
    let state = solvedFourByFourState();
    for (const move of moves) state = applyFourByFourMoves(state, move);
    validateFourByFourState(state);
    assertNxNOracle(fourByFourStateToFacelets(state), moves.join(" "), 4);
  }
});
test("literal R corner permutation and labeled-center parity expose 4x4 constraints", () => {
  const r = applyFourByFourMoves(solvedFourByFourState(), "R");
  assert.deepEqual(r.cornerPermutation, [4, 0, 2, 3, 7, 5, 6, 1]);
  assert.equal(parity(r.cornerPermutation), 1);
  assert.equal(parity(r.wingPermutation), 0); // no 3x3 corner/wing parity rule
  for (const move of FOUR_BY_FOUR_MOVES) {
    const state = applyFourByFourMoves(solvedFourByFourState(), move);
    assert.equal(
      parity(state.cornerPermutation),
      parity(fourByFourCenterMovePermutation(move)),
    );
  }
  const inner = applyFourByFourMoves(solvedFourByFourState(), "Rw R'");
  assert.equal(parity(inner.cornerPermutation), 0);
  assert.equal(parity(inner.wingPermutation), 1);
});
test("center move contract is independent of target, immutable and agrees with color movement", () => {
  for (const move of FOUR_BY_FOUR_MOVES) {
    const permutation = fourByFourCenterMovePermutation(move);
    assert.ok(Object.isFrozen(permutation));
    assert.equal(new Set(permutation).size, 24);
    const state = sampleFourByFourState({ randomUint32: seeded(44) });
    assert.deepEqual(
      applyFourByFourMoves(state, move).centerColors,
      permutation.map((i) => state.centerColors[i]),
    );
  }
  assert.equal(FOUR_BY_FOUR_COORDINATES.centers.length, 24);
  assert.ok(Object.isFrozen(FOUR_BY_FOUR_COORDINATES.centers[0].position));
  assert.throws(() => fourByFourCenterMovePermutation("x"));
});
test("uniform sampler does not force wing parity and supports an invisible center-label witness", () => {
  const rng = seeded(0x444222),
    seen = new Set();
  for (let i = 0; i < 300; i++) {
    const state = sampleFourByFourState({ randomUint32: rng });
    validateFourByFourState(state);
    seen.add(
      `${parity(state.cornerPermutation)}${parity(state.wingPermutation)}`,
    );
    const solved = solvedFourByFourState();
    const pools = Array.from({ length: 6 }, (_, color) =>
      solved.centerColors.flatMap((v, j) => (v === color ? [j] : [])),
    );
    const labels = state.centerColors.map((color) => pools[color].pop());
    if (parity(labels) !== parity(state.cornerPermutation)) {
      const color = state.centerColors[0],
        other = state.centerColors.indexOf(color, 1);
      [labels[0], labels[other]] = [labels[other], labels[0]];
    }
    assert.equal(parity(labels), parity(state.cornerPermutation));
    assert.deepEqual(
      labels.map((j) => solved.centerColors[j]),
      state.centerColors,
    );
    const stickers = fourByFourStateToFacelets(state);
    assert.equal(new Set(stickers.map((s) => `${s.p}/${s.n}`)).size, 96);
  }
  assert.equal(seen.size, 4);
});
test("sampler draws exact Fisher-Yates choices plus seven trits, rejects biased tail", () => {
  let count = 0;
  const state = sampleFourByFourState({
    randomUint32: () => {
      count++;
      return count === 1 ? 0xffffffff : 0;
    },
  });
  assert.equal(count, 60); // 7+23+23+7=60; bound8 accepts initial max word
  assert.equal(state.cornerPermutation[7], 7);
  // First draw bound8 has no tail; rejection occurs at second bound7.
  count = 0;
  sampleFourByFourState({
    randomUint32: () => {
      count++;
      return count === 2 ? 0xffffffff : 0;
    },
  });
  assert.equal(count, 61);
});
test("invalid states, moves, entropy and cancellation fail explicitly; returned state is isolated", () => {
  for (const mutate of [
    (s) => (s.cornerPermutation[0] = 1),
    (s) => (s.cornerOrientation[0] = 1),
    (s) => (s.wingPermutation[0] = 1),
    (s) => (s.centerColors[0] = 99),
    (s) => (s.extra = true),
  ]) {
    const s = solvedFourByFourState();
    mutate(s);
    assert.throws(() => validateFourByFourState(s));
  }
  for (const alg of ["x", "3Rw", "R  U", "R\nU", "R ".repeat(513), null])
    assert.throws(() => applyFourByFourMoves(solvedFourByFourState(), alg));
  assert.throws(() => sampleFourByFourState({ randomUint32: () => -1 }), {
    code: "GENERATION_FAILED",
  });
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => sampleFourByFourState({ signal: controller.signal }), {
    code: "ABORTED",
  });
  const s = solvedFourByFourState(),
    copy = validateFourByFourState(s);
  copy.centerColors[0] = 99;
  assert.notEqual(s.centerColors[0], 99);
  const f = fourByFourStateToFacelets(s);
  f[0].p[0] = 999;
  assert.notEqual(fourByFourStateToFacelets(s)[0].p[0], 999);
});

test("injected sampler choices reproduce independently checked full target states exactly", () => {
  const random = seeded(0x444f);
  for (let run = 0; run < 20; run++) {
    const algorithm = Array.from(
      { length: 40 },
      () => FOUR_BY_FOUR_MOVES[random() % 36],
    ).join(" ");
    const target = applyFourByFourMoves(solvedFourByFourState(), algorithm);
    const words = [];
    for (const field of [
      "cornerPermutation",
      "wingPermutation",
      "centerColors",
    ]) {
      const pool = solvedFourByFourState()[field];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = pool.findIndex((v, k) => k <= i && v === target[field][i]);
        assert.ok(j >= 0);
        words.push(j);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    words.push(...target.cornerOrientation.slice(0, 7));
    let consumed = 0;
    const sampled = sampleFourByFourState({
      randomUint32: () => {
        assert.ok(consumed < words.length);
        return words[consumed++];
      },
    });
    assert.equal(consumed, 60);
    assert.deepEqual(sampled, target);
    assertNxNOracle(fourByFourStateToFacelets(sampled), algorithm, 4);
  }
  const sparse = solvedFourByFourState();
  delete sparse.cornerOrientation[0];
  assert.throws(() => validateFourByFourState(sparse));
});
