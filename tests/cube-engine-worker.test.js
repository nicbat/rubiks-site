import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { createScrambleProvider } from "../packages/cube-engine/worker/index.js";
import { createWorkerMessageHandler } from "../packages/cube-engine/worker/entry.js";
import { puzzles } from "cubing/puzzles";

const result = () => ({
  eventId: "222",
  puzzleId: "2x2",
  algorithm: "R U F R",
  generator: { id: "test", version: "1", method: "random-state" },
  grip: { up: "white", front: "green" },
});
class MockWorker extends EventTarget {
  messages = [];
  terminated = 0;
  listeners = 0;
  addEventListener(...args) {
    this.listeners++;
    super.addEventListener(...args);
  }
  removeEventListener(...args) {
    this.listeners--;
    super.removeEventListener(...args);
  }
  postMessage(message) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated++;
  }
  send(data) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}
function setup() {
  const workers = [];
  const provider = createScrambleProvider({
    createWorker: () => {
      const worker = new MockWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { workers, provider };
}

test("provider starts lazily, retains a warm worker and sends only bounded protocol data", async () => {
  const { workers, provider } = setup();
  assert.equal(workers.length, 0);
  const first = provider.generateScramble({
    eventId: "222",
    randomUint32: () => 123,
  });
  assert.equal(workers.length, 1);
  assert.deepEqual(workers[0].messages, [
    { type: "generate", id: 1, eventId: "222" },
  ]);
  workers[0].send({ type: "result", id: 1, result: result() });
  assert.deepEqual(await first, result());
  const second = provider.generateScramble({ eventId: "222" });
  assert.equal(workers.length, 1);
  workers[0].send({ type: "result", id: 2, result: result() });
  await second;
  provider.destroy();
  provider.destroy();
  assert.equal(workers[0].listeners, 0);
  assert.equal(workers[0].terminated, 1);
  await assert.rejects(provider.generateScramble({ eventId: "222" }), {
    code: "GENERATION_FAILED",
  });
});

test("unsupported, invalid and already aborted requests never construct a worker", async () => {
  const { workers, provider } = setup();
  for (const request of [null, {}, { eventId: "333" }, { eventId: "unknown" }])
    await assert.rejects(provider.generateScramble(request), {
      code: "UNSUPPORTED_EVENT",
    });
  await assert.rejects(
    provider.generateScramble({ eventId: "222", signal: {} }),
    { code: "GENERATION_FAILED" },
  );
  await assert.rejects(
    provider.generateScramble({ eventId: "222", signal: AbortSignal.abort() }),
    { code: "ABORTED", name: "AbortError" },
  );
  assert.equal(workers.length, 0);
  provider.destroy();
});

test("one pending request bounds work, abort clears listeners and stale workers cannot publish", async () => {
  const { workers, provider } = setup(),
    controller = new AbortController();
  const first = provider.generateScramble({
    eventId: "222",
    signal: controller.signal,
  });
  await assert.rejects(provider.generateScramble({ eventId: "222" }), {
    code: "GENERATION_FAILED",
  });
  assert.equal(workers[0].messages.length, 1);
  controller.abort();
  await assert.rejects(first, { code: "ABORTED" });
  assert.equal(workers[0].listeners, 0);
  assert.equal(workers[0].terminated, 1);
  const second = provider.generateScramble({ eventId: "222" });
  workers[0].send({
    type: "result",
    id: 1,
    result: { ...result(), algorithm: "BAD" },
  });
  workers[1].send({
    type: "result",
    id: 1,
    result: { ...result(), algorithm: "BAD" },
  });
  workers[1].send({ type: "result", id: 2, result: result() });
  assert.deepEqual(await second, result());
  provider.destroy();
});

test("crash, message decode failures and malformed results fail closed and allow an explicit retry", async () => {
  for (const action of [
    (worker) => worker.dispatchEvent(new Event("error")),
    (worker) => worker.dispatchEvent(new Event("messageerror")),
    (worker) =>
      worker.send({
        id: 1,
        type: "result",
        result: { ...result(), eventId: "333" },
      }),
    (worker) =>
      worker.send({
        id: 1,
        type: "result",
        result: { ...result(), algorithm: "Rw" },
      }),
    (worker) => worker.send({ id: 1, type: "error", code: "UNKNOWN" }),
    (worker) => worker.send({ type: "result" }),
  ]) {
    const { workers, provider } = setup();
    const first = provider.generateScramble({ eventId: "222" });
    action(workers[0]);
    await assert.rejects(first, { code: "GENERATION_FAILED" });
    assert.equal(workers[0].listeners, 0);
    assert.equal(workers[0].terminated, 1);
    const retry = provider.generateScramble({ eventId: "222" });
    workers[1].send({ id: 2, type: "result", result: result() });
    await retry;
    provider.destroy();
  }
});

test("construction/send failures and destruction settle outstanding promises", async () => {
  for (const createWorker of [
    () => {
      throw new Error("constructor failure");
    },
    () => ({}),
    () => {
      const worker = new MockWorker();
      worker.postMessage = () => {
        throw new Error("clone failure");
      };
      return worker;
    },
  ]) {
    const provider = createScrambleProvider({ createWorker });
    await assert.rejects(provider.generateScramble({ eventId: "222" }), {
      code: "GENERATION_FAILED",
    });
    provider.destroy();
  }
  const { workers, provider } = setup();
  const pending = provider.generateScramble({ eventId: "222" });
  provider.destroy();
  await assert.rejects(pending, { code: "ABORTED" });
  assert.equal(workers[0].listeners, 0);
});

test("worker-reported generation errors propagate with stable codes", async () => {
  const { workers, provider } = setup();
  const pending = provider.generateScramble({ eventId: "222" });
  workers[0].send({ id: 1, type: "error", code: "GENERATION_FAILED" });
  await assert.rejects(pending, { code: "GENERATION_FAILED" });
  provider.destroy();
});

test("worker entry rejects external entropy and maps real generator results", async (t) => {
  t.mock.method(globalThis.crypto, "getRandomValues", (buffer) => {
    buffer[0] = 123456;
    return buffer;
  });
  const messages = [];
  const handler = createWorkerMessageHandler((message) =>
    messages.push(message),
  );
  await handler({ data: { type: "generate", id: 1, eventId: "333" } });
  await handler({
    data: { type: "generate", id: 2, eventId: "222", randomUint32: 123 },
  });
  const pending = handler({
    data: { type: "generate", id: 3, eventId: "222" },
  });
  await handler({ data: { type: "generate", id: 4, eventId: "222" } });
  await pending;
  assert.deepEqual(messages.slice(0, 3), [
    { type: "error", id: 1, code: "UNSUPPORTED_EVENT" },
    { type: "error", id: 2, code: "GENERATION_FAILED" },
    { type: "error", id: 4, code: "GENERATION_FAILED" },
  ]);
  const response = messages[3];
  assert.equal(response.id, 3);
  assert.equal(response.type, "result");
  assert.deepEqual(response.result.grip, { up: "white", front: "green" });
  assert.deepEqual(response.result.generator, {
    id: "last-layer-222-fixed-dbl",
    version: "1",
    method: "random-state",
  });
  assert.equal(response.result.eventId, "222");
  assert.equal(response.result.puzzleId, "2x2");
  const puzzle = await puzzles["2x2x2"].kpuzzle();
  assert.deepEqual(
    puzzle.defaultPattern().applyAlg(response.result.algorithm).patternData
      .CORNERS,
    { pieces: [0, 2, 4, 1, 3, 7, 6, 5], orientation: [1, 0, 0, 1, 1, 0, 0, 0] },
  );
});

test("provider build keeps solver and renderer out of the main module graph", async () => {
  const built = await build({
    configFile: false,
    worker: { format: "es" },
    logLevel: "silent",
    build: {
      write: false,
      rollupOptions: {
        input: fileURLToPath(
          new URL("../packages/cube-engine/worker/index.js", import.meta.url),
        ),
        preserveEntrySignatures: "strict",
      },
    },
  });
  const entry = built.output.find(
    (item) => item.type === "chunk" && item.isEntry,
  );
  assert.ok(entry);
  for (const path of Object.keys(entry.modules))
    assert.ok(!/two-by-two|renderer|cubing\//.test(path), path);
  assert.ok(
    built.output.some(
      (item) => item.type === "asset" && /entry-.*\.js$/.test(item.fileName),
    ),
    "separate worker entry asset",
  );
});
