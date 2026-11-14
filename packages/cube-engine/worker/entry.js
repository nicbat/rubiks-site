import { SUPPORTED_SCRAMBLE_EVENT_IDS } from "./events.js";
// Dedicated-worker entry. Never import from the renderer or the site.
import { createScrambleError } from "../scramble/index.js";
import { getEventDefinition } from "../events/index.js";

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
      if (!SUPPORTED_SCRAMBLE_EVENT_IDS.includes(data.eventId))
        throw createScrambleError("UNSUPPORTED_EVENT");
      if (active) throw createScrambleError("GENERATION_FAILED");
    } catch (error) {
      postMessage({ type: "error", id, code: error.code });
      return;
    }
    active = true;
    try {
      let algorithm, generator;
      if (data.eventId === "222") {
        const { generateTwoByTwo, TWO_BY_TWO_GENERATOR } =
          await import("../scramble/two-by-two.js");
        ({ algorithm } = await generateTwoByTwo());
        generator = TWO_BY_TWO_GENERATOR;
      } else if (["333", "333oh"].includes(data.eventId)) {
        const { generateThreeByThree, THREE_BY_THREE_GENERATOR } =
          await import("../scramble/three-by-three.js");
        ({ algorithm } = await generateThreeByThree());
        generator = THREE_BY_THREE_GENERATOR;
      } else if (["333bf", "555bf"].includes(data.eventId)) {
        const { generateBlindfolded } =
          await import("../scramble/blindfolded.js");
        ({ algorithm, generator } = await generateBlindfolded({
          eventId: data.eventId,
        }));
      } else {
        const { generateBigCube } = await import("../scramble/big-cubes.js");
        ({ algorithm, generator } = await generateBigCube({
          eventId: data.eventId,
        }));
      }
      postMessage({
        type: "result",
        id,
        result: {
          eventId: data.eventId,
          puzzleId: getEventDefinition(data.eventId).puzzleId,
          algorithm,
          generator: { ...generator },
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
