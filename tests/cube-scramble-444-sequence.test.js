import { test } from "node:test";
import assert from "node:assert/strict";
import { joinFourByFourStages } from "../packages/cube-engine/scramble/four-by-four-sequence.js";
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  fourByFourStateToFacelets,
  FOUR_BY_FOUR_MOVES,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { assertNxNOracle } from "./helpers/nxn-oracle.js";
test("4x4 stage composition cancels only commuting turns, including across stage boundaries", () => {
  assert.equal(joinFourByFourStages(["R L R'", "L' U2 U"]), "U'");
  assert.equal(joinFourByFourStages(["R U", "U' R'"]), "");
  assert.equal(joinFourByFourStages(["Rw R Rw' R'"]), "");
  assert.equal(joinFourByFourStages(["R U R'"]), "R U R'");
  let seed = 0x44451;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  for (let i = 0; i < 50; i++) {
    const stages = Array.from({ length: 4 }, () =>
      Array.from({ length: 50 }, () => FOUR_BY_FOUR_MOVES[rand() % 36]).join(
        " ",
      ),
    );
    const result = joinFourByFourStages(stages);
    const state = applyFourByFourMoves(solvedFourByFourState(), result);
    assertNxNOracle(fourByFourStateToFacelets(state), stages.join(" "), 4);
    assert.ok(result.split(" ").length <= 200);
  }
});
test("4x4 internal composition retains bounded stage input contracts", () => {
  for (const stages of [
    null,
    ["x"],
    ["R\n"],
    ["R\r"],
    ["R\r\n"],
    ["R  U"],
    ["R ".repeat(513).trim()],
    ["", "", "", "", ""],
  ])
    assert.throws(() => joinFourByFourStages(stages), TypeError);
});
