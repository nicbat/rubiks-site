import { test } from "node:test";
import assert from "node:assert/strict";
import { cube3x3x3 } from "cubing/puzzles";
import { renderCubePlayer, createPlayerPlayback } from "../src/cube-player.js";
import { isSolved } from "../src/cube.js";
import { assertOracleFacelets } from "./helpers/cube-oracle.js";

test("public player modes bind controls to the intended cube state and playback", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const notation = { id: "notation", mode: "notation", algorithm: "R" };
  const repeated = createPlayerPlayback(notation);
  repeated.tick(2200);
  assertOracleFacelets(
    repeated.snapshot().cube,
    puzzle.defaultPattern().applyAlg("R2"),
    "notation repeats",
  );
  assert.equal(
    createPlayerPlayback(notation, { reducedMotion: true }).snapshot().playing,
    false,
  );
  const notationMarkup = renderCubePlayer(notation);
  assert.equal((notationMarkup.match(/<button /g) || []).length, 1);
  assert.doesNotMatch(
    notationMarkup,
    /cube-next|cube-previous|cube-moves|cube-scrubber/,
  );

  const algorithm = { id: "case", mode: "algorithm", algorithm: "R U R' U'" };
  const player = createPlayerPlayback(algorithm);
  assert.equal(player.snapshot().playing, false);
  assert.ok(!isSolved(player.snapshot().cube));
  player.seek(player.moves.length);
  assert.ok(isSolved(player.snapshot().cube));
  assert.match(renderCubePlayer(algorithm), /cube-next/);
  assert.match(
    renderCubePlayer(algorithm),
    /<input class="cube-scrubber" type="range" min="0" max="4"/,
  );

  const scramble = { id: "timer", mode: "scramble", algorithm: "F2 R U' L D2" };
  const preview = createPlayerPlayback(scramble);
  assertOracleFacelets(
    preview.snapshot().cube,
    puzzle.defaultPattern().applyAlg(scramble.algorithm),
    "scramble result",
  );
  assert.equal(preview.snapshot().playing, false);
  assert.deepEqual(preview.moves, []);
  assert.doesNotMatch(
    renderCubePlayer(scramble),
    /cube-toggle|cube-next|cube-moves|cube-scrubber/,
  );
});

test("public API rejects ambiguous modes and safely encodes stable instance ids", () => {
  const config = { id: 'case"<x>', mode: "notation", algorithm: "R'" };
  assert.match(
    renderCubePlayer(config),
    /data-player-id="case&quot;&lt;x&gt;"/,
  );
  assert.throws(
    () => renderCubePlayer({ ...config, mode: "unknown" }),
    /Unknown cube player mode/,
  );
  assert.throws(
    () => createPlayerPlayback({ ...config, mode: "unknown" }),
    /Unknown cube player mode/,
  );
  assert.throws(
    () => renderCubePlayer({ mode: "notation", algorithm: "R" }),
    /stable id/,
  );
});

test("algorithm playback keeps turns readable with a shorter pause between moves", () => {
  const player = createPlayerPlayback({ mode: "algorithm", algorithm: "R U" });
  player.toggle();
  player.tick(650);
  assert.equal(player.snapshot().fraction, 1);
  assert.equal(player.snapshot().index, 0);
  player.tick(100);
  assert.equal(player.snapshot().index, 1);
  assert.equal(player.snapshot().fraction, 0);
  player.tick(325);
  assert.equal(player.snapshot().fraction, 0.5);
});

test("lessons play an explicit setup toward a partial solution and remain paused at the end", async () => {
  const puzzle = await cube3x3x3.kpuzzle();
  const lesson = {
    id: "pair-insertion",
    mode: "lesson",
    setup: "U R U' R'",
    algorithm: "R U R'",
  };
  const player = createPlayerPlayback(lesson);
  assert.equal(player.snapshot().playing, false);
  assertOracleFacelets(
    player.snapshot().cube,
    puzzle.defaultPattern().applyAlg(lesson.setup),
    "explicit lesson starting state",
  );
  player.toggle();
  player.tick(750);
  assert.equal(player.snapshot().index, 1);
  assertOracleFacelets(
    player.snapshot().cube,
    puzzle.defaultPattern().applyAlg("U R U'"),
    "first lesson step",
  );
  player.tick(10000);
  assert.equal(player.snapshot().index, 3);
  assert.equal(player.snapshot().playing, false);
  assertOracleFacelets(
    player.snapshot().cube,
    puzzle.defaultPattern().applyAlg("U"),
    "solved cross and first two layers with an unsolved last layer",
  );
  assert.equal(isSolved(player.snapshot().cube), false);
  player.reset();
  assert.equal(player.snapshot().index, 0);
  assertOracleFacelets(
    player.snapshot().cube,
    puzzle.defaultPattern().applyAlg(lesson.setup),
    "reset restores the lesson setup",
  );
  const markup = renderCubePlayer(lesson);
  assert.match(markup, /data-setup="U R U&#39; R&#39;"/);
  assert.match(markup, /cube-next/);
  assert.match(markup, /cube-previous/);
  assert.match(markup, /cube-scrubber/);
});

test("lessons require a string setup, allow a solved start, and escape setup markup", () => {
  const config = { id: "lesson", mode: "lesson", algorithm: "R" };
  for (const setup of [undefined, null, 42]) {
    assert.throws(() => createPlayerPlayback({ ...config, setup }), /setup/);
    assert.throws(() => renderCubePlayer({ ...config, setup }), /setup/);
  }
  assert.ok(
    isSolved(createPlayerPlayback({ ...config, setup: "" }).snapshot().cube),
  );
  assert.match(
    renderCubePlayer({ ...config, setup: 'R "<x>' }),
    /data-setup="R &quot;&lt;x&gt;"/,
  );
});
