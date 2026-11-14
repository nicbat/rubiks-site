import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { solvedCube, applyAlg, centers } from "@last-layer/cube-engine/core";
import {
  generateBigCube,
  isWithinOneTurn,
} from "../packages/cube-engine/scramble/big-cubes.js";
import { generateBlindfolded } from "../packages/cube-engine/scramble/blindfolded.js";
import {
  CUBE_ORIENTATIONS,
  sampleCubeOrientation,
} from "../packages/cube-engine/scramble/orientation.js";
import { validateEventScramble } from "../packages/cube-engine/scramble/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
function seeded(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}

for (const [eventId, size, length] of [
  ["555", 5, 60],
  ["666", 6, 80],
  ["777", 7, 100],
]) {
  test(`${eventId} sourced length, legal inventory, no same-axis merging and full oracle states`, async () => {
    for (let sample = 0; sample < 12; sample++) {
      const result = await generateBigCube({
        eventId,
        randomUint32: seeded(12345 + sample * 31 + size),
      });
      assert.equal(result.algorithm.split(" ").length, length);
      validateEventScramble(eventId, result.algorithm);
      let previous = -1,
        seen = new Set();
      for (const move of result.algorithm.split(" ")) {
        const [, widthText, face, wide] = /^(\d+)?([RUFLDB])(w)?/.exec(move);
        const width = wide ? Number(widthText || 2) : 1,
          axis = "RUFLDB".indexOf(face) % 3;
        assert.ok(width <= Math.floor(size / 2));
        if (size === 6 && width === 3) assert.ok("RUF".includes(face));
        if (axis !== previous) {
          seen = new Set();
          previous = axis;
        }
        const key = face + width;
        assert.equal(seen.has(key), false);
        seen.add(key);
      }
      assert.equal(isWithinOneTurn(result.cube), false);
      assertNxNOracle(result.cube, result.algorithm, size);
      assert.equal(result.generator.method, "random-move");
    }
  });
}

test("minimum distance covers every legal block width and every global orientation", () => {
  for (const size of [5, 6, 7]) {
    for (const orientation of CUBE_ORIENTATIONS) {
      assert.equal(
        isWithinOneTurn(applyAlg(solvedCube(size), orientation)),
        true,
      );
      assert.equal(
        isWithinOneTurn(applyAlg(solvedCube(size), `Rw ${orientation}`)),
        true,
      );
      assert.equal(
        isWithinOneTurn(applyAlg(solvedCube(size), `R U ${orientation}`)),
        false,
      );
    }
    for (let width = 1; width < size; width++)
      for (const face of "URFDLB")
        for (const suffix of ["", "2", "'"]) {
          const token =
            width === 1 ? face : width === 2 ? `${face}w` : `${width}${face}w`;
          assert.equal(
            isWithinOneTurn(
              applyAlg(solvedCube(size), `${token}${suffix} x y`),
            ),
            true,
            `${size}/${token}${suffix}`,
          );
        }
  }
});

test("a generated solved state is rejected only for distance and regenerated at full length", async () => {
  let calls = 0;
  const random = seeded(54231);
  const result = await generateBigCube({
    eventId: "555",
    randomUint32: () => (++calls <= 60 ? 1 : random()),
  });
  // The first60 choices produce (R2 U2)^30, which is solved.
  assert.ok(calls >= 120);
  assert.equal(result.algorithm.split(" ").length, 60);
  assert.equal(isWithinOneTurn(result.cube), false);
  assertNxNOracle(result.cube, result.algorithm, 5);
});

test("all24 rotation choices are distinct proper orientations under independent cubing oracle", async () => {
  const puzzle = await cube3x3x3.kpuzzle(),
    states = new Set();
  assert.equal(CUBE_ORIENTATIONS.length, 24);
  for (let choice = 0; choice < 24; choice++) {
    const rotation = sampleCubeOrientation({ randomUint32: () => choice });
    assert.equal(rotation, CUBE_ORIENTATIONS[choice]);
    const pattern = puzzle.defaultPattern().applyAlg(rotation);
    states.add(JSON.stringify(pattern.patternData.CENTERS.pieces));
    assertNxNOracle(applyAlg(solvedCube(3), rotation), rotation, 3);
  }
  assert.equal(states.size, 24);
  let calls = 0;
  assert.equal(
    sampleCubeOrientation({
      randomUint32: () => (++calls === 1 ? 2 ** 32 - 1 : 23),
    }),
    CUBE_ORIENTATIONS[23],
  );
  assert.equal(calls, 2);
});

test("blindfolded bases and independent final orientation retain exact states", async () => {
  for (const [eventId, size, method] of [
    ["333bf", 3, "random-state"],
    ["555bf", 5, "random-move"],
  ])
    for (const seed of [3355, 7359, 11579]) {
      const result = await generateBlindfolded({
        eventId,
        randomUint32: seeded(seed),
      });
      validateEventScramble(eventId, result.algorithm);
      assert.ok(CUBE_ORIENTATIONS.includes(result.orientation));
      assert.equal(
        result.algorithm,
        [result.baseAlgorithm, result.orientation].filter(Boolean).join(" "),
      );
      assert.equal(result.generator.method, method);
      const cube = applyAlg(solvedCube(size), result.algorithm);
      assertNxNOracle(cube, result.algorithm, size);
      // Base generators preserve center orientation; the suffix alone chooses it.
      assert.deepEqual(
        centers(cube),
        centers(applyAlg(solvedCube(size), result.orientation)),
      );
      if (size === 5) {
        assert.equal(result.baseAlgorithm.split(" ").length, 60);
        assert.equal(isWithinOneTurn(cube), false);
      }
    }
});

test("unsupported events, invalid randomness and abort never substitute an engine", async () => {
  for (const eventId of ["444", "444bf", "333", null, "constructor"]) {
    await assert.rejects(generateBigCube({ eventId }), {
      code: "UNSUPPORTED_EVENT",
    });
  }
  await assert.rejects(generateBlindfolded({ eventId: "444bf" }), {
    code: "UNSUPPORTED_EVENT",
  });
  for (const word of [-1, NaN, 0.5, 2 ** 32])
    await assert.rejects(
      generateBigCube({ eventId: "555", randomUint32: () => word }),
      { code: "GENERATION_FAILED" },
    );
  await assert.rejects(
    generateBigCube({ eventId: "555", signal: AbortSignal.abort() }),
    { code: "ABORTED" },
  );
  await assert.rejects(
    generateBlindfolded({ eventId: "333bf", signal: AbortSignal.abort() }),
    { code: "ABORTED" },
  );
  assert.throws(() => sampleCubeOrientation({ signal: AbortSignal.abort() }), {
    code: "ABORTED",
  });
});

test("every blindfolded orientation is selected without changing or resampling its base", async () => {
  for (const [eventId, baseDraws, size] of [
    ["333bf", 36, 3],
    ["555bf", 60, 5],
  ]) {
    let base;
    const orientations = new Set();
    for (let choice = 0; choice < 24; choice++) {
      let draws = 0;
      const result = await generateBlindfolded({
        eventId,
        randomUint32: () => (++draws <= baseDraws ? 0 : choice),
      });
      assert.equal(draws, baseDraws + 1);
      assert.equal(result.orientation, CUBE_ORIENTATIONS[choice]);
      if (base === undefined) base = result.baseAlgorithm;
      else assert.equal(result.baseAlgorithm, base);
      const cube = applyAlg(solvedCube(size), result.algorithm);
      assertNxNOracle(cube, result.algorithm, size);
      orientations.add(JSON.stringify(centers(cube)));
    }
    assert.equal(orientations.size, 24);
  }
});
