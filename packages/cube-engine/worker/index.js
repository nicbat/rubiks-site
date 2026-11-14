import {
  createScrambleError,
  validateScrambleResult,
} from "../scramble/index.js";

// The import and provider construction are Node/SSR safe. Only the first request
// constructs a worker; solver code is never imported into this module's graph.
function browserWorker() {
  if (typeof Worker === "undefined")
    throw createScrambleError("GENERATION_FAILED", "Web Workers unavailable");
  return new Worker(new URL("./entry.js", import.meta.url), {
    type: "module",
    name: "cube-scrambler",
  });
}
export function createScrambleProvider({ createWorker = browserWorker } = {}) {
  let worker = null,
    pending = null,
    nextId = 0,
    destroyed = false;
  function detachWorker() {
    if (!worker) return;
    const old = worker;
    worker = null;
    for (const [type, listener] of [
      ["message", onMessage],
      ["error", onCrash],
      ["messageerror", onCrash],
    ]) {
      try {
        old.removeEventListener?.(type, listener);
      } catch {
        /* Continue cleanup. */
      }
    }
    try {
      old.terminate?.();
    } catch {
      /* Requests must still settle. */
    }
  }
  function finish(error, result) {
    const request = pending;
    if (!request) return;
    pending = null;
    request.signal?.removeEventListener("abort", request.abort);
    if (error) request.reject(error);
    else request.resolve(result);
  }
  function failWorker(message) {
    detachWorker();
    finish(createScrambleError("GENERATION_FAILED", message));
  }
  function onCrash(event) {
    event.preventDefault?.();
    failWorker("Scramble worker failed");
  }
  function onMessage({ data }) {
    if (!pending) return;
    if (!Number.isSafeInteger(data?.id))
      return failWorker("Invalid scramble worker response");
    if (data.id !== pending.id) return;
    if (data.type === "error") {
      if (
        !["UNSUPPORTED_EVENT", "GENERATION_FAILED", "ABORTED"].includes(
          data.code,
        )
      )
        return failWorker("Invalid scramble worker error");
      finish(createScrambleError(data.code));
      return;
    }
    if (data.type !== "result")
      return failWorker("Invalid scramble worker response");
    try {
      const result = validateScrambleResult(data.result, "222");
      finish(null, result);
    } catch {
      failWorker("Invalid scramble worker result");
    }
  }
  return {
    async generateScramble(request) {
      if (destroyed)
        throw createScrambleError(
          "GENERATION_FAILED",
          "Scramble provider destroyed",
        );
      if (request?.eventId !== "222")
        throw createScrambleError("UNSUPPORTED_EVENT");
      const { signal } = request;
      if (
        signal !== undefined &&
        (!signal ||
          typeof signal.aborted !== "boolean" ||
          typeof signal.addEventListener !== "function" ||
          typeof signal.removeEventListener !== "function")
      )
        throw createScrambleError("GENERATION_FAILED", "Invalid abort signal");
      if (signal?.aborted) throw createScrambleError("ABORTED");
      if (pending)
        throw createScrambleError(
          "GENERATION_FAILED",
          "Scramble generation already in progress",
        );
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const abort = () => {
          // Termination bounds work even if the generator has not observed its
          // cancellation yet. A later explicit request lazily starts afresh.
          detachWorker();
          finish(createScrambleError("ABORTED"));
        };
        pending = { id, resolve, reject, signal, abort };
        try {
          signal?.addEventListener("abort", abort, { once: true });
          if (!worker) {
            worker = createWorker();
            if (
              !worker ||
              [
                "postMessage",
                "addEventListener",
                "removeEventListener",
                "terminate",
              ].some((key) => typeof worker[key] !== "function")
            )
              throw new Error("Invalid worker");
            worker.addEventListener("message", onMessage);
            worker.addEventListener("error", onCrash);
            worker.addEventListener("messageerror", onCrash);
          }
          worker.postMessage({ type: "generate", id, eventId: "222" });
        } catch {
          failWorker("Could not start scramble worker");
        }
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      detachWorker();
      finish(createScrambleError("ABORTED"));
    },
  };
}
