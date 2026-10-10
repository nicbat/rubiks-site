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
