import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAlg } from "@last-layer/cube-engine/core";
import { generateBlindfolded } from "../packages/cube-engine/scramble/blindfolded.js";
import { CUBE_ORIENTATIONS } from "../packages/cube-engine/scramble/orientation.js";
import {
  sampleFourByFourState,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { validateEventScramble } from "../packages/cube-engine/scramble/index.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";

function seeded() {
  let seed = 0x444c0de;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
}

test("4x4 blindfolded preserves its sampled target across all 24 independent orientations", async () => {
  let baseDraws = 0;
  const random = seeded();
  const target = sampleFourByFourState({
    randomUint32: () => {
      baseDraws++;
      return random();
    },
  });
  const facelets = fourByFourStateToFacelets(target);
  let base;
  const states = new Set();
  for (let choice = 0; choice < 24; choice++) {
    let draws = 0;
    const random = seeded();
    const result = await generateBlindfolded({
      eventId: "444bf",
      randomUint32: () => (++draws <= baseDraws ? random() : choice),
    });
    assert.equal(draws, baseDraws + 1);
    assert.equal(result.orientation, CUBE_ORIENTATIONS[choice]);
    if (base === undefined) base = result.baseAlgorithm;
    else assert.equal(result.baseAlgorithm, base);
    assert.deepEqual(result.generator, {
      id: "last-layer-444bf-joint-orientation",
      version: "1",
      method: "random-state",
    });
    validateEventScramble("444bf", result.algorithm);
    const expected = applyAlg(facelets, result.orientation);
    assertNxNOracle(expected, result.algorithm, 4);
    states.add(JSON.stringify(expected));
  }
  assert.equal(states.size, 24);
});

test("4x4 blindfolded rejects cancellation and entropy failure without fallback", async () => {
  let draws = 0;
  await assert.rejects(
    generateBlindfolded({
      eventId: "444bf",
      signal: AbortSignal.abort(),
      randomUint32: () => {
        draws++;
        return 0;
      },
    }),
    { code: "ABORTED" },
  );
  assert.equal(draws, 0);
  await assert.rejects(
    generateBlindfolded({
      eventId: "444bf",
      randomUint32: () => {
        draws++;
        throw Error("entropy failure");
      },
    }),
    { code: "GENERATION_FAILED" },
  );
  assert.equal(draws, 1);
});
