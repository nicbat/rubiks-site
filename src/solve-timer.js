import { randomIndex } from "./practice.js";

// Random face turns, not a competition random-state scramble. Changing axis
// prevents adjacent cancellations and commuting runs such as R L R'.
export function generateScramble(pick = randomIndex, length = 20) {
  if (!Number.isInteger(length) || length < 1 || length > 100)
    throw new RangeError("Scramble length must be between 1 and 100");
  const axes = ["UD", "RL", "FB"];
  const suffixes = ["", "'", "2"];
  let previous = -1;
  return Array.from({ length }, () => {
    const options = axes.map((_, i) => i).filter((i) => i !== previous);
    const axis = options[pick(options.length)];
    previous = axis;
    return axes[axis][pick(2)] + suffixes[pick(3)];
  }).join(" ");
}

export function formatElapsed(milliseconds, minutes = true) {
  const hundredths = Math.floor(Math.max(0, milliseconds) / 10);
  const seconds = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, "0");
  return minutes
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.${fraction}`
    : `${String(seconds).padStart(2, "0")}.${fraction}`;
}

export function shouldHandleTimerKey({
  code,
  repeat = false,
  isComposing = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  interactive = false,
  shiftKey = false,
  status,
}) {
  return (
    (code === "Space" ||
      code === "Backspace" ||
      (code === "Tab" &&
        (status === "ready" || status === "stopped") &&
        !shiftKey)) &&
    !repeat &&
    !isComposing &&
    !altKey &&
    !ctrlKey &&
    !metaKey &&
    !interactive
  );
}

export function createSolveTimer({
  now = () => performance.now(),
  pick = randomIndex,
} = {}) {
  let status = "ready";
  let scramble = generateScramble(pick);
  let started = 0;
  let elapsed = 0;
  const snapshot = () => ({
    status,
    scramble,
    elapsed: status === "running" ? Math.max(0, now() - started) : elapsed,
  });
  const stop = () => {
    if (status !== "running") return;
    elapsed = Math.max(0, now() - started);
    status = "stopped";
  };
  const newScramble = () => {
    if (status === "running") return;
    scramble = generateScramble(pick);
    elapsed = 0;
    status = "ready";
  };
  return {
    snapshot,
    clear() {
      if (status !== "running") {
        elapsed = 0;
        status = "ready";
      }
    },
    stop,
    newScramble,
    advance() {
      if (status === "running") stop();
      else if (status === "stopped") newScramble();
      else {
        started = now();
        elapsed = 0;
        status = "running";
      }
    },
  };
}

export function createTimerHold({
  now = () => performance.now(),
  delay = 500,
} = {}) {
  let started = null;
  return {
    begin() {
      if (started === null) started = now();
    },
    cancel() {
      started = null;
    },
    snapshot() {
      return started === null
        ? "idle"
        : now() - started >= delay
          ? "armed"
          : "holding";
    },
    release() {
      const ready = started !== null && now() - started >= delay;
      started = null;
      return ready;
    },
  };
}
