import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyProgress,
  statusFor,
  validateProgress,
  dayKey,
} from "../src/progress.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const attempt = (
  day,
  result = "confident",
  mode = "recognition",
  variant = 0,
) => ({
  caseId: "pll-T",
  variant,
  result,
  mode,
  day,
  at: `${day}T12:00:00.000Z`,
});
test("confidence requires distinct recognition days, never repeated same-day attempts", () => {
  const p = emptyProgress();
  p.attempts = [
    attempt("2026-10-01"),
    attempt("2026-10-01"),
    attempt("2026-10-02"),
  ];
  assert.equal(statusFor(p, "pll-T").days, 2);
  assert.notEqual(statusFor(p, "pll-T").label, "Confident");
  p.attempts.push(attempt("2026-10-03"));
  assert.equal(statusFor(p, "pll-T").label, "Confident");
});
test("struggling resets confidence and rehearsal never earns it", () => {
  const p = emptyProgress();
  p.attempts = [
    attempt("2026-10-01"),
    attempt("2026-10-02"),
    attempt("2026-10-03"),
    attempt("2026-10-04", "help"),
  ];
  assert.equal(statusFor(p, "pll-T").days, 0);
  p.attempts.push(attempt("2026-10-05", "confident", "rehearsal"));
  assert.equal(statusFor(p, "pll-T").days, 0);
});
test("variants have independent confidence history", () => {
  const p = emptyProgress();
  p.attempts = [
    attempt("2026-10-01"),
    attempt("2026-10-02"),
    attempt("2026-10-03"),
  ];
  assert.equal(statusFor(p, "pll-T", 1).days, 0);
});
test("import round-trips and rejects invalid results and unknown cases", () => {
  const p = emptyProgress();
  p.selected = ["pll-T"];
  p.attempts = [attempt("2026-10-01")];
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p)), catalog), p);
  assert.throws(() => validateProgress({ ...p, selected: ["fake"] }, catalog));
  assert.throws(() =>
    validateProgress({ ...p, attempts: [attempt("bad date")] }, catalog),
  );
  assert.throws(() =>
    validateProgress({ ...p, variants: { "pll-T": 999 } }, catalog),
  );
  assert.throws(() =>
    validateProgress(
      { ...p, attempts: [{ ...attempt("2026-10-01"), result: "fake" }] },
      catalog,
    ),
  );
});
test("day keys use the local calendar", () =>
  assert.equal(dayKey(new Date(2026, 0, 3, 23, 59)), "2026-01-03"));

test("empty progress instances and validated imports do not share mutable state", () => {
  const a = emptyProgress(),
    b = emptyProgress();
  a.selected.push("pll-T");
  a.variants["pll-T"] = 0;
  a.attempts.push(attempt("2026-10-01"));
  assert.deepEqual(b, { version: 2, selected: [], variants: {}, attempts: [] });
  const imported = validateProgress(a, catalog);
  imported.selected.length = 0;
  imported.variants["pll-T"] = 1;
  imported.attempts[0].result = "help";
  assert.deepEqual(a.selected, ["pll-T"]);
  assert.equal(a.variants["pll-T"], 0);
  assert.equal(a.attempts[0].result, "confident");
});

test("status distinguishes selection, rehearsal, effort resets, and unrelated histories", () => {
  const p = emptyProgress();
  assert.deepEqual(statusFor(p, "pll-T"), {
    label: "Not started",
    days: 0,
    attempts: 0,
  });
  p.selected = ["pll-T"];
  assert.deepEqual(statusFor(p, "pll-T"), {
    label: "Learning",
    days: 0,
    attempts: 0,
  });
  p.attempts = [attempt("2026-10-01", "confident", "rehearsal")];
  assert.deepEqual(statusFor(p, "pll-T"), {
    label: "Needs practice",
    days: 0,
    attempts: 1,
  });
  p.attempts.push(
    attempt("2026-10-02"),
    attempt("2026-10-03"),
    attempt("2026-10-04", "effort"),
    attempt("2026-10-05"),
  );
  assert.equal(statusFor(p, "pll-T").days, 1);
  assert.equal(statusFor(p, "pll-Ua").attempts, 0);
  assert.equal(statusFor(p, "pll-T", 1).attempts, 0);
});

test("import rejects corrupt schemas, attempt fields, and reserved object keys", () => {
  const p = emptyProgress();
  for (const value of [
    null,
    [],
    {},
    { ...p, version: 1 },
    { ...p, selected: {} },
    { ...p, variants: [] },
    { ...p, attempts: null },
  ])
    assert.throws(() => validateProgress(value, catalog));
  for (const value of [
    null,
    false,
    {},
    { ...attempt("2026-10-01"), caseId: "fake" },
    { ...attempt("2026-10-01"), variant: -1 },
    { ...attempt("2026-10-01"), variant: 0.5 },
    { ...attempt("2026-10-01"), mode: "fake" },
    { ...attempt("2026-10-01"), at: 123 },
  ])
    assert.throws(() => validateProgress({ ...p, attempts: [value] }, catalog));
  for (const key of ["__proto__", "constructor", "prototype"])
    assert.throws(() =>
      validateProgress({ ...p, variants: JSON.parse(`{"${key}":0}`) }, catalog),
    );
  assert.equal({}.polluted, undefined);
});

test("import validates actual calendar dates and full timestamps", () => {
  for (const day of [
    "2026-02-29",
    "2026-02-30",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-04-31",
  ])
    assert.throws(
      () =>
        validateProgress(
          { ...emptyProgress(), attempts: [{ ...attempt("2026-10-01"), day }] },
          catalog,
        ),
      day,
    );
  for (const at of [
    "2026-02-30T12:00:00.000Z",
    "2026-10-01",
    "October 1, 2026",
    "2026-10-01T25:00:00.000Z",
  ])
    assert.throws(
      () =>
        validateProgress(
          { ...emptyProgress(), attempts: [{ ...attempt("2026-10-01"), at }] },
          catalog,
        ),
      at,
    );
  // Local day need not match UTC day, and leap days must remain valid.
  const valid = { ...attempt("2024-02-29"), at: "2024-03-01T01:00:00.000Z" };
  assert.deepEqual(
    validateProgress({ ...emptyProgress(), attempts: [valid] }, catalog)
      .attempts,
    [valid],
  );
});

test("nonchronological imports cannot turn an old success into renewed confidence", () => {
  const attempts = [
    attempt("2026-10-04", "help"),
    attempt("2026-10-01"),
    attempt("2026-10-03"),
    attempt("2026-10-02"),
  ];
  const imported = validateProgress({ ...emptyProgress(), attempts }, catalog);
  assert.equal(statusFor(imported, "pll-T").days, 0);
  assert.equal(statusFor(imported, "pll-T").label, "Needs practice");
  assert.deepEqual(
    attempts.map((a) => a.day),
    ["2026-10-04", "2026-10-01", "2026-10-03", "2026-10-02"],
    "validation must not mutate source records",
  );
});

test("import deduplicates selected cases and strips unrecognized metadata", () => {
  const imported = validateProgress(
    {
      ...emptyProgress(),
      selected: ["pll-T", "pll-T"],
      extra: "ignored",
      attempts: [{ ...attempt("2026-10-01"), html: "<script>" }],
    },
    catalog,
  );
  assert.deepEqual(imported.selected, ["pll-T"]);
  assert.equal(Object.hasOwn(imported, "extra"), false);
  assert.deepEqual(imported.attempts, [attempt("2026-10-01")]);
});

test("import rejects oversized attempt history", () => {
  assert.throws(
    () =>
      validateProgress(
        {
          ...emptyProgress(),
          attempts: Array(100001).fill(attempt("2026-10-01")),
        },
        catalog,
      ),
    /too many attempts/,
  );
});
