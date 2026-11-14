import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPuzzleGeometryByName,
  ExperimentalPGNotation,
} from "cubing/puzzle-geometry";
import { KPuzzle } from "cubing/kpuzzle";
import {
  solvedCube,
  applyAlg,
  colorAt,
  normals,
  tokens,
  isSolved,
  centers,
  cubeSize,
} from "@last-layer/cube-engine/core";
import { cubeScene, layerTransform } from "@last-layer/cube-engine/renderer";
import { createCubePlayback } from "@last-layer/cube-engine/playback";
import { seededRandom } from "./helpers/cube-oracle.js";

// Derive orbit-to-facelet correspondence from cubing.js geometry, independently
// of this engine's move tables. Polygon centroids locate every wing and center.
function oracle(size) {
  const geometry = getPuzzleGeometryByName(`${size}x${size}x${size}`, {
    allMoves: true,
  });
  const definition = geometry.getKPuzzleDefinition(true);
  const puzzle = new KPuzzle(definition, {
    experimentalPGNotation: new ExperimentalPGNotation(
      geometry,
      geometry.getOrbitsDef(true),
    ),
  });
  const data = geometry.get3d();
  const max = Math.max(
    ...data.faces.flatMap((face) => face.coords).map(Math.abs),
  );
  const lookup = new Map(
    data.stickers.map((s) => [
      `${s.orbit}/${s.ord}/${s.ori}`,
      data.faces[s.face].name,
    ]),
  );
  return (cube, algorithm) => {
    const pattern = puzzle
      .defaultPattern()
      .applyAlg(
        algorithm.replace(/(\d+)?([URFDLB])w/g, (move, width, face) =>
          Number(width || 2) === size ? `${face}v` : move,
        ),
      );
    for (const s of data.stickers) {
      const face = data.faces[s.face].name;
      const n = normals[face];
      const centroid = [0, 1, 2].map((axis) => {
        let sum = 0;
        for (let i = axis; i < s.coords.length; i += 3) sum += s.coords[i];
        return sum / (s.coords.length / 3);
      });
      const p = centroid.map((v, i) =>
        n[i]
          ? (n[i] * (size - 1)) / 2
          : Math.round((v / ((2 * max) / size)) * 2) / 2,
      );
      const orbit = pattern.patternData[s.orbit];
      const count = definition.orbits.find(
        (o) => o.orbitName === s.orbit,
      ).numOrientations;
      const original = (s.ori - orbit.orientation[s.ord] + count) % count;
      const expected = lookup.get(
        `${s.orbit}/${orbit.pieces[s.ord]}/${original}`,
      );
      assert.equal(
        colorAt(cube, p, n),
        expected,
        `${size}: ${algorithm}: ${p}/${face}`,
      );
    }
  };
}

for (const size of [2, 3, 4, 5, 6, 7]) {
  test(`${size}x${size} exact states match independent geometry/orbits for face and wide moves`, () => {
    const check = oracle(size);
    const moves = [
      "R",
      "L'",
      "U2",
      "D",
      "F'",
      "B2",
      "Rw",
      "Uw'",
      "Fw2",
      "x",
      "y'",
      "z2",
    ];
    for (let width = 2; width <= size; width++)
      moves.push(`${width}Rw`, `${width}Bw'`);
    if (size % 2) moves.push("M", "E'", "S2");
    check(solvedCube(size), "");
    for (const move of moves) check(applyAlg(solvedCube(size), move), move);
    const random = seededRandom(1700 + size);
    const algorithm = Array.from(
      { length: 60 },
      () => moves[Math.floor(random() * moves.length)],
    ).join(" ");
    const scrambled = applyAlg(solvedCube(size), algorithm);
    check(scrambled, algorithm);
    const rendered = [
      ...cubeScene(scrambled, "Rw").matchAll(
        /data-position="([^"]+)" data-normal="([^"]+)" data-color="([URFDLB])"/g,
      ),
    ].map(([, p, n, color]) => ({
      p: p.split(",").map(Number),
      n: n.split(",").map(Number),
      color,
    }));
    assert.equal(rendered.length, 6 * size * size);
    check(rendered, algorithm);
  });
}

for (const size of [2, 4, 7]) {
  test(`${size}x${size} literal R state, scene counts and playback boundaries`, () => {
    const extent = (size - 1) / 2;
    const cube = applyAlg(solvedCube(size), "R");
    assert.equal(colorAt(cube, [extent, extent, extent], normals.U), "F");
    assert.equal(colorAt(cube, [extent, extent, extent], normals.F), "D");
    assert.equal(colorAt(cube, [-extent, extent, extent], normals.F), "F");
    assert.equal(isSolved(cube), false);
    assert.equal(isSolved(applyAlg(solvedCube(size), "x y")), true);
    const html = cubeScene(cube, "Rw");
    assert.equal(
      [...html.matchAll(/class="cube-piece"/g)].length,
      size ** 3 - (size - 2) ** 3,
    );
    assert.equal([...html.matchAll(/data-color=/g)].length, 6 * size * size);
    assert.ok(!html.includes("undefined"));
    const playback = createCubePlayback(solvedCube(size), `${size}Rw U`);
    playback.seek(1);
    assert.deepEqual(
      playback.snapshot().cube,
      applyAlg(solvedCube(size), `${size}Rw`),
    );
    assert.equal(cubeSize(playback.snapshot().cube), size);
    assert.equal(layerTransform(`${size}Rw`, 1, size), "rotateX(90deg)");
  });
}

test("size and notation validation rejects ambiguous or out-of-bounds inputs", () => {
  for (const size of [0, 1, 8, 3.5, NaN, Infinity])
    assert.throws(() => solvedCube(size));
  for (const alg of ["0Rw", "1Rw", "03Rw", "4Rw", "2R", "Rww", "R4", "Q"])
    assert.throws(() => tokens(alg, 3), alg);
  for (const alg of ["M", "E'", "S2"])
    assert.throws(() => applyAlg(solvedCube(4), alg));
  assert.throws(() => centers(solvedCube(2)));
  assert.deepEqual(centers(solvedCube(7)), {
    U: "U",
    R: "R",
    F: "F",
    D: "D",
    L: "L",
    B: "B",
  });
});
