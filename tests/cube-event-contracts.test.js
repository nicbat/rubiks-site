import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_IDS,
  PUZZLE_IDS,
  CUBE_EVENT_REGISTRY,
  COMING_SOON_EVENTS,
  getCubeEvent,
  isEventId,
} from "../src/cube-events.js";
import {
  validateEventScramble,
  validateScrambleGrip,
  validateScrambleResult,
  createScrambleError,
} from "@last-layer/cube-engine/scramble";

test("ten stable recordable identities share puzzles without making coming-soon events recordable", () => {
  assert.deepEqual(EVENT_IDS, [
    "222",
    "333",
    "444",
    "555",
    "666",
    "777",
    "333oh",
    "333bf",
    "444bf",
    "555bf",
  ]);
  assert.deepEqual(PUZZLE_IDS, ["2x2", "3x3", "4x4", "5x5", "6x6", "7x7"]);
  assert.equal(getCubeEvent("333oh").puzzleId, "3x3");
  assert.equal(getCubeEvent("444bf").puzzleId, "4x4");
  assert.ok(CUBE_EVENT_REGISTRY.every((e) => e.availability === "planned"));
  for (const event of COMING_SOON_EVENTS) {
    assert.equal(isEventId(event.id), false);
    assert.throws(() => validateEventScramble(event.id, "R"), {
      code: "UNSUPPORTED_EVENT",
    });
  }
  assert.equal(isEventId("toString"), false);
  assert.throws(() => {
    getCubeEvent("333").puzzleId = "2x2";
  }, TypeError);
});

test("bounded competition notation is puzzle-aware and never normalizes bytes", () => {
  const cases = [
    ["222", "R U2 F'"],
    ["333", "R U2 F'"],
    ["333oh", "R U2 F'"],
    ["444", "Rw U2 F'"],
    ["555", "2Rw U2 F'"],
    ["666", "3Rw U2 F'"],
    ["777", "3Fw U2 R'"],
    ["333bf", "R U2 x y'"],
    ["444bf", "Rw U2 x2"],
    ["555bf", "Fw U2 z'"],
  ];
  for (const [id, algorithm] of cases)
    assert.equal(validateEventScramble(id, algorithm), algorithm);
  for (const [id, algorithm] of [
    ["333", "Rw U"],
    ["333oh", "x R"],
    ["222", "Rw"],
    ["444", "3Rw"],
    ["777", "4Rw"],
    ["444", "02Rw"],
    ["333", "R  U"],
    ["333", " R"],
    ["333", "R\nU"],
    ["333", "R\n"],
    ["444", "Rw\r"],
    ["333bf", "x\n"],
    ["333", ""],
    ["333", "M"],
    ["333", "R3"],
    ["333bf", "x2'"],
    ["777", "R ".repeat(512) + "U"],
  ])
    assert.throws(() => validateEventScramble(id, algorithm));
});

test("grip accepts exactly the 24 legal starting orientations and rejects prototype keys", () => {
  const colors = ["white", "yellow", "green", "blue", "red", "orange"];
  let accepted = 0;
  for (const up of colors)
    for (const front of colors) {
      try {
        validateScrambleGrip({ up, front });
        accepted++;
      } catch {}
    }
  assert.equal(accepted, 24);
  for (const grip of [
    { up: "white", front: "yellow" },
    { up: "green", front: "green" },
    { up: "toString", front: "red" },
    { up: ["white"], front: ["yellow"] },
    { up: "white", front: ["green"] },
    { up: { toString: () => "white" }, front: "green" },
    { up: 1, front: "green" },
    null,
  ])
    assert.throws(() => validateScrambleGrip(grip));
});

test("generation result validation binds event, puzzle and detached provenance", () => {
  const result = {
    eventId: "444bf",
    puzzleId: "4x4",
    algorithm: "Rw U x",
    generator: { id: "test-only", version: "v1", method: "random-state" },
    grip: { up: "white", front: "green" },
  };
  const copy = validateScrambleResult(result, "444bf");
  result.grip.up = "red";
  result.generator.version = "changed";
  assert.equal(copy.grip.up, "white");
  assert.equal(copy.generator.version, "v1");
  assert.throws(() => validateScrambleResult(copy, "333"));
  assert.throws(() => validateScrambleResult({ ...copy, puzzleId: "3x3" }));
  assert.throws(() =>
    validateScrambleResult({
      ...copy,
      generator: { ...copy.generator, method: "official" },
    }),
  );
  assert.throws(() =>
    validateScrambleResult({
      ...copy,
      generator: { ...copy.generator, id: "\n" },
    }),
  );
  assert.equal(createScrambleError("ABORTED").name, "AbortError");
  assert.equal(
    createScrambleError("GENERATION_FAILED").code,
    "GENERATION_FAILED",
  );
});
