import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confettiBurst,
  confettiColors,
  timerConfetti,
} from "../src/confetti.js";

test("confetti bursts evenly out of both sides, seeded", () => {
  const burst = confettiBurst({ perSide: 9, seed: 3 });
  assert.deepEqual(confettiBurst({ perSide: 9, seed: 3 }), burst);
  assert.notDeepEqual(confettiBurst({ perSide: 9, seed: 4 }), burst);
  assert.equal(burst.filter((p) => p.side === -1).length, 9);
  assert.equal(burst.filter((p) => p.side === 1).length, 9);
});

test("every piece flies outward and up, then falls, in a known color", () => {
  for (const piece of confettiBurst({ perSide: 40, seed: 11 })) {
    assert.ok(piece.dx > 0, "dx is the outward distance");
    assert.ok(piece.rise < 0 && piece.fall > 0);
    assert.ok(piece.delay >= 0 && piece.delay <= 0.12);
    assert.ok(piece.width > 0 && piece.height > 0);
    assert.ok(confettiColors.includes(piece.color));
  }
});

test("the timer's burst uses several colors on each side", () => {
  for (const side of [-1, 1]) {
    const colors = new Set(
      timerConfetti.filter((p) => p.side === side).map((p) => p.color),
    );
    assert.ok(colors.size >= 4);
  }
});
