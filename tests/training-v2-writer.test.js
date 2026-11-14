import { test } from "node:test";
import assert from "node:assert/strict";
import { createTrainingV2Writer } from "../src/training-v2-writer.js";
import {
  createTrainingV2Store,
  TRAINING_V2_KEY,
} from "../src/training-local-v2.js";
import { emptyProgress } from "../src/progress.js";
import catalog from "../data/algorithms.json" with { type: "json" };

function fixture() {
  const bytes = new Map();
  let fail = false;
  let queued = null;
  let pause = false;
  const storage = {
    getItem: (key) => bytes.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw Error("Quota exceeded");
      bytes.set(key, value);
    },
  };
  const session = createTrainingV2Store({
    storage,
    catalog,
    scope: "guest:false",
    withLock: async (_name, run) => {
      if (pause)
        await new Promise((resolve) => {
          queued = resolve;
        });
      return run();
    },
  });
  let current = true;
  return {
    bytes,
    session,
    writer: createTrainingV2Writer({ session, isCurrent: () => current }),
    fail: () => {
      fail = true;
    },
    pause: () => {
      pause = true;
    },
    resume: () => {
      pause = false;
      queued?.();
    },
    leave: () => {
      current = false;
      session.close();
    },
  };
}
const backup = () => ({
  format: "last-layer-training",
  version: 2,
  progress: emptyProgress(),
  solves: [],
  cubeCollection: { cubes: [], defaultsByEvent: {} },
});
const completed = {
  id: "completed",
  eventId: "222",
  elapsed: 1234,
  date: "2026-11-14T12:00:00Z",
  scramble: "R U F2",
  scrambleGrip: { up: "white", front: "green" },
  scrambleProvenance: { id: "test", version: "1", method: "random-state" },
};

test("overlapping whole snapshots are rejected explicitly, preserving the first edit", async () => {
  const f = fixture();
  await f.session.open();
  f.pause();
  const first = backup();
  first.solves.push(completed);
  const saving = f.writer.commit(first);
  assert.equal(f.writer.pending, true);
  const second = backup();
  second.cubeCollection.cubes.push({
    id: "cube",
    name: "2",
    description: "",
    puzzleId: "2x2",
  });
  await assert.rejects(f.writer.commit(second), /still in progress/);
  f.resume();
  await saving;
  assert.equal(f.writer.pending, false);
  assert.deepEqual(f.session.inspect().payload.solves, [completed]);
  // A retry must begin with the committed snapshot, preserving the first edit.
  const retry = f.session.inspect().payload;
  retry.cubeCollection = second.cubeCollection;
  await f.writer.commit(retry);
  assert.equal(f.session.inspect().payload.solves.length, 1);
  assert.equal(f.session.inspect().payload.cubeCollection.cubes.length, 1);
});
test("a finished solve remains in the caller's draft after quota failure", async () => {
  const f = fixture();
  await f.session.open();
  const original = f.bytes.get(TRAINING_V2_KEY);
  const draft = backup();
  draft.solves.push(completed);
  f.fail();
  await assert.rejects(f.writer.commit(draft), /Quota/);
  assert.deepEqual(draft.solves, [completed]);
  assert.equal(f.bytes.get(TRAINING_V2_KEY), original);
  assert.equal(f.writer.pending, false);
});
test("changing account while waiting for the lock cancels the old queued commit", async () => {
  const f = fixture();
  await f.session.open();
  const original = f.bytes.get(TRAINING_V2_KEY);
  f.pause();
  const draft = backup();
  draft.solves.push(completed);
  const pending = f.writer.commit(draft);
  f.leave();
  f.resume();
  await assert.rejects(pending, { code: "TRAINING_SCOPE_CLOSED" });
  assert.equal(f.bytes.get(TRAINING_V2_KEY), original);
});
test("an old-tab write while waiting rejects the transaction without changing its draft", async () => {
  const f = fixture();
  await f.session.open();
  const original = f.bytes.get(TRAINING_V2_KEY);
  f.pause();
  const draft = backup();
  draft.solves.push(completed);
  const pending = f.writer.commit(draft);
  f.bytes.set("last-layer.solves.v1", "[]");
  f.resume();
  await assert.rejects(pending, /older tab/);
  assert.equal(f.bytes.get(TRAINING_V2_KEY), original);
  assert.deepEqual(draft.solves, [completed]);
});
test("a committed old-scope result cannot be published after the scope changed", async () => {
  let current = true;
  const writer = createTrainingV2Writer({
    session: {
      async commit(value) {
        current = false;
        return value;
      },
    },
    isCurrent: () => current,
  });
  await assert.rejects(writer.commit(backup()), /source changed/);
});
