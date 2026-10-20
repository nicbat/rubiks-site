import { test } from "node:test";
import assert from "node:assert/strict";
import { withCaseProperties } from "../src/bulk-properties.js";
import {
  emptyProgress,
  isKnown,
  statusFor,
  validateProgress,
} from "../src/progress.js";
import { recommendedVariant } from "../src/learning-methods.js";
import catalog from "../data/algorithms.json" with { type: "json" };

test("bulk properties set both fields for chosen variants without changing history or other cases", () => {
  const progress = {
    ...emptyProgress(),
    selected: ["oll-2"],
    variants: { "pll-Ua": 1 },
    known: { "pll-Ua": [0], "oll-2": [1] },
    twoLookKnown: { "pll-T": [0], "oll-2": [0] },
    attempts: [
      {
        caseId: "pll-T",
        variant: 0,
        mode: "rehearsal",
        result: "confident",
        day: "2026-10-01",
        at: "2026-10-01T12:00:00Z",
      },
    ],
  };
  const before = structuredClone(progress);
  const next = withCaseProperties(
    progress,
    [
      { id: "pll-Ua", variant: 1 },
      { id: "pll-T", variant: 0 },
    ],
    { known: "add", learningSet: "add" },
  );
  assert.deepEqual(next.selected, ["oll-2", "pll-Ua", "pll-T"]);
  assert.deepEqual(next.known, {
    "pll-Ua": [0, 1],
    "oll-2": [1],
    "pll-T": [0],
  });
  assert.deepEqual(next.twoLookKnown, { "oll-2": [0] });
  assert.equal(isKnown(next, "pll-T", 0, "two-look"), true);
  assert.equal(isKnown(next, "pll-Ua", 1, "full"), true);
  assert.equal(next.attempts, progress.attempts);
  assert.equal(next.variants, progress.variants);
  assert.deepEqual(progress, before);
  assert.deepEqual(validateProgress(next, catalog).known, next.known);
  // Reapplying sets explicit values; it never toggles mixed selections.
  assert.deepEqual(
    withCaseProperties(next, [{ id: "pll-Ua", variant: 1 }], {
      known: "add",
      learningSet: "add",
    }),
    next,
  );
});

test("bulk removals clear shared and legacy marks only for chosen variants and retain earned confidence", () => {
  const progress = {
    ...emptyProgress(),
    selected: ["pll-H", "pll-Ua", "oll-2"],
    known: { "pll-H": [0], "pll-Ua": [0, 1] },
    twoLookKnown: { "pll-H": [0], "pll-Ua": [1] },
    attempts: [1, 2, 3].map((day) => ({
      caseId: "pll-H",
      variant: 0,
      mode: "recognition",
      result: "confident",
      day: `2026-10-0${day}`,
      at: `2026-10-0${day}T12:00:00Z`,
    })),
  };
  const before = structuredClone(progress);
  const next = withCaseProperties(
    progress,
    [
      { id: "pll-H", variant: 0 },
      { id: "pll-Ua", variant: 1 },
    ],
    { known: "remove", learningSet: "remove" },
  );
  assert.deepEqual(next.selected, ["oll-2"]);
  assert.deepEqual(next.known, { "pll-Ua": [0] });
  assert.equal(next.twoLookKnown, undefined);
  assert.equal(isKnown(next, "pll-Ua", 0), true);
  assert.equal(isKnown(next, "pll-Ua", 1), false);
  assert.equal(statusFor(next, "pll-H", 0).label, "Confident");
  assert.equal(next.attempts, progress.attempts);
  assert.deepEqual(progress, before);
});

test("unchanged properties stay intact and two-look defaults identify the displayed variant", () => {
  const progress = emptyProgress();
  const c = catalog.find((c) => c.id === "oll-2");
  const variant = recommendedVariant(c, "two-look");
  const known = withCaseProperties(progress, [{ id: c.id, variant }], {
    known: "add",
  });
  assert.deepEqual(known.known, { [c.id]: [variant] });
  assert.equal(known.selected, progress.selected);
  const inSet = withCaseProperties(known, [{ id: c.id, variant }], {
    learningSet: "add",
  });
  assert.equal(inSet.known, known.known);
  assert.deepEqual(inSet.selected, [c.id]);
  assert.deepEqual(withCaseProperties(progress, []), progress);
  assert.throws(
    () => withCaseProperties(progress, [], { known: "toggle" }),
    /Invalid/,
  );
});
