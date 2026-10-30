import { test } from "node:test";
import assert from "node:assert/strict";
import {
  practiceRatingKey,
  practiceShortcut,
} from "../src/practice-shortcuts.js";

const answer = { mode: "recognition", stage: "answer", hinted: false };
test("rating keys apply only to revealed recognition and retain help grading", () => {
  assert.deepEqual(
    ["1", "2", "3"].map((key) => practiceRatingKey({ key }, answer)),
    ["help", "effort", "confident"],
  );
  for (const session of [
    null,
    { ...answer, stage: "setup" },
    { ...answer, mode: "rehearsal" },
  ])
    for (const key of ["1", "2", "3"])
      assert.equal(practiceRatingKey({ key }, session), null);
  for (const key of ["0", "4", "Enter", " "])
    assert.equal(practiceRatingKey({ key }, answer), null);
  assert.equal(
    practiceRatingKey({ key: "1" }, { ...answer, hinted: true }),
    "help",
  );
  for (const key of ["2", "3"])
    assert.equal(practiceRatingKey({ key }, { ...answer, hinted: true }), null);
});
test("rating shortcuts yield to repeats, modifiers, composition, overlays and editing", () => {
  for (const flag of [
    "defaultPrevented",
    "repeat",
    "isComposing",
    "ctrlKey",
    "metaKey",
    "altKey",
    "shiftKey",
    "blocked",
    "editable",
  ])
    for (const key of ["1", "2", "3"])
      assert.equal(
        practiceRatingKey({ key, [flag]: true }, answer),
        null,
        `${flag} owns ${key}`,
      );
});

test("R/H reveal or help only during setup with the same input guards", () => {
  const setup = { mode: "recognition", stage: "setup" };
  assert.deepEqual(practiceShortcut({ key: "r" }, setup), {
    action: "finished",
  });
  assert.deepEqual(practiceShortcut({ key: "h" }, setup), { action: "hint" });
  for (const key of ["r", "h"]) {
    assert.equal(practiceShortcut({ key }, answer), null);
    for (const flag of [
      "editable",
      "blocked",
      "repeat",
      "ctrlKey",
      "altKey",
      "metaKey",
      "shiftKey",
      "isComposing",
      "defaultPrevented",
    ])
      assert.equal(practiceShortcut({ key, [flag]: true }, setup), null);
  }
  assert.deepEqual(practiceShortcut({ key: "3" }, answer), {
    action: "rate",
    result: "confident",
  });
});
