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

test("H arrows keep thick shafts tucked inside rounded heads just beyond piece centers", () => {
  const svg = diagram(cubeFor("pll-H"), "PLL", "H", { arrows: true });
  // Tips extend four units past the centers (42 and 96); shafts stay inside.
  assert.match(
    svg,
    /M69\.00,47\.00 L69\.00,91\.00|M69\.00,91\.00 L69\.00,47\.00/,
  );
  assert.match(
    svg,
    /M47\.00,69\.00 L91\.00,69\.00|M91\.00,69\.00 L47\.00,69\.00/,
  );
  const shafts = [
    ...svg.matchAll(
      /<path[^>]+stroke="(?:#203b50|#674495)" stroke-width="([\d.]+)"/g,
    ),
  ];
  assert.equal(shafts.length, 2);
  assert.ok(shafts.every((m) => Number(m[1]) >= 5));
  const heads = [
    ...svg.matchAll(
      /<polygon stroke="(?:#203b50|#674495)"[^>]+stroke-linejoin="round" points="([^"]+)"/g,
    ),
  ];
  assert.equal(heads.length, 4);
  assert.deepEqual(
    heads.map(([, points]) => points.split(" ")[0]).sort(),
    ["69.00,38.00", "69.00,100.00", "38.00,69.00", "100.00,69.00"].sort(),
  );
  for (const [, points] of heads) {
    const [tip, left, right] = points
      .split(" ")
      .map((p) => p.split(",").map(Number));
    assert.ok(Math.hypot(left[0] - right[0], left[1] - right[1]) >= 9);
    assert.ok(
      Math.hypot(
        tip[0] - (left[0] + right[0]) / 2,
        tip[1] - (left[1] + right[1]) / 2,
      ) >= 9,
    );
  }
});

test("two-look masks hide irrelevant cubies and arrows without leaking cached full diagrams", async () => {
  const { createCaseDiagramRenderer } = await import("../src/case-diagram.js");
  const render = createCaseDiagramRenderer(3);
  const moves = catalog.find((c) => c.id === "pll-T").algorithms[0].moves;
  const full = render(moves, "PLL", "T", { arrows: true });
  const corners = render(moves, "PLL", "T", { arrows: true, mask: "corners" });
  assert.notEqual(corners, full);
  assert.ok(corners.includes('data-kind="corner"'));
  assert.ok(!corners.includes('data-kind="edge"'));
  assert.match(
    corners,
    /<rect x="57" y="30"[^>]+fill="var\(--diagram-muted, #c8d2dc\)"/,
  );
  assert.match(corners, /<rect x="30" y="30"[^>]+fill="#ffd84a"/);
  const edges = render(moves, "OLL", "T", { mask: "edges" });
  assert.match(
    edges,
    /<rect x="30" y="30"[^>]+fill="var\(--diagram-muted, #c8d2dc\)"/,
  );
  assert.match(edges, /<rect x="57" y="30"[^>]+fill="#ffd84a"/);
  assert.equal(render(moves, "PLL", "T", { arrows: true }), full);
});

function assertThreeCycles(moves, context) {
  for (const kind of ["corner", "edge"]) {
    const cycle = moves.filter((m) => m.kind === kind);
    assert.equal(cycle.length, 3, `${context}: three ${kind}s`);
    let position = cycle[0].from;
    const visited = new Set();
    for (let step = 0; step < 3; step++) {
      visited.add(position.join(","));
      position = cycle.find((m) =>
        m.from.every((v, i) => v === position[i]),
      ).to;
    }
    assert.equal(visited.size, 3, `${context}: one directed ${kind} cycle`);
    assert.deepEqual(position, cycle[0].from);
  }
}

test("every G-perm variant shows a corner triangle and an edge triangle for every AUF", async () => {
  const { applyAlg } = await import("../src/cube.js");
  for (const c of catalog.filter((c) => /^pll-G[abcd]$/.test(c.id))) {
    for (const a of c.algorithms) {
      for (const auf of ["", "U", "U2", "U'"]) {
        const cube = applyAlg(caseCube(a.moves), auf);
        const actual = pllDestinations(cube);
        assertThreeCycles(actual, `${c.id}: ${a.label} ${auf}`);
        const turns = ["", "U", "U2", "U'"].indexOf(auf);
        const rotate = (point) => {
          let [x, z] = point;
          for (let i = 0; i < turns; i++) [x, z] = [-z, x];
          return [x || 0, z || 0];
        };
        const expected = pllDestinations(caseCube(a.moves)).map((m) => ({
          ...m,
          from: rotate(m.from),
          to: rotate(m.to),
        }));
        assert.deepEqual(
          sortMoves(actual),
          sortMoves(expected),
          `${c.id}: AUF preserves the cycles`,
        );
      }
    }
  }
});

test("G arrows preserve exact independently placed corner and edge cycles", () => {
  const { cube, moves } = permutationFixture([
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
    ],
    [
      [0, -1],
      [-1, 0],
      [1, 0],
    ],
  ]);
  assert.deepEqual(sortMoves(pllDestinations(cube)), sortMoves(moves));
});

test("each crossing arrow has its own wider light outline behind its shaft and heads", () => {
  for (const id of ["pll-H", "pll-Z", "pll-Ga", "pll-Gb", "pll-Gc", "pll-Gd"]) {
    const svg = diagram(cubeFor(id), "PLL", id, { arrows: true });
    const count = [...svg.matchAll(/class="pll-arrow"/g)].length;
    const outlines = [
      ...svg.matchAll(/<g class="pll-arrow-outline"[^>]*>([^]*?)<\/g>/g),
    ];
    assert.equal(outlines.length, count, id);
    assert.ok(count > 0);
    for (const [, outline] of outlines) {
      assert.match(outline, /<path[^>]+stroke="#fff7d4" stroke-width="8"/);
      assert.match(outline, /<polygon[^>]+stroke="#fff7d4" stroke-width="4.8"/);
    }
  }
});

test("non-G PLLs retain their familiar displaced corner and edge counts across variants", () => {
  const counts = {
    H: [0, 4],
    Z: [0, 4],
    Ua: [0, 3],
    Ub: [0, 3],
    Aa: [3, 0],
    Ab: [3, 0],
    E: [4, 0],
    F: [2, 2],
    Ja: [2, 2],
    Jb: [2, 2],
    Ra: [2, 2],
    Rb: [2, 2],
    T: [2, 2],
    Y: [2, 2],
    V: [2, 2],
    Na: [2, 2],
    Nb: [2, 2],
  };
  for (const [name, expected] of Object.entries(counts)) {
    for (const a of catalog.find((c) => c.id === `pll-${name}`).algorithms) {
      const moves = pllDestinations(caseCube(a.moves));
      assert.deepEqual(
        ["corner", "edge"].map(
          (kind) => moves.filter((m) => m.kind === kind).length,
        ),
        expected,
        name,
      );
    }
  }
});
