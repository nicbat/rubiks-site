import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { courseExamples } from "../src/courses.js";
import { applyAlg, solvedCube, tokens } from "../src/cube.js";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";

const solved = (pattern, orbit, positions) => {
  for (const position of positions) {
    assert.equal(
      pattern.patternData[orbit].pieces[position],
      position,
      `${orbit}[${position}] is home`,
    );
    assert.equal(
      pattern.patternData[orbit].orientation[position],
      0,
      `${orbit}[${position}] faces correctly`,
    );
  }
};
const f2l = (pattern) => {
  solved(pattern, "EDGES", [4, 5, 6, 7, 8, 9, 10, 11]);
  solved(pattern, "CORNERS", [4, 5, 6, 7]);
};
// Hand-specified starting objectives in cubing.js orbit order. These verify the
// teaching claims rather than only checking a sequence against its inverse.
const edgeFixtures = {
  "beginner-cross": [
    [4, 1, 2, 3, 0, 5, 6, 7, 9, 8, 10, 11],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  "beginner-corner": [
    [0, 2, 8, 3, 4, 5, 6, 7, 1, 9, 10, 11],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  "beginner-middle-right": [
    [8, 3, 1, 0, 4, 5, 6, 7, 2, 9, 10, 11],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  "beginner-middle-left": [
    [9, 0, 3, 1, 4, 5, 6, 7, 8, 2, 10, 11],
    [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  "beginner-yellow-cross": [
    [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  "beginner-yellow-edges": [
    [3, 1, 2, 0, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};

test("every Beginner example matches independent stickers after every move and achieves its stated stage", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  assert.equal(Object.keys(courseExamples).length, 9);
  for (const [id, example] of Object.entries(courseExamples)) {
    let oracle = puzzle.defaultPattern().applyAlg(example.setup);
    let cube = applyAlg(solvedCube(), example.setup);
    assertOracleFacelets(cube, oracle, `${id} setup`);
    if (edgeFixtures[id]) {
      assert.deepEqual(
        oracle.patternData.EDGES.pieces,
        edgeFixtures[id][0],
        `${id} edge positions`,
      );
      assert.deepEqual(
        oracle.patternData.EDGES.orientation,
        edgeFixtures[id][1],
        `${id} edge orientations`,
      );
    }
    if (id === "beginner-corner") {
      solved(oracle, "EDGES", [4, 5, 6, 7]);
      solved(oracle, "CORNERS", [5, 6, 7]);
      assert.equal(
        oracle.patternData.CORNERS.pieces[0],
        4,
        "white corner is above the front-right slot",
      );
      assert.equal(
        oracle.patternData.CORNERS.orientation[0],
        1,
        "white sticker faces right",
      );
    }
    if (id.includes("middle")) {
      solved(oracle, "EDGES", [4, 5, 6, 7]);
      solved(oracle, "CORNERS", [4, 5, 6, 7]);
    }
    if (id.includes("yellow") || id === "beginner-orient-corners") f2l(oracle);
    if (id === "beginner-yellow-corners") {
      solved(
        oracle,
        "EDGES",
        Array.from({ length: 12 }, (_, i) => i),
      );
      assert.deepEqual(
        oracle.patternData.CORNERS.pieces,
        [0, 2, 3, 1, 4, 5, 6, 7],
      );
      assert.deepEqual(
        oracle.patternData.CORNERS.orientation,
        [0, 2, 2, 2, 0, 0, 0, 0],
      );
    }
    if (id === "beginner-orient-corners") {
      solved(
        oracle,
        "EDGES",
        Array.from({ length: 12 }, (_, i) => i),
      );
      assert.deepEqual(
        oracle.patternData.CORNERS.pieces,
        [0, 1, 2, 3, 4, 5, 6, 7],
      );
      assert.deepEqual(
        oracle.patternData.CORNERS.orientation,
        [1, 2, 0, 0, 0, 0, 0, 0],
      );
    }
    let moveIndex = 0;
    for (const move of tokens(example.algorithm)) {
      cube = applyAlg(cube, move);
      oracle = oracle.applyAlg(move);
      assertOracleFacelets(cube, oracle, `${id} move ${++moveIndex}`);
      if (id === "beginner-orient-corners" && moveIndex === 8) {
        assert.equal(
          oracle.patternData.CORNERS.orientation[0],
          0,
          "first corner is oriented after two full groups",
        );
        assert.deepEqual(
          oracle.patternData.CORNERS.orientation.slice(4),
          [2, 0, 1, 1],
          "lower corners temporarily twist during the final step",
        );
      }
    }
    if (id !== "beginner-turn") {
      solved(
        oracle,
        "EDGES",
        Array.from({ length: 12 }, (_, i) => i),
      );
      solved(
        oracle,
        "CORNERS",
        Array.from({ length: 8 }, (_, i) => i),
      );
    } else {
      assert.equal(
        oracle.isIdentical(puzzle.defaultPattern()),
        false,
        "notation example actually turns a face",
      );
    }
  }
});
