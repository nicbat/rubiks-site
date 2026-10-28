import { test } from "node:test";
import assert from "node:assert/strict";
import { pixelFire, fireRuns, timerFire } from "../src/pixel-fire.js";

const options = { width: 24, height: 12, levels: 5, frames: 4, seed: 7 };

test("the fire is seeded, bounded, and burns from a full-heat base", () => {
  const frames = pixelFire(options);
  assert.deepEqual(pixelFire(options), frames);
  assert.notDeepEqual(pixelFire({ ...options, seed: 8 }), frames);
  assert.equal(frames.length, options.frames);
  for (const frame of frames) {
    assert.equal(frame.length, options.height);
    assert.ok(frame.every((row) => row.length === options.width));
    assert.ok(
      frame.flat().every((h) => Number.isInteger(h) && h >= 0 && h <= 5),
    );
    assert.ok(frame.at(-1).every((h) => h === options.levels));
  }
  // Frames move: consecutive frames are not identical.
  for (let i = 1; i < frames.length; i++)
    assert.notDeepEqual(frames[i], frames[i - 1]);
});

test("flames cool as they rise", () => {
  const frames = pixelFire({ ...options, width: 64, height: 20, frames: 8 });
  const heat = (y) =>
    frames.reduce((sum, frame) => sum + frame[y].reduce((a, h) => a + h, 0), 0);
  // Summed over frames, the top row is far cooler than the base, and the
  // upper body cooler than the lower.
  assert.ok(heat(0) < heat(19) / 4);
  assert.ok(heat(5) < heat(15));
});

test("each level's runs draw exactly the pixels burning at that level", () => {
  const [frame] = pixelFire(options);
  const runs = fireRuns(frame, options.levels);
  assert.equal(runs.length, options.levels);
  const drawn = new Map();
  runs.forEach((d, i) => {
    for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g))
      for (let j = 0; j < +w; j++) {
        assert.ok(!drawn.has(`${+x + j},${y}`), "pixels are drawn once");
        drawn.set(`${+x + j},${y}`, i + 1);
      }
  });
  frame.forEach((row, y) =>
    row.forEach((h, x) => assert.equal(drawn.get(`${x},${y}`), h || undefined)),
  );
});

test("the timer flame is a ready set of distinct frames", () => {
  assert.equal(timerFire.frames.length, 6);
  assert.equal(new Set(timerFire.frames.map((runs) => runs.join("|"))).size, 6);
  for (const runs of timerFire.frames) {
    assert.equal(runs.length, timerFire.levels);
    // The base row always burns at the hottest level.
    assert.ok(
      runs.at(-1).includes(`M0 ${timerFire.height - 1}h${timerFire.width}`),
    );
  }
});
