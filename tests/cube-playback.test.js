import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import catalog from "../data/algorithms.json" with { type: "json" };
import { solvedCube, caseCube, isSolved } from "../src/cube.js";
import { createCubePlayback } from "../src/cube-playback.js";
import { cubeScene, layerTransform } from "../src/cube-player-view.js";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";
import { displayCube } from "../src/display-colors.js";

test("3D sticker colors retain inline priority through moves and display remapping", () => {
  const colors = {
    U: "#ffd84a",
    D: "#ffffff",
    F: "#47bba0",
    B: "#629ae0",
    R: "#f5a34b",
    L: "#ec665c",
  };
  for (const cube of [
    solvedCube(),
    caseCube("R U F"),
    displayCube(solvedCube(), "D"),
  ]) {
    const html = cubeScene(cube);
    const stickers = [
      ...html.matchAll(/data-color="([URFDLB])"[^>]*>(.*?)<\/i>/g),
    ];
    assert.equal(stickers.length, 54);
    for (const [, color, content] of stickers) {
      assert.equal(
        content,
        `<span class="cube-sticker" style="background-color:${colors[color]}!important"></span>`,
        `physical ${color} sticker keeps its literal color above extension styles`,
      );
    }
  }
});

test("player renders all 54 stickers against the independent oracle after every supported move", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const base of "U D R L F B r l u d f b Rw Lw Uw Dw Fw Bw M E S x y z".split(
    " ",
  )) {
    for (const suffix of ["", "'", "2"]) {
      const move = base + suffix;
      const player = createCubePlayback(solvedCube(), move);
      player.seek(1);
      const html = cubeScene(player.snapshot().cube);
      const stickers = [
        ...html.matchAll(
          /data-position="([^"]+)" data-normal="([^"]+)" data-color="([URFDLB])"/g,
        ),
      ].map(([, p, n, color]) => ({
        p: p.split(",").map(Number),
        n: n.split(",").map(Number),
        color,
      }));
      assert.equal(stickers.length, 54);
      assertOracleFacelets(
        stickers,
        puzzle.defaultPattern().applyAlg(move),
        move,
      );
    }
  }
});
test("playback pauses mid-turn, steps, seeks, loops cumulatively and protects snapshots", () => {
  const player = createCubePlayback(solvedCube(), "R U", { autoplay: true });
  player.tick(325);
  assert.equal(player.snapshot().fraction, 0.5);
  player.pause();
  player.tick(5000);
  assert.equal(player.snapshot().fraction, 0.5);
  player.seek(1);
  assert.equal(player.snapshot().move, "U");
  assert.equal(player.snapshot().fraction, 0);
  player.toggle();
  player.tick(1100);
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.snapshot().index, 2);
  player.toggle();
  assert.equal(player.snapshot().index, 0);
  player.snapshot().cube[0].color = "bad";
  assert.equal(player.snapshot().cube[0].color, "U");
  const loop = createCubePlayback(solvedCube(), "R", {
    loop: true,
    autoplay: true,
  });
  loop.tick(1100);
  assert.equal(loop.snapshot().index, 0);
  assert.ok(!isSolved(loop.snapshot().cube));
  loop.tick(3300);
  assert.ok(isSolved(loop.snapshot().cube));
  loop.reset();
  assert.equal(loop.snapshot().playing, false);
  assert.equal(layerTransform("R", 1), "rotateX(90deg)");
  assert.equal(layerTransform("U", 1), "rotateY(-90deg)");
  assert.equal(layerTransform("F'", 1), "rotateZ(-90deg)");
});
test("every catalog player reaches a solved cube and can return to the case", () => {
  for (const c of catalog)
    for (const a of c.algorithms) {
      const initial = caseCube(a.moves),
        player = createCubePlayback(initial, a.moves);
      player.seek(player.moves.length);
      assert.ok(isSolved(player.snapshot().cube), c.id);
      player.reset();
      assert.deepEqual(player.snapshot().cube, initial);
    }
});

test("animated layer endpoints match the oracle, including CSS coordinate handedness", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const base of "U D R L F B r l u d f b M E S x y z".split(" "))
    for (const suffix of ["", "'", "2"]) {
      const move = base + suffix;
      const [fixed, moving] = cubeScene(solvedCube(), move).split(
        '<div class="cube-layer">',
      );
      const [, axis, degrees] = layerTransform(move, 1).match(
        /rotate([XYZ])\((-?[\d.]+)deg\)/,
      );
      const angle = (Number(degrees) * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
      // Standard CSS rotation matrices, independent of the cube move table.
      const transform = ([x, up, z]) => {
        const y = -up;
        const v =
          axis === "X"
            ? [x, c * y - s * z, s * y + c * z]
            : axis === "Y"
              ? [c * x + s * z, y, -s * x + c * z]
              : [c * x - s * y, s * x + c * y, z];
        return v.map((value, i) => Math.round(value * (i === 1 ? -1 : 1)) || 0);
      };
      const stickers = [fixed, moving].flatMap((html, i) =>
        [
          ...html.matchAll(
            /data-position="([^"]+)" data-normal="([^"]+)" data-color="([URFDLB])"/g,
          ),
        ].map(([, p, n, color]) => ({
          p: i ? transform(p.split(",").map(Number)) : p.split(",").map(Number),
          n: i ? transform(n.split(",").map(Number)) : n.split(",").map(Number),
          color,
        })),
      );
      assertOracleFacelets(
        stickers,
        puzzle.defaultPattern().applyAlg(move),
        `animated ${move}`,
      );
    }
});

test("continuous notation repeats retain the previous result for every move and suffix", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  for (const base of "R U F L D B r u f l d b M E S x y z".split(" "))
    for (const suffix of ["", "'", "2"]) {
      const move = base + suffix;
      const player = createCubePlayback(solvedCube(), move, {
        loop: true,
        autoplay: true,
      });
      let expected = puzzle.defaultPattern();
      for (let i = 0; i < 9; i++) {
        player.tick(1100);
        expected = expected.applyAlg(move);
        assertOracleFacelets(
          player.snapshot().cube,
          expected,
          `${move} repetition ${i + 1}`,
        );
        assert.equal(player.snapshot().fraction, 0);
      }
      player.reset();
      assert.ok(isSolved(player.snapshot().cube));
    }
});

test("frame metadata omits cube copies and stays consistent across playback changes", () => {
  const player = createCubePlayback(solvedCube(), "R U", {
    loop: true,
    autoplay: true,
  });
  const check = () => {
    const { cube, ...metadata } = player.snapshot();
    assert.deepEqual(player.snapshot({ includeCube: false }), metadata);
    // Public cube snapshots must remain independent, including nested vectors.
    cube[0].p[0] = 99;
    cube[0].n[0] = 99;
    assert.notEqual(player.snapshot().cube[0].p[0], 99);
    assert.notEqual(player.snapshot().cube[0].n[0], 99);
  };
  check();
  player.tick(325);
  check();
  player.pause();
  check();
  player.seek(1);
  check();
  player.toggle();
  player.tick(2200);
  check();
  player.reset();
  check();
});

test("scene hides internal faces except those exposed by a layer turn", () => {
  for (const [move, expected] of [
    [undefined, 0],
    ["R", 17],
    ["Rw", 17],
    ["M", 34],
    ["x", 0],
  ]) {
    const html = cubeScene(solvedCube(), move);
    assert.equal(
      [...html.matchAll(/data-inner-normal="[^"]+" style="display:block/g)]
        .length,
      expected,
      move,
    );
    assert.equal(
      [...html.matchAll(/data-color="[URFDLB]" style="display:block/g)].length,
      54,
    );
  }
});
test("scrubbing lands mid-turn, pauses, clamps, and resumes from the scrubbed position", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const player = createCubePlayback(solvedCube(), "R U F", { autoplay: true });
  player.tick(200);
  player.scrub(1.5);
  let state = player.snapshot();
  assert.equal(state.playing, false);
  assert.equal(state.move, "U");
  assert.equal(state.fraction, 0.5);
  assert.equal(player.position(), 1.5);
  assertOracleFacelets(
    state.cube,
    puzzle.defaultPattern().applyAlg("R"),
    "scrub keeps completed moves only",
  );
  player.tick(5000);
  assert.equal(player.position(), 1.5);
  player.toggle();
  player.tick(325);
  assert.equal(player.snapshot().move, "U");
  assert.equal(player.snapshot().fraction, 1);
  player.scrub(99);
  state = player.snapshot();
  assert.equal(state.index, 3);
  assert.equal(state.fraction, 0);
  assert.equal(state.playing, false);
  assertOracleFacelets(
    state.cube,
    puzzle.defaultPattern().applyAlg("R U F"),
    "scrub to end",
  );
  player.scrub(-4);
  assert.equal(player.position(), 0);
  player.scrub(Number.NaN);
  assert.equal(player.position(), 0);
});
