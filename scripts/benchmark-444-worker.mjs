// Node worker-thread qualification, deliberately separate from browser/runtime routes.
// Default four requests: cold, warm, cancelled after entropy starts, fresh-worker retry.
import assert from "node:assert/strict";
import os from "node:os";
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import {
  sampleFourByFourState,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "../tests/helpers/nxn-oracle.js";
const count = Number(process.argv[2] || 4);
if (!Number.isInteger(count) || count < 4 || count > 64)
  throw new TypeError(
    "Use a total request count from 4 to 64 (including one cancellation).",
  );
const baseSeed = 0x444c0de;
const timeoutMs = 120000;
const rows = [],
  activeWorkers = new Set();
const seeded = (seed) => () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
};
async function launch() {
  const start = performance.now();
  const worker = new Worker(
    new URL("./helpers/444-worker-qualification.mjs", import.meta.url),
  );
  activeWorkers.add(worker);
  worker.once("exit", () => activeWorkers.delete(worker));
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(new Error("Worker startup timeout")),
      timeoutMs,
    );
    const onError = (error) => finish(error);
    const onExit = (code) =>
      finish(new Error(`Worker exited during startup (${code})`));
    const onMessage = (message) => {
      if (message.type === "ready") finish(null, message);
    };
    function finish(error, result) {
      clearTimeout(timeout);
      worker.off("error", onError);
      worker.off("exit", onExit);
      worker.off("message", onMessage);
      if (error) reject(error);
      else resolve(result);
    }
    worker.on("error", onError);
    worker.on("exit", onExit);
    worker.on("message", onMessage);
  });
  return {
    worker,
    startupMs: performance.now() - start,
    readyMemory: ready.memory,
  };
}
async function request(instance, id, seed, cancel = false) {
  const { worker } = instance,
    start = performance.now();
  const samples = [],
    notifications = [];
  return await new Promise((resolve, reject) => {
    let terminating = false,
      completed = false,
      entropyMs;
    const timeout = setTimeout(
      () => finish(new Error("Worker request timeout")),
      timeoutMs,
    );
    const onError = (error) => finish(error);
    const onExit = (code) => {
      if (!terminating) finish(new Error(`Unexpected worker exit (${code})`));
    };
    const onMessage = (message) => {
      if (message.id !== id) return;
      notifications.push(message.type);
      if (message.memory) samples.push({ at: message.type, ...message.memory });
      if (message.type === "entropy-start") {
        entropyMs = performance.now() - start;
        if (cancel) {
          terminating = true;
          const terminationStart = performance.now();
          worker.terminate().then((exitCode) => {
            if (completed)
              return finish(
                new Error("Cancellation raced with completed generation"),
              );
            finish(null, {
              status: "cancelled",
              id,
              seed,
              elapsedMs: performance.now() - start,
              entropyStartedMs: entropyMs,
              terminationMs: performance.now() - terminationStart,
              exitCode,
              notifications,
              workerMemorySamples: samples,
            });
          }, finish);
        }
      } else if (message.type === "result" || message.type === "failure") {
        completed = true;
        if (cancel)
          return finish(
            new Error("Cancelled request completed before termination"),
          );
        finish(null, {
          status: message.type === "result" ? "completed" : "failed",
          id,
          seed,
          elapsedMs: performance.now() - start,
          entropyStartedMs: entropyMs,
          notifications,
          workerMemorySamples: samples,
          ...message,
        });
      }
    };
    function finish(error, result) {
      clearTimeout(timeout);
      worker.off("error", onError);
      worker.off("exit", onExit);
      worker.off("message", onMessage);
      if (error) reject(error);
      else resolve(result);
    }
    worker.on("error", onError);
    worker.on("exit", onExit);
    worker.on("message", onMessage);
    worker.postMessage({ id, seed });
  });
}
function verify(row) {
  if (row.status !== "completed") return;
  const expected = sampleFourByFourState({ randomUint32: seeded(row.seed) });
  assert.deepEqual(
    row.result.target,
    expected,
    "Fixture must retain its original sampled target",
  );
  assertNxNOracle(fourByFourStateToFacelets(expected), row.result.algorithm, 4);
  row.oracle = "exact 96 stickers";
  row.moves = row.result.algorithm.split(/\s+/).filter(Boolean).length;
  delete row.result;
}
try {
  let instance = await launch();
  for (let i = 0; i < count - 2; i++) {
    const row = await request(instance, i, (baseSeed + i) >>> 0);
    row.temperature = i === 0 ? "cold" : "warm";
    if (i === 0) {
      row.startupMs = instance.startupMs;
      row.readyMemory = instance.readyMemory;
    }
    verify(row);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const cancelSeed = (baseSeed + count - 2) >>> 0;
  const cancelled = await request(instance, count - 2, cancelSeed, true);
  rows.push(cancelled);
  console.log(JSON.stringify(cancelled));
  instance = await launch();
  const retry = await request(instance, count - 1, cancelSeed);
  retry.temperature = "fresh-worker retry of cancelled target";
  retry.startupMs = instance.startupMs;
  retry.readyMemory = instance.readyMemory;
  verify(retry);
  rows.push(retry);
  console.log(JSON.stringify(retry));
  assert.equal(
    retry.status,
    "completed",
    "Fresh-worker generation must succeed after cancellation",
  );
  if (rows.some((row) => row.status === "failed")) process.exitCode = 1;
} finally {
  await Promise.all([...activeWorkers].map((worker) => worker.terminate()));
}
console.log(
  JSON.stringify(
    {
      environment: {
        node: process.version,
        cpu: os.cpus()[0].model,
        platform: process.platform,
        arch: process.arch,
      },
      seed: "0x444c0de + request index; cancelled target reused for retry",
      requests: count,
      completed: rows.filter((r) => r.status === "completed").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      failed: rows.filter((r) => r.status === "failed").length,
      peakWholeProcessRssBytes: process.resourceUsage().maxRSS * 1024,
      scope:
        "Node worker_threads only, not browser/worker performance proof. Request elapsed time runs from parent postMessage to result receipt; startup separately measures construction through ready. Oracle runs afterward in parent. Worker heap/external/arrayBuffers are current samples, not peaks. RSS includes parent, all workers and oracle; never worker-only. Cancellation begins on first entropy-call notification, proving generator began but not identifying a solver phase. Failed targets are reported, never resampled.",
    },
    null,
    2,
  ),
);
