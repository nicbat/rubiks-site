import { tokens } from "./cube.js";

export function randomIndex(n) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 2 ** 32)
    throw new RangeError("Random choice requires 1 to 2^32 options");
  const bound = Math.floor(2 ** 32 / n) * n;
  let value;
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (value >= bound);
  return value % n;
}

// Equivalent to y^turns + setup + y^-turns, without showing rotations
// that reveal the chosen side. Setups use face turns only; yellow stays up.
export function rotateSetup(setup, turns) {
  const sides = "FRBL";
  return tokens(setup)
    .map((move) => {
      if (!/^[URFDLB](2|'|2')?$/.test(move))
        throw new Error("Practice setups must contain face turns only");
      const side = sides.indexOf(move[0]);
      return side < 0
        ? move
        : sides[(side + (turns % 4) + 4) % 4] + move.slice(1);
    })
    .join(" ");
}

export function generateSetup(
  c,
  { randomSide = false } = {},
  pick = randomIndex,
) {
  const setup = c.setups[pick(c.setups.length)];
  const auf = ["", "U", "U'", "U2"][pick(4)];
  const rotated = randomSide ? rotateSetup(setup, pick(4)) : setup;
  return `${rotated} ${auf}`.trim();
}
