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
