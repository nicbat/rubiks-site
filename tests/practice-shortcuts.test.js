import { test } from "node:test";
import assert from "node:assert/strict";
import { practiceRatingKey } from "../src/practice-shortcuts.js";

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
