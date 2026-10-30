import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cube3x3x3 } from "cubing/puzzles";
import {
  generateSetup,
  rotateSetup,
  orientSetup,
  randomIndex,
} from "../src/practice.js";
import {
  applyAlg,
  solvedCube,
  caseCube,
  caseSignature,
  signature,
  f2lSolved,
  topOriented,
  centers,
  inverse,
} from "../src/cube.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);

test("side remapping equals cube conjugation in independent cubing.js engine", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const c of catalog) {
    for (let side = 0; side < 4; side++) {
      const rotations = "y ".repeat(side);
      const undo = "y' ".repeat(side);
      assert.ok(
        puzzle
          .algToTransformation(rotateSetup(c.setups[0], side))
          .isIdentical(
            puzzle.algToTransformation(`${rotations}${c.setups[0]} ${undo}`),
          ),
        c.id,
      );
    }
  }
});

test("all four practice sides preserve each case, F2L, and PLL orientation", () => {
  for (const c of catalog) {
    const expected = caseSignature(caseCube(c.algorithms[0].moves), c.section);
    for (let side = 0; side < 4; side++) {
      const choices = [0, 0, side, 0];
      const setup = generateSetup(c, { randomLastLayer: true }, () =>
        choices.shift(),
      );
      const cube = applyAlg(solvedCube(), setup);
      assert.ok(f2lSolved(cube), c.id);
      if (c.section === "PLL") assert.ok(topOriented(cube), c.id);
      assert.equal(caseSignature(cube, c.section), expected, c.id);
    }
  }
});

test("random side changes PLL color assignment beyond an AUF", () => {
  const c = catalog.find((c) => c.id === "pll-T");
  const fixed = applyAlg(solvedCube(), c.setups[0]);
  const rotated = applyAlg(solvedCube(), rotateSetup(c.setups[0], 1));
  assert.ok(
    ["", "U", "U2", "U'"].every(
      (auf) =>
        signature(applyAlg(fixed, auf), "PLL") !== signature(rotated, "PLL"),
    ),
  );
});

test("fixed-side practice keeps random setup and AUF selection", () => {
  const c = catalog[0];
  const choices = [3, 2];
  assert.equal(
    generateSetup(c, {}, () => choices.shift()),
    `${c.setups[3]} U'`,
  );
  assert.deepEqual(choices, []);
});

test("practice combines adjacent face turns and removes cascading cancellations", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const [original, expected] of [
    ["R B' B2", "R B"],
    ["R B B' R' F2 F2 U", "U"],
    ["B B2", "B'"],
    ["B' B'", "B2"],
    ["B2' B", "B'"],
  ]) {
    const setup = generateSetup({ setups: [original] }, {}, () => 0);
    assert.equal(setup, expected);
    assert.ok(
      puzzle
        .algToTransformation(setup)
        .isIdentical(puzzle.algToTransformation(original)),
    );
  }
  for (let face = 0; face < 6; face++) {
    const choices = [0, 3, 1, face];
    const setup = generateSetup(
      { setups: ["R U'"] },
      { randomLastLayer: true },
      () => choices.shift(),
    );
    assert.equal(setup, orientSetup("B U", face));
  }
});

test("invalid random bounds and unsupported setup notation fail explicitly", () => {
  for (const n of [0, -1, 1.5, Infinity])
    assert.throws(() => randomIndex(n), RangeError);
  assert.equal(randomIndex(1), 0);
  assert.throws(() => rotateSetup("M U M'", 1), /face turns/);
});

test("every catalog setup, color, side, and AUF remains the intended hidden case", async () => {
  const { assertOracleFacelets } = await import("./helpers/cube-oracle.js");
  const puzzle = await cube3x3x3.kpuzzle();
  const rotations = ["", "x", "x2", "x'", "z", "z'"];
  const aufs = ["", "U", "U'", "U2"];
  for (const c of catalog) {
    const expected = new Set();
    const reference = caseCube(c.algorithms[0].moves);
    for (let y = 0; y < 4; y++)
      for (const auf of aufs)
        expected.add(
          signature(applyAlg(reference, `${"y ".repeat(y)}${auf}`), c.section),
        );
    for (let index = 0; index < c.setups.length; index++)
      for (let side = 0; side < 4; side++) {
        for (let face = 0; face < 6; face++) {
          const rotation = rotations[face];
          const rotated = rotateSetup(c.setups[index], side);
          assertOracleFacelets(
            applyAlg(solvedCube(), orientSetup(rotated, face)),
            puzzle
              .defaultPattern()
              .applyAlg(`${rotation} ${rotated} ${inverse(rotation)}`),
            `${c.id} setup ${index} side ${side}`,
          );
          for (let aufIndex = 0; aufIndex < 4; aufIndex++) {
            const choices = [index, aufIndex, side, face];
            const setup = generateSetup(
              c,
              { randomLastLayer: true },
              (bound) => {
                const choice = choices.shift();
                assert.ok(choice >= 0 && choice < bound);
                return choice;
              },
            );
            assert.deepEqual(choices, []);
            const moves = setup.split(" ");
            for (let move = 1; move < moves.length; move++)
              assert.notEqual(moves[move][0], moves[move - 1][0], setup);
            const physical = applyAlg(solvedCube(), setup);
            assert.deepEqual(centers(physical), centers(solvedCube()));
            assertOracleFacelets(
              physical,
              puzzle
                .defaultPattern()
                .applyAlg(
                  `${rotation} ${rotated} ${aufs[aufIndex]} ${inverse(rotation)}`,
                ),
              `${c.id} face ${face} AUF ${aufIndex}`,
            );
            const cube = applyAlg(physical, rotation);
            const context = `${c.id} setup ${index} side ${side} face ${face} AUF ${aufs[aufIndex]}`;
            assert.ok(f2lSolved(cube), context);
            if (c.section === "PLL") assert.ok(topOriented(cube), context);
            assert.ok(expected.has(signature(cube, c.section)), context);
          }
        }
      }
  }
});

test("randomIndex retries rejected values to avoid modulo bias", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const values = [0xffffffff, 5];
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(array) {
        array[0] = values.shift();
        return array;
      },
    },
  });
  t.after(() => Object.defineProperty(globalThis, "crypto", original));
  assert.equal(randomIndex(3), 2);
  assert.deepEqual(values, [], "2^32 - 1 must be rejected for three options");
});

test("yellow last-layer choice retains side variation and can repeat", () => {
  const c = catalog.find((c) => c.id === "oll-27");
  const patterns = [];
  for (const side of [0, 1, 2, 3, 0]) {
    const choices = [0, 0, side, 0];
    const cube = applyAlg(
      solvedCube(),
      generateSetup(c, { randomLastLayer: true }, () => choices.shift()),
    );
    assert.equal(centers(cube).U, "U", "yellow center stays on top");
    assert.equal(centers(cube).F, "F", "green center stays in front");
    patterns.push(signature(cube, "OLL"));
  }
  assert.equal(
    new Set(patterns.slice(0, 4)).size,
    4,
    "asymmetric OLL changes alignment",
  );
  assert.equal(patterns[0], patterns[4], "independent choices may repeat");
});

test("last-layer choices put the PLL on all six colors", () => {
  const c = catalog.find((c) => c.id === "pll-T");
  const rotations = ["", "x", "x2", "x'", "z", "z'"];
  const colors = new Set();
  for (let face = 0; face < 6; face++) {
    const choices = [0, 1, 0, face];
    const cube = applyAlg(
      solvedCube(),
      generateSetup(c, { randomLastLayer: true }, () => choices.shift()),
    );
    const upright = applyAlg(cube, rotations[face]);
    assert.ok(f2lSolved(upright));
    assert.ok(topOriented(upright));
    colors.add(centers(upright).U);
    if (face !== 0)
      assert.equal(
        f2lSolved(cube),
        false,
        "case no longer occupies yellow layer",
      );
  }
  assert.equal(colors.size, 6);
});

test("saved side-color preference migrates and explicit new preference wins", async () => {
  const { loadPreferences, savePreferences } =
    await import("../src/preferences.js");
  let value = JSON.stringify({ randomSide: true });
  const storage = {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
  const preferences = loadPreferences(storage);
  assert.equal(preferences.randomLastLayer, true);
  assert.ok(savePreferences(preferences, storage));
  assert.equal(loadPreferences(storage).randomLastLayer, true);
  value = JSON.stringify({ randomSide: true, randomLastLayer: false });
  assert.equal(loadPreferences(storage).randomLastLayer, false);
});

test("practice avoids consecutive cases without changing the pool, and allows single-case repeats", async () => {
  const { choosePracticeCase } = await import("../src/practice.js");
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }];
  for (const previous of pool) {
    for (let index = 0; index < 2; index++) {
      let choices;
      const next = choosePracticeCase(pool, previous.id, (n) => {
        choices = n;
        return index;
      });
      assert.equal(choices, 2);
      assert.notEqual(next.id, previous.id);
      assert.ok(pool.includes(next));
    }
  }
  assert.equal(
    choosePracticeCase([pool[0]], "a", () => 0),
    pool[0],
  );
  assert.equal(
    choosePracticeCase([], "a", () => {
      throw Error("No empty sampling");
    }),
    null,
  );
  assert.equal(
    choosePracticeCase(pool, undefined, () => 2),
    pool[2],
  );
  assert.deepEqual(
    pool.map((c) => c.id),
    ["a", "b", "c"],
  );
});
