import assert from "node:assert/strict";
import {
  getPuzzleGeometryByName,
  ExperimentalPGNotation,
} from "cubing/puzzle-geometry";
import { KPuzzle } from "cubing/kpuzzle";
const normals = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};
const cache = new Map();
export function assertNxNOracle(cube, algorithm, size) {
  let oracle = cache.get(size);
  if (!oracle) {
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
    const data = geometry.get3d(),
      max = Math.max(
        ...data.faces.flatMap((face) => face.coords).map(Math.abs),
      );
    const lookup = new Map(
      data.stickers.map((s) => [
        `${s.orbit}/${s.ord}/${s.ori}`,
        data.faces[s.face].name,
      ]),
    );
    oracle = { definition, puzzle, data, max, lookup };
    cache.set(size, oracle);
  }
  const { definition, puzzle, data, max, lookup } = oracle;
  const pattern = puzzle.defaultPattern().applyAlg(algorithm);
  const actual = new Map(cube.map((s) => [`${s.p}/${s.n}`, s.color]));
  assert.equal(actual.size, 6 * size * size);
  for (const s of data.stickers) {
    const face = data.faces[s.face].name,
      n = normals[face];
    const p = [0, 1, 2].map((axis) => {
      if (n[axis]) return (n[axis] * (size - 1)) / 2;
      let sum = 0;
      for (let i = axis; i < s.coords.length; i += 3) sum += s.coords[i];
      return (
        Math.round((sum / (s.coords.length / 3) / ((2 * max) / size)) * 2) / 2
      );
    });
    const orbit = pattern.patternData[s.orbit],
      count = definition.orbits.find(
        (o) => o.orbitName === s.orbit,
      ).numOrientations;
    const orientation = (s.ori - orbit.orientation[s.ord] + count) % count;
    assert.equal(
      actual.get(`${p}/${n}`),
      lookup.get(`${s.orbit}/${orbit.pieces[s.ord]}/${orientation}`),
      `${size}/${p}/${face}: ${algorithm}`,
    );
  }
}
