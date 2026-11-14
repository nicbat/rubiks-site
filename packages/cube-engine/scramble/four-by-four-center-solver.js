// Original constructive center solver. Macro found by enumeration of
// [x y x^-1, z] in our own geometric model, not borrowed solver source.
import {
  FOUR_BY_FOUR_MOVES,
  fourByFourCenterMovePermutation,
  solvedFourByFourState,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { checkAbort } from "./random-source.js";
import { joinFourByFourStages } from "./four-by-four-sequence.js";
const BASE = "U Rw U' Lw U Rw' U' Lw'";
const inverseMove = (m) =>
  m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'";
const encode = (a, b, c) => (a * 24 + b) * 24 + c;
const decode = (n) => [Math.floor(n / 576), Math.floor(n / 24) % 24, n % 24];
let table;
function initialize(signal) {
  if (table) return table;
  const parent = new Int16Array(24 ** 3).fill(-1),
    move = new Uint8Array(24 ** 3),
    queue = new Uint16Array(24 * 23 * 22);
  const transforms = FOUR_BY_FOUR_MOVES.map((token) => {
    const forward = new Uint8Array(24);
    fourByFourCenterMovePermutation(token).forEach(
      (source, destination) => (forward[source] = destination),
    );
    return forward;
  });
  const root = encode(0, 17, 6);
  parent[root] = root;
  queue[0] = root;
  let tail = 1,
    maxDepth = 0;
  const depths = new Uint8Array(24 ** 3);
  for (let head = 0; head < tail; head++) {
    checkAbort(signal);
    const current = queue[head],
      triple = decode(current);
    for (let m = 0; m < transforms.length; m++) {
      const next = encode(...triple.map((i) => transforms[m][i]));
      if (parent[next] !== -1) continue;
      parent[next] = current;
      move[next] = m;
      depths[next] = depths[current] + 1;
      maxDepth = Math.max(maxDepth, depths[next]);
      queue[tail++] = next;
    }
  }
  if (tail !== 24 * 23 * 22) throw Error("Center conjugation graph incomplete");
  table = { parent, move, root, maxDepth, count: tail };
  return table;
}
function macro(a, b, c, t) {
  let index = encode(a, b, c);
  const conjugation = [];
  while (index !== t.root) {
    conjugation.push(FOUR_BY_FOUR_MOVES[t.move[index]]);
    index = t.parent[index];
  }
  conjugation.reverse();
  return [
    ...conjugation.slice().reverse().map(inverseMove),
    ...BASE.split(" "),
    ...conjugation,
  ];
}
function parity(values) {
  let result = 0;
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      if (values[i] > values[j]) result ^= 1;
  return result;
}
function compact(moves) {
  const result = [];
  for (const token of moves) {
    const face = token.replace(/[2']$/, "");
    const amount = token.endsWith("2") ? 2 : token.endsWith("'") ? 3 : 1;
    const prior = result.at(-1);
    if (prior?.face === face) {
      prior.amount = (prior.amount + amount) % 4;
      if (!prior.amount) result.pop();
    } else result.push({ face, amount });
  }
  return result.map(
    ({ face, amount }) => face + (amount === 1 ? "" : amount === 2 ? "2" : "'"),
  );
}
/** Complete center-color stage only. It may alter corners and wings.
 * No target resampling. Synchronous CPU work belongs in a worker.
 */
export function solveFourByFourCenters(state, { signal } = {}) {
  checkAbort(signal);
  const original = validateFourByFourState(state),
    solved = solvedFourByFourState();
  if (original.centerColors.every((v, i) => v === solved.centerColors[i]))
    return { algorithm: "", cycles: 0, moveCount: 0 };
  const t = initialize(signal);
  let best;
  // Fixed finite assignment portfolio, never random or target-dependent retries.
  // Reserve already-correct colors; vary only invisible labels of equal colors.
  for (let variant = -1; variant < 24; variant++) {
    checkAbort(signal);
    const fixed = original.centerColors.map(
      (v, i) => variant >= 0 && v === solved.centerColors[i],
    );
    const pools = Array.from({ length: 6 }, (_, color) =>
      solved.centerColors.flatMap((v, i) =>
        v === color && !fixed[i] ? [i] : [],
      ),
    );
    if (variant >= 0)
      for (let color = 0; color < 6; color++) {
        let rank = variant;
        const remaining = pools[color].slice(),
          ordered = [];
        while (remaining.length) {
          const choice = rank % remaining.length;
          rank = Math.floor(rank / remaining.length);
          ordered.push(remaining.splice(choice, 1)[0]);
        }
        pools[color] = ordered;
      }
    const labels = original.centerColors.map((color, i) =>
      fixed[i] ? i : pools[color].shift(),
    );
    if (parity(labels)) {
      let pair;
      for (let i = 0; i < 24; i++)
        for (let j = i + 1; j < 24; j++)
          if (original.centerColors[i] === original.centerColors[j]) {
            const loss = Number(labels[i] === i) + Number(labels[j] === j);
            if (!pair || loss < pair.loss) pair = { i, j, loss };
          }
      [labels[pair.i], labels[pair.j]] = [labels[pair.j], labels[pair.i]];
    }
    const moves = [];
    let cycles = 0;
    for (let i = 0; i < 22; i++) {
      if (labels[i] === i) continue;
      const source = labels.indexOf(i);
      let chosen;
      for (let spare = i + 1; spare < 24; spare++)
        if (spare !== source) {
          const tokens = macro(source, i, spare, t);
          const gain =
            Number(labels[i] === spare) +
            Number(labels[spare] === source) -
            Number(labels[spare] === spare);
          if (
            !chosen ||
            gain > chosen.gain ||
            (gain === chosen.gain && tokens.length < chosen.tokens.length)
          )
            chosen = { spare, tokens, gain };
          if (variant === -1) break;
        }
      const { spare, tokens } = chosen;
      moves.push(...tokens);
      [labels[i], labels[spare], labels[source]] = [
        labels[source],
        labels[i],
        labels[spare],
      ];
      cycles++;
    }
    if (labels.some((v, i) => v !== i))
      throw Error("Center sorting parity invariant failed");
    const algorithm = joinFourByFourStages([compact(moves).join(" ")]);
    const moveCount = algorithm ? algorithm.split(" ").length : 0;
    if (!best || moveCount < best.moveCount)
      best = { algorithm, cycles, moveCount };
  }
  return best;
}
export function fourByFourCenterSolverDiagnostics() {
  const t = initialize();
  return {
    conjugates: t.count,
    maxConjugationDepth: t.maxDepth,
    retainedBytes: t.parent.byteLength + t.move.byteLength,
    initializationScratchBytes: 24 * 23 * 22 * 2 + 24 ** 3 + 36 * 24,
    maxCycles: 22,
    maxUncompactedMoves: 22 * (8 + 2 * t.maxDepth),
  };
}
