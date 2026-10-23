import { test } from "node:test";
import assert from "node:assert/strict";
import { createSyncQueue } from "../src/sync-queue.js";

test("saved changes start immediately after the commit turn and coalesce synchronous saves", async () => {
  let calls = 0;
  const queue = createSyncQueue({
    sync: async () => calls++,
    snapshot: { status: "synced" },
    cancel() {},
  });
  const first = queue.request();
  queue.request();
  queue.request();
  assert.equal(calls, 0);
  await first;
  assert.equal(calls, 1);
});
test("changes during an upload get a serial follow-up without overlapping requests", async () => {
  const entered = Promise.withResolvers(),
    release = Promise.withResolvers();
  let calls = 0,
    running = 0,
    peak = 0;
  const queue = createSyncQueue({
    async sync() {
      running++;
      peak = Math.max(peak, running);
      calls++;
      if (calls === 1) {
        entered.resolve();
        await release.promise;
      }
      running--;
    },
    snapshot: { status: "synced" },
    cancel() {},
  });
  const first = queue.request();
  await entered.promise;
  queue.request();
  queue.request();
  release.resolve();
  await first;
  assert.equal(calls, 2);
  assert.equal(peak, 1);
});
test("continued real interactions are drained beyond the automatic retry limit", async () => {
  let calls = 0,
    queue;
  queue = createSyncQueue({
    async sync() {
      calls++;
      if (calls < 6) void queue.request();
    },
    snapshot: { status: "synced" },
    cancel() {},
  });
  await queue.request();
  assert.equal(calls, 6);
});
test("automatic stale-write retries are bounded and errors/conflicts wait for another interaction", async () => {
  let calls = 0;
  const engine = {
    async sync() {
      calls++;
    },
    snapshot: { status: "pending", retry: true },
    cancel() {},
  };
  const queue = createSyncQueue(engine);
  await queue.request();
  assert.equal(calls, 3);
  engine.snapshot = { status: "error", retry: true };
  await queue.request();
  assert.equal(calls, 4);
  engine.snapshot = { status: "conflict", retry: true };
  await queue.request("cloud");
  assert.equal(calls, 5);
});
test("identity changes cancel queued and late work", async () => {
  let calls = 0,
    cancelled = false;
  const queue = createSyncQueue({
    async sync() {
      calls++;
    },
    snapshot: { status: "synced" },
    cancel() {
      cancelled = true;
    },
  });
  const first = queue.request();
  queue.cancel();
  await first;
  await queue.request();
  assert.equal(calls, 0);
  assert.equal(cancelled, true);
  const release = Promise.withResolvers(),
    entered = Promise.withResolvers();
  const active = createSyncQueue({
    async sync() {
      entered.resolve();
      await release.promise;
    },
    snapshot: { status: "pending", retry: true },
    cancel() {},
  });
  const uploading = active.request();
  await entered.promise;
  active.request();
  active.cancel();
  release.resolve();
  await uploading;
});
