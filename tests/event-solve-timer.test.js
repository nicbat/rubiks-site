import { test } from "node:test";
import assert from "node:assert/strict";
import { createEventSolveTimer } from "../src/event-solve-timer.js";

const result = (eventId = "333") => ({
  eventId,
  puzzleId: eventId === "222" ? "2x2" : "3x3",
  algorithm: "R U2 F'",
  generator: { id: "test-provider", version: "1", method: "random-state" },
  grip: { up: "white", front: "green" },
});
function fixture() {
  let time = 100;
  const requests = [];
  const timer = createEventSolveTimer({
    now: () => time,
    generateScramble: (input) =>
      new Promise((resolve, reject) => {
        requests.push({ ...input, resolve, reject });
      }),
  });
  return {
    timer,
    requests,
    clock: (value) => {
      time = value;
    },
  };
}

test("timer cannot start until ready and freezes event/grip/provenance through stop and review", async () => {
  const { timer, requests, clock } = fixture();
  assert.equal(timer.snapshot().status, "idle");
  assert.throws(() => timer.start(), /not ready/);
  const pending = timer.setEvent("222");
  assert.equal(timer.snapshot().status, "loading");
  assert.throws(() => timer.start(), /not ready/);
  const value = result("222");
  requests[0].resolve(value);
  assert.equal(await pending, true);
  const started = timer.start();
  value.generator.version = "external mutation";
  value.grip.up = "yellow";
  clock(1234);
  assert.equal(timer.snapshot().elapsed, 1134);
  const stopped = timer.stop();
  assert.deepEqual(stopped, {
    eventId: "222",
    scramble: "R U2 F'",
    elapsed: 1134,
    scrambleProvenance: {
      id: "test-provider",
      version: "1",
      method: "random-state",
    },
    scrambleGrip: { up: "white", front: "green" },
  });
  assert.equal(started.eventId, "222");
  assert.throws(() => {
    stopped.scrambleGrip.up = "yellow";
  }, TypeError);
  clock(5000);
  assert.equal(timer.snapshot().elapsed, 1134);
  assert.equal(timer.snapshot().solve, stopped);
  assert.equal(timer.stop(), stopped);
  assert.throws(() => timer.start(), /Prepare a new scramble/);
  const next = timer.prepare();
  assert.equal(timer.snapshot().solve, null);
  assert.equal(timer.snapshot().elapsed, 0);
  requests[1].resolve(result("222"));
  await next;
  assert.equal(stopped.elapsed, 1134);
});

test("event changes and new scrambles are rejected during a run without losing it", async () => {
  const { timer, requests, clock } = fixture();
  const ready = timer.prepare();
  requests[0].resolve(result());
  await ready;
  timer.start();
  await assert.rejects(timer.setEvent("222"), /Stop the timer/);
  await assert.rejects(timer.prepare(), /Stop the timer/);
  assert.equal(requests.length, 1);
  assert.equal(timer.snapshot().status, "running");
  clock(1100);
  assert.equal(timer.stop().elapsed, 1000);
  assert.equal(timer.snapshot().eventId, "333");
});

test("superseded completions cannot overwrite a running or stopped solve", async () => {
  const { timer, requests, clock } = fixture();
  const old = timer.prepare();
  const latest = timer.setEvent("222");
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(result("222"));
  await latest;
  timer.start();
  requests[0].resolve(result());
  assert.equal(await old, false);
  assert.equal(timer.snapshot().status, "running");
  assert.equal(timer.snapshot().eventId, "222");
  clock(400);
  const stopped = timer.stop();
  assert.equal(stopped.elapsed, 300);
  assert.equal(stopped.eventId, "222");
});

test("account/import reset aborts generation and explicitly cancels active timing", async () => {
  const { timer, requests, clock } = fixture();
  const old = timer.prepare();
  timer.reset();
  requests[0].resolve(result());
  assert.equal(await old, false);
  assert.equal(timer.snapshot().status, "idle");
  const current = timer.prepare();
  requests[1].resolve(result());
  await current;
  timer.start();
  clock(1100);
  timer.reset({ eventId: "222" });
  assert.equal(timer.snapshot().eventId, "222");
  assert.equal(timer.snapshot().solve, null);
  assert.equal(timer.snapshot().elapsed, 0);
  assert.throws(() => timer.stop(), /not running/);
  assert.throws(() => timer.start(), /not ready/);
});

test("generation failure is visible, not startable, and recoverable", async () => {
  const { timer, requests } = fixture();
  const pending = timer.prepare();
  requests[0].reject(new Error("solver failed"));
  assert.equal(await pending, false);
  assert.equal(timer.snapshot().status, "error");
  assert.equal(timer.snapshot().error.message, "solver failed");
  assert.throws(() => timer.start(), /not ready/);
  const retry = timer.prepare();
  requests[1].resolve(result());
  await retry;
  assert.equal(timer.snapshot().error, null);
  timer.start();
  assert.equal(timer.snapshot().status, "running");
});

test("invalid selection preserves a stopped solve and invalid clocks preserve readiness", async () => {
  const { timer, requests, clock } = fixture();
  const ready = timer.prepare();
  requests[0].resolve(result());
  await ready;
  clock(NaN);
  assert.throws(() => timer.start(), /Invalid timer clock/);
  assert.equal(timer.snapshot().status, "ready");
  clock(100);
  timer.start();
  clock(90);
  assert.equal(timer.snapshot().elapsed, 0);
  const stopped = timer.stop();
  await assert.rejects(timer.setEvent("pyram"), /supported event/);
  assert.equal(timer.snapshot().solve, stopped);
  assert.equal(timer.snapshot().status, "stopped");
});

test("destroy cancels a run and blocks all timer mutations", async () => {
  const { timer, requests } = fixture();
  const ready = timer.prepare();
  requests[0].resolve(result());
  await ready;
  timer.start();
  timer.destroy();
  timer.destroy();
  assert.equal(timer.snapshot().status, "disposed");
  assert.equal(timer.snapshot().solve, null);
  assert.throws(() => timer.start(), /disposed/);
  assert.throws(() => timer.stop(), /disposed/);
  assert.throws(() => timer.reset(), /disposed/);
  await assert.rejects(timer.prepare(), /disposed/);
});
