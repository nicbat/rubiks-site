import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { guides, renderGuides } from "../scripts/render-views.mjs";
import { applyAlg, solvedCube, tokens, colorAt, normals } from "../src/cube.js";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";

function solvedPieces(pattern, orbit, indexes, label) {
  for (const i of indexes) {
    assert.equal(
      pattern.patternData[orbit].pieces[i],
      i,
      `${label}: ${orbit} ${i} position`,
    );
    assert.equal(
      pattern.patternData[orbit].orientation[i],
      0,
      `${label}: ${orbit} ${i} orientation`,
    );
  }
}
// Hand-authored cross-edge destinations in cubing.js order, after each picture.
// Each entry is [location, orientation] for DF, DR, DB, DL respectively.
const fixtures = {
  "cross-relative": [
    [
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ],
    [
      [7, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ],
    [
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
    ],
  ],
  "cross-together": [
    [
      [8, 1],
      [5, 0],
      [6, 0],
      [4, 1],
    ],
    [
      [4, 0],
      [5, 0],
      [6, 0],
      [9, 0],
    ],
    [
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
    ],
  ],
  "cross-pair": [
    [
      [4, 0],
      [5, 0],
      [2, 0],
      [7, 0],
    ],
    [
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
    ],
    [
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
    ],
  ],
  "cross-xcross": [
    [
      [4, 0],
      [5, 0],
      [8, 0],
      [7, 0],
    ],
    [
      [4, 0],
      [5, 0],
      [2, 0],
      [7, 0],
    ],
    [
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
    ],
  ],
};

test("visual cross lessons match their stated edge positions at every frame and the independent engine at every move", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  assert.deepEqual(
    guides.cross.examples.map((x) => x.id).sort(),
    Object.keys(fixtures).sort(),
  );
  for (const example of guides.cross.examples) {
    let oracle = puzzle.defaultPattern().applyAlg(example.setup);
    let cube = applyAlg(solvedCube(), example.setup);
    assertOracleFacelets(cube, oracle, `${example.id} setup`);
    assert.deepEqual(
      tokens(example.steps.map((s) => s.moves).join(" ")),
      tokens(example.algorithm),
    );
    for (const [frame, step] of [{ moves: "" }, ...example.steps].entries()) {
      for (const move of tokens(step.moves)) {
        oracle = oracle.applyAlg(move);
        cube = applyAlg(cube, move);
        assertOracleFacelets(cube, oracle, `${example.id}: ${move}`);
      }
      fixtures[example.id][frame].forEach(([location, orientation], i) => {
        assert.equal(
          oracle.patternData.EDGES.pieces[location],
          i + 4,
          `${example.id} frame ${frame}: edge ${i + 4}`,
        );
        assert.equal(
          oracle.patternData.EDGES.orientation[location],
          orientation,
        );
      });
      if (example.id === "cross-pair" || example.id === "cross-xcross") {
        const joined =
          frame === 0 || (example.id === "cross-pair" && frame === 1);
        const corner = joined ? 3 : 4,
          edge = joined ? 0 : 8;
        assert.equal(oracle.patternData.CORNERS.pieces[corner], 4);
        assert.equal(
          oracle.patternData.CORNERS.orientation[corner],
          joined ? 2 : 0,
        );
        assert.equal(oracle.patternData.EDGES.pieces[edge], 8);
        assert.equal(oracle.patternData.EDGES.orientation[edge], 0);
      }
    }
    solvedPieces(oracle, "EDGES", [4, 5, 6, 7], example.id);
    assert.ok(
      oracle.patternData.CORNERS.orientation.slice(0, 4).some((x) => x !== 0),
      "Last layer still needs orientation",
    );
    if (example.comparison) {
      const alternative = puzzle
        .defaultPattern()
        .applyAlg(example.setup)
        .applyAlg(example.comparison.algorithm);
      solvedPieces(
        alternative,
        "EDGES",
        [4, 5, 6, 7],
        "Alternative solves the same cross",
      );
      assert.equal(tokens(example.comparison.algorithm).length, 3);
      assert.equal(tokens(example.algorithm).length, 2);
    }
  }
});

test("all static guide pictures show oracle stickers in both views, with the intended pieces highlighted", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const html = renderGuides();
  const pictures = [
    ...html.matchAll(/<svg class="f2l-diagram"[^>]*>(.*?)<\/svg>/gs),
  ];
  assert.equal(pictures.length, 24);
  let index = 0;
  for (const example of guides.cross.examples) {
    let cube = applyAlg(solvedCube(), example.setup);
    let oracle = puzzle.defaultPattern().applyAlg(example.setup);
    for (const step of [{ moves: "" }, ...example.steps]) {
      cube = applyAlg(cube, step.moves);
      oracle = oracle.applyAlg(step.moves);
      for (const rotation of ["", "z2"]) {
        const view = applyAlg(cube, rotation);
        assertOracleFacelets(
          view,
          oracle.applyAlg(rotation),
          "Diagram viewpoint",
        );
        const stickers = [
          ...pictures[index++][1].matchAll(
            /data-face="([UFR])" data-row="(\d)" data-col="(\d)" data-color="([URFDLB])" data-target="(true|false)"/g,
          ),
        ];
        assert.equal(stickers.length, 27);
        for (const [, face, r, c, color, target] of stickers) {
          const row = Number(r),
            col = Number(c);
          const position =
            face === "U"
              ? [col - 1, 1, row - 1]
              : face === "F"
                ? [col - 1, 1 - row, 1]
                : [1, 1 - row, 1 - col];
          assert.equal(colorAt(view, position, normals[face]), color);
          const identity = view
            .filter((s) => s.p.every((v, i) => v === position[i]))
            .map((s) => s.color)
            .sort()
            .join("");
          assert.equal(
            target === "true",
            example.pieces.some((p) => [...p].sort().join("") === identity),
          );
        }
      }
    }
  }
});

test("guide cubes are absent until requested, with one explicit-setup player at most", () => {
  for (const [section, guide] of [["cross", guides.cross]]) {
    const closed = renderGuides({ section });
    assert.doesNotMatch(closed, /class="cube-player"/);
    for (const example of guide.examples) {
      const html = renderGuides({ section, example: example.id });
      assert.equal((html.match(/class="cube-player"/g) || []).length, 1);
      assert.match(html, /data-cube-mode="lesson"/);
      assert.ok(html.includes(`data-player-id="guide-${example.id}"`));
      assert.match(html, /aria-expanded="true"/);
    }
    assert.doesNotMatch(
      renderGuides({ section, example: "unknown" }),
      /class="cube-player"/,
    );
  }
  assert.doesNotMatch(
    renderGuides({ section: "notation" }),
    /class="cube-player"/,
  );
  assert.match(
    renderGuides({ section: "notation", example: "notation" }),
    /data-cube-mode="notation"/,
  );
});
