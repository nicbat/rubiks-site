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

export function formatElapsed(milliseconds) {
  return (Math.floor(Math.max(0, milliseconds) / 10) / 100).toFixed(2);
}

export function shouldHandleTimerKey({
  code,
  repeat = false,
  isComposing = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  interactive = false,
}) {
  return (
    code === "Space" &&
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
