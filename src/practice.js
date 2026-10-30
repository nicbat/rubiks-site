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

// Face maps for conjugation by identity, x, x2, x', z, z'.
// Remap the entire setup, including AUF, so the case can occupy any face.
const layerMaps = ["URFDLB", "FRDBLU", "DRBULF", "BRUFLD", "LUFRDB", "RDFLUB"];
export function orientSetup(setup, face) {
  if (!Number.isInteger(face) || !layerMaps[face])
    throw new RangeError("Last-layer choice must be from 0 to 5");
  return tokens(setup)
    .map((move) => {
      if (!/^[URFDLB](2|'|2')?$/.test(move))
        throw new Error("Practice setups must contain face turns only");
      return layerMaps[face]["URFDLB".indexOf(move[0])] + move.slice(1);
    })
    .join(" ");
}

// Combine neighboring turns modulo four, including neighbors exposed by a
// cancellation. Run after AUF selection so the final adjustment combines too.
function simplifySetup(setup) {
  const moves = [];
  for (const move of tokens(setup)) {
    if (!/^[URFDLB](2|'|2')?$/.test(move))
      throw new Error("Practice setups must contain face turns only");
    const face = move[0];
    let turns = move.includes("2") ? 2 : move.endsWith("'") ? 3 : 1;
    if (moves.at(-1)?.face === face) turns = (moves.pop().turns + turns) % 4;
    if (turns) moves.push({ face, turns });
  }
  return moves
    .map(({ face, turns }) => face + ["", "", "2", "'"][turns])
    .join(" ");
}

export function generateSetup(
  c,
  { randomLastLayer = false } = {},
  pick = randomIndex,
) {
  const setup = c.setups[pick(c.setups.length)];
  const auf = ["", "U", "U'", "U2"][pick(4)];
  const rotated = randomLastLayer ? rotateSetup(setup, pick(4)) : setup;
  const adjusted = simplifySetup(`${rotated} ${auf}`);
  return randomLastLayer ? orientSetup(adjusted, pick(6)) : adjusted;
}

// Sample the remaining cases directly, with no retry loop or altered session pool.
export function choosePracticeCase(pool, previousId, choose = randomIndex) {
  const choices =
    pool.length > 1 ? pool.filter((c) => c.id !== previousId) : pool;
  return choices.length ? choices[choose(choices.length)] : null;
}
