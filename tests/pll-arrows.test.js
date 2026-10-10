import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caseCube, solvedCube } from "../src/cube.js";
import { pllDestinations } from "../src/pll-arrows.js";
import { diagram } from "../src/diagram.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const cubeFor = (id) =>
  caseCube(catalog.find((c) => c.id === id).algorithms[0].moves);
test("H perm arrows exchange opposite edges; Ua cycles three edges; T exchanges corners and edges", () => {
  const h = pllDestinations(cubeFor("pll-H"));
  assert.equal(h.length, 4);
  for (const m of h) {
    assert.equal(m.kind, "edge");
    assert.deepEqual(
      m.to,
      m.from.map((v) => (v === 0 ? 0 : -v)),
    );
  }
  const ua = pllDestinations(cubeFor("pll-Ua"));
  assert.equal(ua.length, 3);
  assert.ok(ua.every((m) => m.kind === "edge"));
  const t = pllDestinations(cubeFor("pll-T"));
  assert.equal(t.filter((m) => m.kind === "edge").length, 2);
  assert.equal(t.filter((m) => m.kind === "corner").length, 2);
  assert.deepEqual(pllDestinations(solvedCube()), []);
});
test("each PLL variant produces a bijection among displaced pieces of the same kind", () => {
  for (const c of catalog.filter((c) => c.section === "PLL"))
    for (const a of c.algorithms) {
      const moves = pllDestinations(caseCube(a.moves));
      assert.deepEqual(
        moves.map((m) => m.from.join(",")).sort(),
        moves.map((m) => m.to.join(",")).sort(),
        `${c.id}: ${a.moves}`,
      );
      assert.ok(
        moves.every(
          (m) => m.from.filter(Boolean).length === m.to.filter(Boolean).length,
        ),
      );
    }
});
test("arrows are opt-in, PLL-only, and accessible diagram labels are escaped", () => {
  const c = cubeFor("pll-T");
  assert.ok(!diagram(c, "PLL").includes('class="pll-arrows"'));
  assert.ok(
    diagram(c, "PLL", "T", { arrows: true }).includes('class="pll-arrows"'),
  );
  assert.ok(
    !diagram(c, "OLL", "T", { arrows: true }).includes('class="pll-arrows"'),
  );
  assert.ok(diagram(c, "PLL", '"<x>').includes("&quot;&lt;x&gt;"));
});

test("Z arrows ignore algorithm AUF and show only the four displaced edges", () => {
  for (const a of catalog.find((c) => c.id === "pll-Z").algorithms) {
    const moves = pllDestinations(caseCube(a.moves));
    assert.equal(moves.length, 4);
    assert.ok(moves.every((m) => m.kind === "edge"));
  }
});

// Independent fixtures place solved cubies at explicit top-layer positions.
// No algorithm parser or production destination calculation constructs these.
function permutationFixture(cycles) {
  const source = solvedCube();
  const moves = cycles.flatMap((cycle) =>
    cycle.map((from, i) => ({
      from,
      to: cycle[(i + 1) % cycle.length],
      kind: from.every(Boolean) ? "corner" : "edge",
    })),
  );
  const cube = source.map((sticker) => {
    if (sticker.p[1] !== 1) return structuredClone(sticker);
    const movement = moves.find(
      (m) => m.to[0] === sticker.p[0] && m.to[1] === sticker.p[2],
    );
    if (!movement) return structuredClone(sticker);
    // Rotate the entire cubie about U until its new slot matches.
    let p = [...sticker.p],
      n = [...sticker.n];
    for (let i = 0; i < 4; i++) {
      if (p[0] === movement.from[0] && p[2] === movement.from[1]) break;
      p = [-p[2], p[1], p[0]];
      n = [-n[2], n[1], n[0]];
    }
    return { ...sticker, p, n };
  });
  return { cube, moves };
}
const sortMoves = (moves) =>
  moves.map((m) => `${m.kind}:${m.from}:${m.to}`).sort();

test("PLL destinations recover exact directed independent edge and corner permutations", () => {
  const front = [0, 1],
    right = [1, 0],
    back = [0, -1],
    left = [-1, 0];
  const fr = [1, 1],
    br = [1, -1],
    bl = [-1, -1],
    fl = [-1, 1];
  for (const [name, cycles] of [
    [
      "H",
      [
        [front, back],
        [left, right],
      ],
    ],
    [
      "Z",
      [
        [front, right],
        [back, left],
      ],
    ],
    ["Ua", [[front, right, left]]],
    ["Ub", [[front, left, right]]],
    ["A", [[fr, br, bl]]],
    [
      "T",
      [
        [fr, br],
        [right, left],
      ],
    ],
    [
      "E",
      [
        [fr, br],
        [fl, bl],
      ],
    ],
  ]) {
    const { cube, moves } = permutationFixture(cycles);
    assert.deepEqual(sortMoves(pllDestinations(cube)), sortMoves(moves), name);
  }
});
