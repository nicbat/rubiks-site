import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import catalog from "../data/algorithms.json" with { type: "json" };
import { displayCube, displayColors } from "../src/display-colors.js";
import { solvedCube, centers, applyAlg, inverse } from "../src/cube.js";
import { createCaseDiagramRenderer } from "../src/case-diagram.js";
import {
  createPllQuestion,
  pllQuestionCube,
  twoSideStickers,
} from "../src/pll-quiz.js";
import { loadPreferences } from "../src/preferences.js";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";

test("display schemes match six independent proper cube rotations and do not mutate inputs", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const source = solvedCube(),
    original = structuredClone(source);
  const expected = { U: "", D: "x2", F: "x", B: "x'", R: "z'", L: "z" };
  for (const [top, rotation] of Object.entries(expected)) {
    const cube = displayCube(source, top);
    assert.equal(centers(cube).U, top);
    assertOracleFacelets(cube, puzzle.defaultPattern().applyAlg(rotation), top);
    cube[0].p[0] = 100;
  }
  assert.deepEqual(source, original);
  const render = createCaseDiagramRenderer(2);
  const yellow = render("R U R'", "OLL", "Case", { top: "U" });
  const white = render("R U R'", "OLL", "Case", { top: "D" });
  assert.notEqual(yellow, white);
  const moves = catalog.find((c) => c.id === "pll-T").algorithms[0].moves;
  const colored = render(moves, "PLL", "Choice", { arrows: true });
  const neutral = render(moves, "PLL", "Choice", {
    arrows: true,
    neutralSides: true,
  });
  assert.notEqual(colored, neutral);
  assert.match(neutral, /pll-arrows/);
  const sides = [
    ...neutral.matchAll(/<rect[^>]+(?:width="12"|height="12")[^>]+>/g),
  ].map((m) => m[0]);
  assert.equal(sides.length, 12);
  assert.ok(sides.every((rect) => rect.includes("var(--diagram-muted")));
  assert.equal(render(moves, "PLL", "Choice", { arrows: true }), colored);

  assert.match(white, /#ffffff/);
  assert.equal(render("R U R'", "OLL", "Case", { top: "U" }), yellow);
  assert.equal(
    loadPreferences({
      getItem: () => '{"displayTop":"__proto__","randomDisplay":"true"}',
    }).displayTop,
    "U",
  );
  assert.equal(
    loadPreferences({ getItem: () => '{"randomDisplay":"true"}' })
      .randomDisplay,
    false,
  );
});

test("all PLL questions show six stickers that uniquely identify the case across AUF, views, and colors", () => {
  const observed = new Map();
  for (const c of catalog.filter((c) => c.section === "PLL"))
    for (let auf = 0; auf < 4; auf++)
      for (let angle = 0; angle < 4; angle++)
        for (const top of Object.keys(displayColors)) {
          const cube = pllQuestionCube(
            { moves: c.algorithms[0].moves, auf, angle },
            top,
          );
          const stickers = twoSideStickers(cube);
          assert.equal(stickers.length, 6);
          const ce = centers(cube);
          const signature = [ce.U, ce.F, ce.R, ...stickers].join("");
          assert.ok(
            !observed.has(signature) || observed.get(signature) === c.id,
            `${c.id} ambiguous with ${observed.get(signature)}`,
          );
          observed.set(signature, c.id);
        }
});

test("quiz samples the entire PLL catalog using injected choices; AUF and viewpoint match independent engine", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const cases = catalog.filter((c) => c.section === "PLL");
  for (let index = 0; index < cases.length; index++) {
    const choices = [index, 2, 3];
    const q = createPllQuestion(catalog, (n) => {
      const v = choices.length ? choices.shift() : n - 1;
      assert.ok(v < n);
      return v;
    });
    assert.equal(q.caseId, cases[index].id);
    assert.equal(q.answer, null);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.caseId));
    // Recolor the independent inverse state using the algorithm's final centers,
    // matching the catalog's center-relative convention, then compare all stickers.
    const cube = pllQuestionCube(q);
    const end = centers(applyAlg(solvedCube(), q.moves));
    const unmap = Object.fromEntries(
      Object.entries(end).map(([face, color]) => [color, face]),
    );
    const canonical = cube.map((s) => ({ ...s, color: unmap[s.color] }));
    assertOracleFacelets(
      canonical,
      puzzle.defaultPattern().applyAlg(`${inverse(q.moves)} U2 y'`),
      q.caseId,
    );
  }
});
