import { createScrambleSession } from "./scramble-session.js";

// Additive event-aware timer boundary. The production timer remains separate
// until persistence, previews, and real generation providers support every event.
export function createEventSolveTimer({
  generateScramble,
  eventId = "333",
  now = () => performance.now(),
}) {
  const session = createScrambleSession({ generateScramble, eventId });
  let phase = null;
  let started = 0;
  let solve = null;
  let disposed = false;

  const requireLive = () => {
    if (disposed) throw new Error("Event timer has been disposed.");
  };
  const readClock = () => {
    const value = now();
    if (!Number.isFinite(value)) throw new Error("Invalid timer clock value.");
    return value;
  };
  const requireNotRunning = () => {
    requireLive();
    if (phase === "running")
      throw new Error("Stop the timer before changing the scramble.");
  };
  const clearRun = () => {
    phase = null;
    started = 0;
    solve = null;
  };
  const prepare = async (options = {}) => {
    requireNotRunning();
    // Validate the selection before discarding a completed result.
    session.invalidate(options);
    clearRun();
    return session.request();
  };

  return {
    snapshot() {
      const state = session.snapshot();
      return Object.freeze({
        status: phase ?? state.status,
        eventId: solve?.eventId ?? state.eventId,
        scramble: solve?.scramble ?? state.result?.algorithm ?? null,
        scrambleGrip: solve?.scrambleGrip ?? state.result?.grip ?? null,
        scrambleProvenance:
          solve?.scrambleProvenance ?? state.result?.generator ?? null,
        elapsed:
          phase === "running"
            ? Math.max(0, readClock() - started)
            : (solve?.elapsed ?? 0),
        solve,
        error: state.error,
      });
    },
    prepare,
    setEvent(eventId) {
      return prepare({ eventId });
    },
    start() {
      requireLive();
      if (phase !== null)
        throw new Error("Prepare a new scramble before starting.");
      // An invalid clock must not consume a valid ready scramble.
      const timestamp = readClock();
      solve = session.beginSolve();
      started = timestamp;
      phase = "running";
      return solve;
    },
    stop() {
      requireLive();
      if (phase === "stopped") return solve;
      if (phase !== "running") throw new Error("The timer is not running.");
      solve = Object.freeze({
        ...solve,
        elapsed: Math.max(0, readClock() - started),
      });
      phase = "stopped";
      return solve;
    },
    // Explicit account/import/session boundary: cancels even an active run.
    // A fresh provider request is required before the next start.
    reset(options = {}) {
      requireLive();
      session.invalidate(options);
      clearRun();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      session.destroy();
      clearRun();
    },
  };
}
