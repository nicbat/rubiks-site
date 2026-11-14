import { createScrambleProvider } from "@last-layer/cube-engine/worker";
import { createEventSolveTimer } from "./event-solve-timer.js";

// Opt-in adapter for the site's existing timer actions. Construct only after
// selecting the v2 flow; this never substitutes the legacy random-move timer.
// Call newScramble() once the owning view and its changed callback are ready.
export function createTimerController({
  eventId = "333",
  provider = createScrambleProvider(),
  now,
  changed = () => {},
  canStart = () => true,
} = {}) {
  const timer = createEventSolveTimer({
    eventId,
    now,
    generateScramble: (request) => provider.generateScramble(request),
  });
  let disposed = false;
  let generation = 0;
  let startError = null;
  const notify = () => {
    if (!disposed) changed();
  };
  const requireLive = () => {
    if (disposed) throw new Error("Timer controller has been disposed.");
  };
  const prepare = async (options = {}) => {
    requireLive();
    if (timer.snapshot().status === "running") return false;
    const token = ++generation;
    startError = null;
    const pending = timer.prepare(options);
    notify();
    const accepted = await pending;
    if (!disposed && token === generation) notify();
    return accepted;
  };
  const stop = () => {
    requireLive();
    if (timer.snapshot().status !== "running") return null;
    const completed = timer.stop();
    notify();
    return completed;
  };
  return {
    snapshot() {
      const snapshot = timer.snapshot();
      return Object.freeze({
        ...snapshot,
        error: startError ?? snapshot.error,
      });
    },
    newScramble: () => prepare(),
    setEvent: (eventId) => prepare({ eventId }),
    clear: () => prepare(),
    stop,
    advance() {
      requireLive();
      const { status } = timer.snapshot();
      if (status === "running") return stop();
      if (status === "ready") {
        let ready = false;
        try {
          ready = canStart() === true;
        } catch {
          /* Preserve readiness for a safe retry. */
        }
        if (!ready) {
          startError = Object.freeze({
            code: "START_BLOCKED",
            message: "Training data is not ready to save solves.",
          });
          notify();
          return false;
        }
        startError = null;
        const started = timer.start();
        notify();
        return started;
      }
      if (["stopped", "idle", "error"].includes(status)) return prepare();
      return false;
    },
    // Account/import/session changes cancel work without recording an abandoned
    // run. The owner explicitly requests the next scramble after adopting data.
    reset(options = {}) {
      requireLive();
      timer.reset(options);
      generation++;
      startError = null;
      notify();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      generation++;
      timer.destroy();
      provider.destroy?.();
    },
  };
}
