// Node-only qualification fixture. Never imported by the browser worker/provider.
import { parentPort } from "node:worker_threads";
import { generateFourByFourJoint } from "../../packages/cube-engine/scramble/four-by-four-joint-generator.js";
const memory = () => {
  const { heapUsed, heapTotal, external, arrayBuffers, rss } =
    process.memoryUsage();
  return { heapUsed, heapTotal, external, arrayBuffers, wholeProcessRss: rss };
};
let busy = false;
parentPort.on("message", async ({ id, seed }) => {
  if (busy) throw new Error("Qualification fixture accepts one active request");
  busy = true;
  parentPort.postMessage({ type: "started", id, memory: memory() });
  let state = seed >>> 0,
    draws = 0;
  const randomUint32 = () => {
    if (draws++ === 0)
      parentPort.postMessage({ type: "entropy-start", id, memory: memory() });
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  try {
    const result = await generateFourByFourJoint({ randomUint32 });
    parentPort.postMessage({
      type: "result",
      id,
      result,
      draws,
      memory: memory(),
    });
  } catch (error) {
    parentPort.postMessage({
      type: "failure",
      id,
      error: { name: error.name, message: error.message, code: error.code },
      draws,
      memory: memory(),
    });
  } finally {
    busy = false;
  }
});
parentPort.postMessage({ type: "ready", memory: memory() });
