import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { guides, renderGuides } from "../src/guides-view.js";
import { applyAlg, solvedCube, tokens } from "../src/cube.js";
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
// Hand-specified locations/orientations for the teaching cases, in cubing.js orbit order.
// These assert the actual described starting case, not just algorithm/inverse cancellation.
const fixtures = {
  "cross-half-turn": { edge: [4, 0, 0] },
  "cross-align": { edge: [5, 2, 0] },
  "cross-protect": { edge: [4, 1, 1] },
};

test("Cross examples teach the stated positions, preserve solved edges, and leave last layer work", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const seen = new Set();
  for (const guide of [guides.cross]) {
    for (const example of guide.examples) {
      assert.ok(!seen.has(example.id));
      seen.add(example.id);
      const fixture = fixtures[example.id];
      assert.ok(fixture, example.id);
      let oracle = puzzle.defaultPattern().applyAlg(example.setup);
      let cube = applyAlg(solvedCube(), example.setup);
      assertOracleFacelets(cube, oracle, `${example.id} setup`);
      for (const [type, [piece, location, orientation]] of Object.entries(
        fixture,
      )) {
        const orbit = type === "edge" ? "EDGES" : "CORNERS";
        assert.equal(
          oracle.patternData[orbit].pieces[location],
          piece,
          `${example.id} described ${type}`,
        );
        assert.equal(
          oracle.patternData[orbit].orientation[location],
          orientation,
          `${example.id} described ${type} orientation`,
        );
      }
      const preservedCross = [4, 5, 6, 7].filter((i) => i !== fixture.edge[0]);
      solvedPieces(
        oracle,
        "EDGES",
        preservedCross,
        `${example.id} initial cross`,
      );

      assert.deepEqual(
        tokens(example.steps.map((s) => s.moves).join(" ")),
        tokens(example.algorithm),
      );
      for (const move of tokens(example.algorithm)) {
        oracle = oracle.applyAlg(move);
        cube = applyAlg(cube, move);
        assertOracleFacelets(cube, oracle, `${example.id} after ${move}`);
      }
      solvedPieces(
        oracle,
        "EDGES",
        [4, 5, 6, 7],
        `${example.id} completed cross`,
      );

      assert.ok(
        oracle.patternData.CORNERS.orientation
          .slice(0, 4)
          .some((value) => value !== 0),
        `${example.id} last layer still needs orientation`,
      );
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(fixtures).sort());
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
  assert.match(
    renderGuides({ section: "notation" }),
    /data-cube-mode="notation"/,
  );
  assert.doesNotMatch(
    renderGuides({ section: "notation", example: null }),
    /class="cube-player"/,
  );
  assert.match(
    renderGuides({ section: "notation", example: "notation" }),
    /data-cube-mode="notation"/,
  );
});
