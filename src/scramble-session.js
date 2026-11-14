import { isEventId } from "./cube-events.js";
import {
  createScrambleError,
  validateScrambleResult,
} from "@last-layer/cube-engine/scramble";

function requireEvent(eventId) {
  if (!isEventId(eventId))
    throw createScrambleError("UNSUPPORTED_EVENT", "Choose a supported event.");
}

function freezeResult(result) {
  return Object.freeze({
    ...result,
    generator: Object.freeze({ ...result.generator }),
    grip: Object.freeze({ ...result.grip }),
  });
}

// App lifecycle boundary, independent of DOM and the provider's worker strategy.
// invalidate() must be called when the account, imported dataset, or timer session
// changes, even if the selected event has not changed.
export function createScrambleSession({ generateScramble, eventId = "333" }) {
  if (typeof generateScramble !== "function")
    throw new TypeError("A scramble provider is required.");
  requireEvent(eventId);
  let generation = 0;
  let controller = null;
  let disposed = false;
  let state = Object.freeze({
    status: "idle",
    eventId,
    result: null,
    error: null,
  });

  const publish = (status, result = null, error = null) => {
    state = Object.freeze({ status, eventId, result, error });
  };
  const requireLive = () => {
    if (disposed) throw new Error("Scramble session has been disposed.");
  };
  const cancel = () => {
    generation++;
    controller?.abort();
    controller = null;
  };

  return {
    snapshot: () => state,

    invalidate({ eventId: nextEventId = eventId } = {}) {
      requireLive();
      requireEvent(nextEventId);
      cancel();
      eventId = nextEventId;
      publish("idle");
    },

    // Failures remain visible in snapshot(). No fallback scramble is produced.
    // false also means a stale response was ignored; it never changes live state.
    async request() {
      requireLive();
      cancel();
      const token = generation;
      const requestedEvent = eventId;
      controller = new AbortController();
      const signal = controller.signal;
      publish("loading");
      try {
        const value = await generateScramble({
          eventId: requestedEvent,
          signal,
        });
        if (disposed || generation !== token || signal.aborted) return false;
        const result = freezeResult(
          validateScrambleResult(value, requestedEvent),
        );
        controller = null;
        publish("ready", result);
        return true;
      } catch (error) {
        if (disposed || generation !== token || signal.aborted) return false;
        controller = null;
        publish(
          "error",
          null,
          Object.freeze({
            code: [
              "UNSUPPORTED_EVENT",
              "GENERATION_FAILED",
              "ABORTED",
            ].includes(error?.code)
              ? error.code
              : "GENERATION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Scramble generation failed.",
          }),
        );
        return false;
      }
    },

    // Consume exactly once before starting the clock. The caller retains this
    // immutable value through solve completion, regardless of later UI selection.
    beginSolve() {
      requireLive();
      if (state.status !== "ready")
        throw new Error("The scramble is not ready.");
      const result = state.result;
      const solve = Object.freeze({
        eventId: result.eventId,
        scramble: result.algorithm,
        scrambleProvenance: Object.freeze({ ...result.generator }),
        scrambleGrip: Object.freeze({ ...result.grip }),
      });
      publish("consumed");
      return solve;
    },

    destroy() {
      if (disposed) return;
      disposed = true;
      cancel();
      publish("disposed");
    },
  };
}
