import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generateFourByFourJoint,
  FOUR_BY_FOUR_JOINT_GENERATOR,
  FOUR_BY_FOUR_JOINT_PROFILE,
} from "../packages/cube-engine/scramble/four-by-four-joint-generator.js";
import {
  sampleFourByFourState,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { FOUR_BY_FOUR_GENERATOR } from "../packages/cube-engine/scramble/four-by-four.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
const seeded = (initial) => {
  let s = initial;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
};

test("joint generator excludes exact shallow sample then reproduces accepted uniform target independently", async () => {
  const identityWords = [8, 24, 24]
    .flatMap((size) => Array.from({ length: size - 1 }, (_, i) => size - 1 - i))
    .concat(Array(7).fill(0));
  let draws = 0;
  const random = seeded(0x444c0de);
  const expected = sampleFourByFourState({ randomUint32: seeded(0x444c0de) });
  const result = await generateFourByFourJoint({
    randomUint32: () => {
      const index = draws++;
      return index < identityWords.length ? identityWords[index] : random();
    },
  });
  assert.deepEqual(result.target, expected);
  assert.equal(result.generator, FOUR_BY_FOUR_JOINT_GENERATOR);
  assert.ok(Object.isFrozen(result.generator));
  assert.equal(draws, 120);
  assertNxNOracle(fourByFourStateToFacelets(expected), result.algorithm, 4);
  assert.ok(result.nodes <= 10000000);
  assert.ok(result.finishNodes <= 50000000);
  assert.ok(result.moveCount <= 512);
  assert.equal(result.algorithm.split(" ").length, result.moveCount);
  result.target.wingPermutation[0] = 99;
  assert.notEqual(expected.wingPermutation[0], 99);
});

test("profile and provenance stay fixed and separate from constructive revision2", () => {
  assert.ok(Object.isFrozen(FOUR_BY_FOUR_JOINT_PROFILE));
  assert.ok(Object.isFrozen(FOUR_BY_FOUR_JOINT_GENERATOR));
  assert.notEqual(FOUR_BY_FOUR_JOINT_GENERATOR.id, FOUR_BY_FOUR_GENERATOR.id);
  assert.deepEqual(FOUR_BY_FOUR_JOINT_GENERATOR, {
    id: "last-layer-444-joint",
    version: "1",
    method: "random-state",
  });
});

test("entropy errors and cancellation propagate without further sampling", async () => {
  let calls = 0;
  await assert.rejects(
    generateFourByFourJoint({
      signal: AbortSignal.abort(),
      randomUint32: () => {
        calls++;
        return 0;
      },
    }),
    { code: "ABORTED" },
  );
  assert.equal(calls, 0);
  await assert.rejects(
    generateFourByFourJoint({
      randomUint32: () => {
        calls++;
        throw Error("entropy unavailable");
      },
    }),
    { code: "GENERATION_FAILED" },
  );
  assert.equal(calls, 1);
  const controller = new AbortController(),
    random = seeded(444);
  calls = 0;
  await assert.rejects(
    generateFourByFourJoint({
      signal: controller.signal,
      randomUint32: () => {
        calls++;
        if (calls === 60) controller.abort();
        return random();
      },
    }),
    { code: "ABORTED" },
  );
  assert.equal(calls, 60);
});

test("solver failure is forwarded once with the unchanged accepted target and fixed resource profile", () => {
  // Isolated Node loader replaces only the solver module, without a production
  // injection hook or allowing callers to weaken the qualified profile.
  const generator = new URL(
    "../packages/cube-engine/scramble/four-by-four-joint-generator.js",
    import.meta.url,
  ).href;
  const solver = new URL(
    "../packages/cube-engine/scramble/four-by-four-joint.js",
    import.meta.url,
  ).href;
  const stateModule = new URL(
    "../packages/cube-engine/scramble/four-by-four-state.js",
    import.meta.url,
  ).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    const {sampleFourByFourState}=await import(${JSON.stringify(stateModule)});
    const seeded=()=>{let s=0x444c0de;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return s>>>0;};};
    const expected=sampleFourByFourState({randomUint32:seeded()});
    let solves=0,draws=0;const failure=Object.assign(new Error('fixed failure'),{code:'JOINT_PHASE3_SEARCH_LIMIT'});
    globalThis.solveHook=(target,options)=>{solves++;assert.equal(draws,60);assert.deepEqual(target,expected);assert.deepEqual(options,{...profile,signal:undefined});throw failure;};
    registerHooks({load(url,context,next){if(url===${JSON.stringify(solver)})return {format:'module',shortCircuit:true,source:'export const solveFourByFourJoint=(...args)=>globalThis.solveHook(...args);'};return next(url,context);}});
    const {generateFourByFourJoint,FOUR_BY_FOUR_JOINT_PROFILE:profile}=await import(${JSON.stringify(generator)});
    let s=0x444c0de;
    await assert.rejects(generateFourByFourJoint({randomUint32:()=>{draws++;s^=s<<13;s^=s>>>17;s^=s<<5;return s>>>0;}}),error=>error===failure);
    assert.equal(solves,1);assert.equal(draws,60);
    const controller=new AbortController();
    globalThis.solveHook=()=>{controller.abort();return {algorithm:''};};
    await assert.rejects(generateFourByFourJoint({randomUint32:seeded(),signal:controller.signal}),{code:'ABORTED'});
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
});
