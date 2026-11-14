import { test } from "node:test";
import assert from "node:assert/strict";
import { createTimerController } from "../src/timer-controller.js";

const generated = (eventId) => ({
  eventId,
  puzzleId: eventId === "222" ? "2x2" : "3x3",
  algorithm: "R U F2",
  generator: { id: "test", version: "1", method: "random-state" },
  grip: { up: "white", front: "green" },
});
function fixture(options = {}) {
  const pending = [],
    changes = [];
  let time = 100,
    destroyed = 0;
  const provider = {
    generateScramble: (request) =>
      new Promise((resolve, reject) => {
        pending.push({ ...request, resolve, reject });
      }),
    destroy: () => {
      destroyed++;
    },
  };
  const timer = createTimerController({
    provider,
    now: () => time,
    changed: () => changes.push(timer.snapshot().status),
    ...options,
  });
  return {
    timer,
    pending,
    changes,
    clock: (value) => {
      time = value;
    },
    get destroyed() {
      return destroyed;
    },
  };
}

test("adapter starts lazily and exposes async readiness plus synchronous start/stop metadata", async () => {
  const f = fixture();
  assert.equal(f.pending.length, 0);
  assert.deepEqual(f.changes, []);
  const ready = f.timer.newScramble();
  assert.equal(f.timer.snapshot().status, "loading");
  assert.equal(f.timer.advance(), false);
  f.pending[0].resolve(generated("333"));
  assert.equal(await ready, true);
  assert.deepEqual(f.changes, ["loading", "ready"]);
  assert.deepEqual(f.timer.snapshot().scrambleGrip, {
    up: "white",
    front: "green",
  });
  assert.equal(f.timer.snapshot().scrambleProvenance.id, "test");
  f.timer.advance();
  assert.equal(f.timer.snapshot().status, "running");
  f.clock(1100);
  const completed = f.timer.advance();
  assert.equal(completed.elapsed, 1000);
  assert.equal(completed.eventId, "333");
  assert.equal(f.timer.snapshot().solve, completed);
  assert.equal(f.timer.stop(), null);
  assert.equal(f.timer.snapshot().status, "stopped");
});

test("start gate prevents timing without consuming ready metadata and can recover", async () => {
  let writable = false;
  const f = fixture({ canStart: () => writable });
  const ready = f.timer.newScramble();
  f.pending[0].resolve(generated("333"));
  await ready;
  assert.equal(f.timer.advance(), false);
  assert.equal(f.timer.snapshot().error.code, "START_BLOCKED");
  assert.equal(f.timer.snapshot().status, "ready");
  writable = true;
  f.timer.advance();
  assert.equal(f.timer.snapshot().status, "running");
  assert.equal(f.timer.snapshot().error, null);
});

test("event switching invalidates pending work, failures stay explicit, and retry never falls back", async () => {
  const f = fixture();
  const old = f.timer.newScramble();
  const current = f.timer.setEvent("222");
  assert.equal(f.pending[0].signal.aborted, true);
  f.pending[0].resolve(generated("333"));
  assert.equal(await old, false);
  f.pending[1].reject(new Error("generation failed"));
  assert.equal(await current, false);
  assert.equal(f.timer.snapshot().eventId, "222");
  assert.equal(f.timer.snapshot().status, "error");
  assert.equal(f.timer.snapshot().scramble, null);
  const retry = f.timer.advance();
  assert.equal(f.pending[2].eventId, "222");
  f.pending[2].resolve(generated("222"));
  await retry;
  f.timer.advance();
  assert.equal(await f.timer.setEvent("333oh"), false);
  assert.equal(await f.timer.newScramble(), false);
  assert.equal(f.timer.snapshot().eventId, "222");
});

test("clear requests a fresh scramble after a stopped solve and does not reuse its identity", async () => {
  const f = fixture();
  const ready = f.timer.newScramble();
  f.pending[0].resolve(generated("333"));
  await ready;
  f.timer.advance();
  const completed = f.timer.stop();
  const next = f.timer.clear();
  assert.equal(f.timer.snapshot().status, "loading");
  assert.equal(f.timer.snapshot().solve, null);
  assert.equal(f.timer.advance(), false);
  f.pending[1].resolve({ ...generated("333"), algorithm: "U F R2" });
  await next;
  assert.equal(f.timer.snapshot().scramble, "U F R2");
  assert.equal(completed.scramble, "R U F2");
});

test("account/import reset cancels pending generation and active timing without recording", async () => {
  const f = fixture();
  const pending = f.timer.newScramble();
  f.timer.reset({ eventId: "333oh" });
  f.pending[0].resolve(generated("333"));
  assert.equal(await pending, false);
  assert.equal(f.timer.snapshot().status, "idle");
  const ready = f.timer.newScramble();
  f.pending[1].resolve(generated("333oh"));
  await ready;
  f.timer.advance();
  f.timer.reset();
  assert.equal(f.timer.snapshot().solve, null);
  assert.equal(f.timer.snapshot().elapsed, 0);
  assert.equal(f.timer.stop(), null);
});

test("destroy suppresses late notifications and releases its provider once", async () => {
  const f = fixture();
  const pending = f.timer.newScramble();
  f.timer.destroy();
  f.timer.destroy();
  const count = f.changes.length;
  f.pending[0].resolve(generated("333"));
  assert.equal(await pending, false);
  assert.equal(f.changes.length, count);
  assert.equal(f.destroyed, 1);
  assert.equal(f.timer.snapshot().status, "disposed");
  await assert.rejects(f.timer.newScramble(), /disposed/);
});
