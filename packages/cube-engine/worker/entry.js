// Dedicated-worker entry. Never import from the renderer or the site.
import { createScrambleError } from "../scramble/index.js";

// Exported solely to exercise the worker protocol without browser automation.
// Generator/entropy injection is deliberately not part of this boundary.
export function createWorkerMessageHandler(postMessage) {
  let active = false;
  return async ({ data }) => {
    const id = data?.id;
    if (!Number.isSafeInteger(id) || id < 1) return;
    try {
      if (
        !data ||
        data.type !== "generate" ||
        Object.keys(data).some(
          (key) => !["type", "id", "eventId"].includes(key),
        )
      )
        throw createScrambleError("GENERATION_FAILED");
      if (data.eventId !== "222")
        throw createScrambleError("UNSUPPORTED_EVENT");
      if (active) throw createScrambleError("GENERATION_FAILED");
    } catch (error) {
      postMessage({ type: "error", id, code: error.code });
      return;
    }
    active = true;
    try {
      const { generateTwoByTwo, TWO_BY_TWO_GENERATOR } =
        await import("../scramble/two-by-two.js");
      const { algorithm } = await generateTwoByTwo();
      postMessage({
        type: "result",
        id,
        result: {
          eventId: "222",
          puzzleId: "2x2",
          algorithm,
          generator: { ...TWO_BY_TWO_GENERATOR },
          grip: { up: "white", front: "green" },
        },
      });
    } catch (error) {
      postMessage({
        type: "error",
        id,
        code: error?.code === "ABORTED" ? "ABORTED" : "GENERATION_FAILED",
      });
    } finally {
      active = false;
    }
  };
}
if (
  typeof WorkerGlobalScope !== "undefined" &&
  globalThis instanceof WorkerGlobalScope
) {
  globalThis.addEventListener(
    "message",
    createWorkerMessageHandler((message) => globalThis.postMessage(message)),
  );
}
