import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import {
  generateScramble,
  createSolveTimer,
  formatElapsed,
  shouldHandleTimerKey,
} from "../src/solve-timer.js";
import { renderTimer } from "../src/timer-view.js";

function seeded(seed) {
  return (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
}

test("seeded timer scrambles are valid, nontrivial face-turn sequences", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const pick = seeded(0x51c0be);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const scramble = generateScramble(pick);
    const moves = scramble.split(" ");
    assert.equal(moves.length, 20);
    const axes = moves.map((move) => {
      assert.match(move, /^[UDRLFB](2|')?$/);
      return ["UD", "RL", "FB"].findIndex((axis) => axis.includes(move[0]));
    });
    for (let j = 1; j < axes.length; j++) assert.notEqual(axes[j], axes[j - 1]);
    assert.ok(!puzzle.algToTransformation(scramble).isIdentityTransformation());
    seen.add(scramble);
  }
  assert.equal(seen.size, 200);
  assert.throws(() => generateScramble(pick, 0), RangeError);
  assert.throws(() => generateScramble(pick, 101), RangeError);
});

test("stopwatch uses elapsed clock time; stop is stable and next solve resets", () => {
  let now = 100;
  const timer = createSolveTimer({ now: () => now, pick: seeded(42) });
  const original = timer.snapshot().scramble;
  assert.equal(timer.snapshot().elapsed, 0);
  timer.advance();
  now = 1335;
  assert.equal(timer.snapshot().elapsed, 1235);
  timer.newScramble();
  assert.equal(
    timer.snapshot().scramble,
    original,
    "cannot change an active scramble",
  );
  now = 5234;
  timer.advance();
  assert.equal(timer.snapshot().status, "stopped");
  assert.equal(timer.snapshot().elapsed, 5134);
  now = 100000;
  timer.stop();
  assert.equal(
    timer.snapshot().elapsed,
    5134,
    "stopping twice cannot overwrite result",
  );
  timer.advance();
  assert.equal(timer.snapshot().status, "ready");
  assert.equal(timer.snapshot().elapsed, 0);
  assert.notEqual(timer.snapshot().scramble, original);
  timer.advance();
  now += 250;
  timer.stop();
  assert.equal(timer.snapshot().elapsed, 250);
});

test("timer outputs whole seconds and exactly two decimal places without rounding up", () => {
  for (const [ms, output] of [
    [0, "0.00"],
    [9, "0.00"],
    [10, "0.01"],
    [1999, "1.99"],
    [61239, "61.23"],
    [-5, "0.00"],
  ])
    assert.equal(formatElapsed(ms), output);
});

test("Space shortcut ignores repeats, editors, modifier keys, and composition", () => {
  assert.equal(shouldHandleTimerKey({ code: "Space" }), true);
  assert.equal(shouldHandleTimerKey({ code: "Enter" }), false);
  for (const field of [
    "repeat",
    "interactive",
    "ctrlKey",
    "metaKey",
    "altKey",
    "isComposing",
  ])
    assert.equal(shouldHandleTimerKey({ code: "Space", [field]: true }), false);
});

test("timer view exposes touch actions and announces only final time", () => {
  const ready = renderTimer({
    status: "ready",
    scramble: "R U2 F'",
    elapsed: 0,
  });
  assert.match(ready, /Start timer/);
  assert.match(ready, /aria-live="off"/);
  const running = renderTimer({
    status: "running",
    scramble: "R U2 F'",
    elapsed: 1955,
  });
  assert.match(running, /Stop timer/);
  assert.match(running, /data-action="timer-new" disabled/);
  const stopped = renderTimer({
    status: "stopped",
    scramble: "R U2 F'",
    elapsed: 61239,
  });
  assert.match(stopped, /Finished in 61.23 seconds/);
  assert.match(stopped, /Next scramble/);
});
