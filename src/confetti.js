// Confetti that bursts out of both sides of a box: each piece flies outward
// and up, then falls, spinning. Pieces are whole pixels in sticker and brand
// colors. Seeded, so the same options always give the same burst.

import { seededRandom } from "./seeded-random.js";

// CSS custom properties naming each piece's color.
export const confettiColors = [
  "--cube-red",
  "--cube-orange",
  "--cube-yellow",
  "--cube-green",
  "--cube-blue",
  "--cube-white",
  "--brand-top",
  "--brand-bottom",
];

// Distances in px and times in s. side is -1 for the left edge, 1 for the
// right; dx is how far outward the piece travels, never back inward.
export function confettiBurst({ perSide, seed }) {
  const rand = seededRandom(seed);
  const between = (low, high) => Math.round(low + rand() * (high - low));
  return [-1, 1].flatMap((side) =>
    Array.from({ length: perSide }, () => ({
      side,
      dx: between(16, 110),
      rise: -between(20, 70),
      fall: between(90, 190),
      spin: between(180, 720) * (rand() < 0.5 ? -1 : 1),
      delay: Math.round(rand() * 120) / 1000,
      width: rand() < 0.5 ? 4 : 6,
      height: rand() < 0.5 ? 6 : 8,
      color: confettiColors[Math.floor(rand() * confettiColors.length)],
    })),
  );
}

export const timerConfetti = confettiBurst({ perSide: 14, seed: 0xc0ffe7 });
