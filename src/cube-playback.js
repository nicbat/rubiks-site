import { applyAlg, tokens } from "./cube.js";

// One bounded timeline per mounted player. Caller owns time and scheduling.
export function createCubePlayback(
  initial,
  algorithm,
  { loop = false, autoplay = false, holdMs = 450 } = {},
) {
  if (!Number.isFinite(holdMs) || holdMs < 0)
    throw new Error("Invalid move hold duration");
  const turnMs = 650,
    cycleMs = turnMs + holdMs;
  const moves = tokens(algorithm);
  const startingCube = applyAlg(initial, "");
  const timeline = (cube) => {
    const result = [cube];
    for (const move of moves) result.push(applyAlg(result.at(-1), move));
    return result;
  };
  let states = timeline(startingCube),
    cycle = 0;
  let index = 0,
    elapsed = 0,
    playing = autoplay && moves.length > 0;
  return {
    moves,
    snapshot({ includeCube = true } = {}) {
      return {
        index,
        cycle,
        playing,
        ...(includeCube ? { cube: applyAlg(states[index], "") } : {}),
        move: moves[index],
        fraction: Math.min(elapsed / turnMs, 1),
      };
    },
    toggle() {
      if (!moves.length) return;
      if (index === moves.length) index = 0;
      playing = !playing;
    },
    pause() {
      playing = false;
    },
    reset() {
      states = timeline(startingCube);
      cycle++;
      index = 0;
      elapsed = 0;
      playing = false;
    },
    seek(next) {
      index = Math.max(0, Math.min(moves.length, next));
      elapsed = 0;
      playing = false;
    },
    // Continuous position in moves: the whole part is the move index and the
    // fractional part is how far that move has turned.
    position() {
      return index + Math.min(elapsed / turnMs, 1);
    },
    scrub(position) {
      if (!Number.isFinite(position)) return;
      const clamped = Math.max(0, Math.min(moves.length, position));
      index = Math.floor(clamped);
      elapsed = index === moves.length ? 0 : (clamped - index) * turnMs;
      playing = false;
    },
    tick(delta) {
      if (!playing || delta < 0 || !Number.isFinite(delta)) return;
      elapsed += delta;
      while (elapsed >= cycleMs && playing) {
        elapsed -= cycleMs;
        index++;
        if (index === moves.length) {
          if (loop) {
            states = timeline(states.at(-1));
            cycle++;
            index = 0;
          } else {
            playing = false;
            elapsed = 0;
          }
        }
      }
    },
  };
}
