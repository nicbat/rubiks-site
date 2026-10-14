import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyProgress,
  isKnown,
  setKnown,
  statusFor,
  validateProgress,
} from "../src/progress.js";
import { createProgressIndex } from "../src/progress-index.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);

test("known marks are reversible per variant and do not invent practice or selection", () => {
  const progress = emptyProgress();
  setKnown(progress, "oll-2", 0, true);
  setKnown(progress, "oll-2", 0, true);
  assert.deepEqual(progress.known, { "oll-2": [0] });
  assert.equal(isKnown(progress, "oll-2", 1), false);
  assert.deepEqual(progress.attempts, []);
  assert.deepEqual(progress.selected, []);
  assert.deepEqual(statusFor(progress, "oll-2"), {
    label: "Already known",
    days: 0,
    attempts: 0,
  });
  const index = createProgressIndex(progress);
  assert.deepEqual(index.statusFor("oll-2"), statusFor(progress, "oll-2"));
  assert.equal(index.practiceDays, 0);
  setKnown(progress, "oll-2", 0, false);
  assert.deepEqual(progress, emptyProgress());
  assert.equal(
    index.isKnown("oll-2"),
    true,
    "existing snapshot remains independent",
  );
  assert.equal(createProgressIndex(progress).isKnown("oll-2"), false);
});

test("unmarking restores earned confidence without changing history", () => {
  const progress = emptyProgress();
  progress.attempts = [1, 2, 3].map((day) => ({
    caseId: "oll-2",
    variant: 0,
    mode: "recognition",
    result: "confident",
    day: `2026-10-0${day}`,
    at: `2026-10-0${day}T12:00:00Z`,
  }));
  const history = structuredClone(progress.attempts);
  setKnown(progress, "oll-2", 0, true);
  assert.equal(statusFor(progress, "oll-2").label, "Already known");
  setKnown(progress, "oll-2", 0, false);
  assert.equal(statusFor(progress, "oll-2").label, "Confident");
  assert.deepEqual(progress.attempts, history);
});

test("known marks round-trip, reject malformed data and accept unmarked version-2 exports", () => {
  const old = emptyProgress();
  assert.deepEqual(validateProgress(old, catalog), old);
  const progress = { ...old, known: { "oll-2": [1, 0, 1] } };
  const imported = validateProgress(progress, catalog);
  assert.deepEqual(imported.known, { "oll-2": [0, 1] });
  imported.known["oll-2"].pop();
  assert.deepEqual(progress.known["oll-2"], [1, 0, 1]);
  for (const known of [
    null,
    [],
    "yes",
    { fake: [0] },
    { "oll-2": [999] },
    { "oll-2": [-1] },
    { "oll-2": ["0"] },
    { "oll-2": true },
  ]) {
    assert.throws(() => validateProgress({ ...old, known }, catalog));
  }
  assert.deepEqual(
    validateProgress({ ...old, known: { "oll-2": [] } }, catalog),
    old,
  );
});

test("legacy two-look marks are learned in both views and can be cleared without changing recognition history", () => {
  const p = validateProgress(
    {
      ...emptyProgress(),
      twoLookKnown: { "pll-T": [0], "oll-2": [0, 1] },
      known: { "pll-T": [0] },
      attempts: [
        {
          caseId: "pll-T",
          variant: 0,
          method: "two-look",
          mode: "recognition",
          result: "confident",
          day: "2026-10-01",
          at: "2026-10-01T12:00:00Z",
        },
      ],
    },
    catalog,
  );
  const before = structuredClone(p.attempts);
  for (const method of ["full", "two-look"]) {
    assert.equal(isKnown(p, "pll-T", 0, method), true);
    assert.equal(
      createProgressIndex(p).statusFor("pll-T", 0, method).label,
      "Already known",
    );
  }
  assert.equal(createProgressIndex(p).statusFor("pll-T", 0, "full").days, 0);
  assert.equal(
    createProgressIndex(p).statusFor("pll-T", 0, "two-look").days,
    1,
  );
  setKnown(p, "pll-T", 0, false, "full");
  assert.equal(isKnown(p, "pll-T", 0, "two-look"), false);
  assert.equal(p.known, undefined);
  assert.deepEqual(p.twoLookKnown, { "oll-2": [0, 1] });
  setKnown(p, "oll-2", 1, true, "two-look");
  assert.deepEqual(p.known, { "oll-2": [1] });
  assert.deepEqual(p.twoLookKnown, { "oll-2": [0] });
  assert.equal(createProgressIndex(p).isKnown("oll-2", 2), false);
  assert.deepEqual(p.attempts, before);
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p)), catalog), p);
});
