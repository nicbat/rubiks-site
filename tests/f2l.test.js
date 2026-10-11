import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { f2lCases, f2lSetup } from "../src/f2l.js";
import { applyAlg, solvedCube, tokens } from "../src/cube.js";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";
import { renderGuides } from "../src/guides-view.js";

function solvedPieces(pattern, orbit, indexes, context) {
  for (const index of indexes) {
    assert.equal(
      pattern.patternData[orbit].pieces[index],
      index,
      `${context}: ${orbit}[${index}] position`,
    );
    assert.equal(
      pattern.patternData[orbit].orientation[index],
      0,
      `${context}: ${orbit}[${index}] orientation`,
    );
  }
}
function normalizedCenters(pattern) {
  return ["", "y", "y2", "y'"]
    .map((rotation) => pattern.applyAlg(rotation))
    .find((candidate) =>
      candidate.patternData.CENTERS.pieces.every(
        (piece, index) => piece === index,
      ),
    );
}
function signature(pattern) {
  for (const auf of ["", "U", "U2", "U'"]) {
    const { CORNERS: corners, EDGES: edges } =
      pattern.applyAlg(auf).patternData;
    const corner = corners.pieces.indexOf(4),
      edge = edges.pieces.indexOf(8);
    if (corner === 0 || (corner === 4 && (edge === 0 || edge === 8))) {
      return [
        corner,
        corners.orientation[corner],
        edge,
        edges.orientation[edge],
      ].join(":");
    }
  }
  assert.fail("F2L target pieces must be on top or in the front-right slot");
}

test("the catalog covers exactly the 41 unsolved front-right F2L cases modulo U", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  assert.equal(f2lCases.length, 41);
  assert.equal(new Set(f2lCases.map((item) => item.id)).size, 41);
  const expected = new Set();
  for (let cornerOrientation = 0; cornerOrientation < 3; cornerOrientation++) {
    for (let edgeOrientation = 0; edgeOrientation < 2; edgeOrientation++) {
      for (const edge of [0, 1, 2, 3, 8])
        expected.add([0, cornerOrientation, edge, edgeOrientation].join(":"));
      expected.add([4, cornerOrientation, 0, edgeOrientation].join(":"));
      if (cornerOrientation || edgeOrientation)
        expected.add([4, cornerOrientation, 8, edgeOrientation].join(":"));
    }
  }
  const found = new Map();
  for (const item of f2lCases) {
    const pattern = puzzle.defaultPattern().applyAlg(f2lSetup(item.algorithm));
    const key = signature(pattern);
    assert.ok(
      !found.has(key),
      `${item.id} duplicates ${found.get(key)}: ${key}`,
    );
    found.set(key, item.id);
  }
  assert.deepEqual([...found.keys()].sort(), [...expected].sort());
});

test("all F2L setups and every move match independent stickers and solve only the remaining slot", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const item of f2lCases) {
    const setup = f2lSetup(item.algorithm);
    let oracle = puzzle.defaultPattern().applyAlg(setup);
    let cube = applyAlg(solvedCube(), setup);
    assertOracleFacelets(cube, oracle, `${item.id} setup`);
    solvedPieces(
      oracle,
      "CENTERS",
      [0, 1, 2, 3, 4, 5],
      `${item.id} setup orientation`,
    );
    solvedPieces(
      oracle,
      "EDGES",
      [4, 5, 6, 7, 9, 10, 11],
      `${item.id} initial cross and other slots`,
    );
    solvedPieces(
      oracle,
      "CORNERS",
      [5, 6, 7],
      `${item.id} initial other corners`,
    );
    for (const move of tokens(item.algorithm)) {
      oracle = oracle.applyAlg(move);
      cube = applyAlg(cube, move);
      assertOracleFacelets(cube, oracle, `${item.id} after ${move}`);
    }
    const result = normalizedCenters(oracle);
    assert.ok(result, `${item.id} final centers can be restored by y rotation`);
    solvedPieces(
      result,
      "EDGES",
      [4, 5, 6, 7, 8, 9, 10, 11],
      `${item.id} completed cross and slots`,
    );
    solvedPieces(
      result,
      "CORNERS",
      [4, 5, 6, 7],
      `${item.id} completed corners`,
    );
    assert.ok(
      result.patternData.EDGES.pieces
        .slice(0, 4)
        .some((piece, index) => piece !== index),
      `${item.id} last layer remains unsolved`,
    );
  }
});

test("full F2L reference mounts only the explicitly opened case", () => {
  const closed = renderGuides({ section: "f2l" });
  assert.doesNotMatch(closed, /class="cube-player"/);
  for (const item of f2lCases) {
    const html = renderGuides({ section: "f2l", example: item.id });
    assert.equal((html.match(/class="cube-player"/g) || []).length, 1, item.id);
    assert.match(html, /data-cube-mode="lesson"/);
    assert.ok(html.includes(`data-player-id="${item.id}"`));
  }
  assert.doesNotMatch(
    renderGuides({ section: "f2l", example: "unknown" }),
    /class="cube-player"/,
  );
});
