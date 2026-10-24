import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hiddenPracticeCases,
  withRelearnedCase,
} from "../src/hidden-practice.js";
import { createProgressIndex } from "../src/progress-index.js";
import {
  emptyProgress,
  isKnown,
  statusFor,
  validateProgress,
} from "../src/progress.js";
import { recommendedVariant } from "../src/learning-methods.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const byId = new Map(catalog.map((c) => [c.id, c]));
const variant = (id, method = "full") =>
  recommendedVariant(byId.get(id), method);
const attempt = (id, day, method = "full", v = variant(id, method)) => ({
  id: `${id}-${day}-${method}`,
  caseId: id,
  variant: v,
  result: "confident",
  mode: "recognition",
  method,
  day: `2026-10-${day}`,
  at: `2026-10-${day}T12:00:00Z`,
});
function pool(progress, options = {}, index = createProgressIndex(progress)) {
  return hiddenPracticeCases(catalog, progress, options, index).map(
    (c) => c.id,
  );
}

test("known review includes explicit and earned knowledge outside the learning set", () => {
  const progress = emptyProgress();
  progress.selected = ["pll-Ua"];
  progress.known = { "pll-T": [variant("pll-T")] };
  progress.attempts = ["20", "21", "22"].map((day) => attempt("oll-27", day));
  assert.deepEqual(
    new Set(pool(progress, { source: "known" })),
    new Set(["pll-T", "oll-27"]),
  );
  assert.deepEqual(pool(progress, { source: "known", section: "OLL" }), [
    "oll-27",
  ]);
  assert.deepEqual(pool(progress, { source: "known", section: "PLL" }), [
    "pll-T",
  ]);
  assert.deepEqual(pool(progress), ["pll-Ua"]);
  assert.deepEqual(pool(progress, { section: "OLL" }), []);
  assert.deepEqual(progress.selected, ["pll-Ua"]);
  // A new difficult attempt removes earned confidence from future review pools.
  progress.attempts.push({ ...attempt("oll-27", "23"), result: "effort" });
  assert.deepEqual(pool(progress, { source: "known" }), ["pll-T"]);
});

test("review respects chosen variants, two-look scope, and recognition objectives", () => {
  const progress = emptyProgress();
  progress.variants["pll-Y"] = 1;
  progress.known = { "pll-Y": [0], "oll-5": [variant("oll-5")] };
  assert.deepEqual(pool(progress, { source: "known" }), ["oll-5"]);
  progress.known["pll-Y"].push(1);
  assert.deepEqual(pool(progress, { source: "known", method: "two-look" }), [
    "pll-Y",
  ]);
  progress.twoLookKnown = { "oll-45": [variant("oll-45", "two-look")] };
  assert.ok(
    pool(progress, { source: "known", method: "two-look" }).includes("oll-45"),
  );
  delete progress.twoLookKnown;
  progress.attempts = ["20", "21", "22"].map((day) =>
    attempt("oll-45", day, "two-look"),
  );
  assert.ok(
    pool(progress, { source: "known", method: "two-look" }).includes("oll-45"),
  );
  // A partial cross objective does not grant full-pattern confidence.
  assert.ok(!pool(progress, { source: "known" }).includes("oll-45"));
});

test("pool filtering uses the existing index without rereading history", () => {
  const progress = emptyProgress();
  progress.attempts = ["20", "21", "22"].map((day) => attempt("oll-27", day));
  const index = createProgressIndex(progress);
  progress.attempts = new Proxy([], {
    get() {
      throw Error("Do not rescan history");
    },
  });
  assert.deepEqual(pool(progress, { source: "known" }, index), ["oll-27"]);
});

test("relearning removes current and legacy Known marks, resets confidence, and retains history", () => {
  const progress = emptyProgress();
  progress.variants["oll-44"] = 1;
  progress.known = { "oll-44": [0, 1], "pll-T": [0] };
  progress.twoLookKnown = { "oll-44": [1] };
  progress.attempts = ["20", "21", "22"].map((day) =>
    attempt("oll-44", day, "two-look", 1),
  );
  const before = structuredClone(progress);
  const next = withRelearnedCase(
    progress,
    attempt("oll-44", "23", "two-look", 1),
  );
  assert.deepEqual(progress, before);
  assert.equal(isKnown(next, "oll-44", 1), false);
  assert.equal(isKnown(next, "oll-44", 0), true);
  assert.equal(isKnown(next, "pll-T", 0), true);
  assert.deepEqual(next.selected, ["oll-44"]);
  assert.deepEqual(next.attempts.slice(0, 3), before.attempts);
  assert.equal(next.attempts.at(-1).result, "help");
  assert.equal(statusFor(next, "oll-44", 1, "two-look").days, 0);
  assert.equal(
    createProgressIndex(next, "two-look").statusFor("oll-44", 1).label,
    "Needs practice",
  );
  assert.deepEqual(pool(next, { source: "known", method: "two-look" }), [
    "pll-T",
  ]);
  assert.deepEqual(
    validateProgress(JSON.parse(JSON.stringify(next)), catalog),
    next,
  );
  const again = withRelearnedCase(next, attempt("oll-44", "24", "two-look", 1));
  assert.deepEqual(again.selected, ["oll-44"]);
});

test("relearning an earned-confident case uses a real attempt rather than deleting confident days", () => {
  const progress = emptyProgress();
  progress.attempts = ["20", "21", "22"].map((day) => attempt("oll-27", day));
  assert.equal(
    statusFor(progress, "oll-27", variant("oll-27")).label,
    "Confident",
  );
  const next = withRelearnedCase(progress, attempt("oll-27", "23"));
  assert.deepEqual(pool(next, { source: "known" }), []);
  assert.equal(next.attempts.length, 4);
  assert.deepEqual(pool(next), ["oll-27"]);
});
