import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import {
  courses,
  modules,
  moduleById,
  moduleCases,
  moduleProgress,
} from "../src/courses.js";
import {
  emptyProgress,
  setKnown,
  setTransfer,
  statusFor,
  validateProgress,
} from "../src/progress.js";
import { createProgressIndex } from "../src/progress-index.js";
import { recommendedVariant } from "../src/learning-methods.js";
import { tokens } from "../src/cube.js";

const attempts = (caseId, method, variant = 0) =>
  [1, 2, 3].map((day) => ({
    caseId,
    method,
    variant,
    day: `2026-10-0${day}`,
    at: `2026-10-0${day}T12:00:00Z`,
    mode: "recognition",
    result: "confident",
  }));

test("courses share F2L references, resolve all modules, and scope practice to their puzzle and curriculum", () => {
  assert.equal(new Set(courses.map((c) => c.id)).size, courses.length);
  assert.equal(new Set(modules.map((m) => m.id)).size, modules.length);
  for (const course of courses)
    for (const id of course.modules) {
      assert.ok(moduleById(id));
      assert.equal(moduleById(id).puzzle, course.puzzle);
    }
  assert.equal(courses.filter((c) => c.modules.includes("f2l")).length, 1);
  assert.deepEqual(
    moduleCases(moduleById("two-look-pll"), catalog).map((c) => c.id),
    ["pll-T", "pll-Y", "pll-Ua", "pll-Ub", "pll-H", "pll-Z"],
  );
  assert.equal(moduleCases(moduleById("full-oll"), catalog).length, 57);
  assert.deepEqual(moduleCases(moduleById("bld-foundations"), catalog), []);
});

test("cross-oriented OLL and edge-only PLL share earned recognition without duplicating attempts", () => {
  for (const id of [
    "oll-27",
    "oll-26",
    "oll-21",
    "oll-22",
    "oll-23",
    "oll-24",
    "oll-25",
    "pll-Ua",
    "pll-Ub",
    "pll-H",
    "pll-Z",
  ]) {
    const p = { ...emptyProgress(), attempts: attempts(id, "two-look") };
    const index = createProgressIndex(p);
    assert.equal(index.statusFor(id, 0, "full").label, "Confident");
    assert.equal(index.statusFor(id, 0, "two-look").days, 3);
    assert.equal(index.attemptsOn("2026-10-01"), 1);
    assert.equal(index.statusFor(id, 1, "full").days, 0);
    setKnown(p, id, 0, true, "two-look");
    assert.equal(createProgressIndex(p).isKnown(id, 0, "full"), true);
  }
});

test("partial recognition stays separate; explicit links transfer and undo without destroying source history", () => {
  for (const id of ["oll-45", "oll-44", "oll-2", "pll-T", "pll-Y"]) {
    const p = { ...emptyProgress(), attempts: attempts(id, "two-look") };
    const original = structuredClone(p.attempts);
    let index = createProgressIndex(p);
    assert.equal(index.isFamiliar(id), true);
    assert.equal(index.statusFor(id, 0, "full").days, 0);
    assert.equal(index.statusFor(id, 0, "two-look").days, 3);
    setTransfer(p, id, 0, "full", true);
    index = createProgressIndex(p);
    assert.equal(index.statusFor(id, 0, "full").label, "Confident");
    assert.deepEqual(index.statusFor(id), statusFor(p, id));
    assert.equal(index.attemptsOn("2026-10-01"), 1);
    assert.equal(index.statusFor(id, 1).days, 0);
    p.attempts.push({
      ...attempts(id, "full")[0],
      day: "2026-10-04",
      at: "2026-10-04T12:00:00Z",
      result: "help",
    });
    assert.equal(createProgressIndex(p).statusFor(id).days, 0);
    setTransfer(p, id, 0, "full", false);
    assert.equal(createProgressIndex(p).statusFor(id, 0, "two-look").days, 3);
    assert.deepEqual(p.attempts.slice(0, 3), original);
  }
});

test("known marks are shared across methods, independent of links and other variants", () => {
  const p = emptyProgress();
  setKnown(p, "oll-2", 1, true, "two-look");
  let index = createProgressIndex(p);
  assert.equal(index.isFamiliar("oll-2", 1), true);
  assert.equal(index.isKnown("oll-2", 1), true);
  setTransfer(p, "oll-2", 1, "full", true);
  setTransfer(p, "oll-2", 1, "two-look", true);
  index = createProgressIndex(p);
  assert.equal(index.isKnown("oll-2", 1), true);
  assert.equal(index.isKnown("oll-2", 0), false);
  setKnown(p, "oll-2", 1, false, "two-look");
  assert.equal(createProgressIndex(p).isKnown("oll-2", 1), false);
  assert.equal(
    index.isKnown("oll-2", 1),
    true,
    "prior snapshots remain unchanged",
  );
});

test("shared module review and algorithm counts use actual objectives and chosen variants", () => {
  const p = { ...emptyProgress(), reviewed: ["f2l"], variants: { "oll-2": 0 } };
  setKnown(p, "oll-27", 0, true);
  setKnown(p, "oll-2", 1, true, "two-look");
  const index = createProgressIndex(p);
  const variant = (c, method) =>
    p.variants[c.id] ?? recommendedVariant(c, method);
  assert.deepEqual(
    moduleProgress(moduleById("f2l"), p, index, catalog, variant),
    { done: 1, total: 1, unit: "guide reviewed" },
  );
  assert.deepEqual(
    moduleProgress(moduleById("two-look-oll"), p, index, catalog, variant),
    { done: 1, total: 10, unit: "cases learned" },
  );
  assert.equal(
    moduleProgress(moduleById("full-oll"), p, index, catalog, variant).done,
    1,
  );
});

test("version-2 backups round-trip course state and reject invalid links, lessons, methods and old schemas", () => {
  const p = {
    ...emptyProgress(),
    activeCourse: "cfop",
    resume: { cfop: "two-look-oll" },
    reviewed: ["f2l", "ortega-oll"],
    attempts: attempts("oll-45", "two-look"),
  };
  setKnown(p, "oll-45", 0, true, "two-look");
  setTransfer(p, "oll-45", 0, "full", true);
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p)), catalog), p);
  for (const bad of [
    { ...p, version: 1 },
    { ...p, activeCourse: "__proto__" },
    { ...p, reviewed: ["fake"] },
    { ...p, resume: { blindfolded: "full-oll" } },
    { ...p, resume: [] },
    { ...p, transfers: [{ caseId: "oll-27", variant: 0, method: "full" }] },
    { ...p, transfers: [{ caseId: "oll-45", variant: 999, method: "full" }] },
    { ...p, transfers: [{ caseId: "oll-45", variant: 0, method: "other" }] },
    { ...p, transfers: [...p.transfers, ...p.transfers] },
    { ...p, twoLookKnown: { "oll-27": [0] } },
    { ...p, attempts: attempts("oll-1", "two-look") },
  ])
    assert.throws(() => validateProgress(bad, catalog));
  const input = structuredClone(p);
  const parsed = validateProgress(input, catalog);
  parsed.reviewed.push("cross");
  parsed.transfers[0].method = "two-look";
  assert.deepEqual(input, p);
});

test("blindfolded is coming soon; 2×2 review grants no 3×3 mastery", () => {
  const bld = courses.find((c) => c.id === "blindfolded");
  assert.equal(bld.status, "coming-soon");
  assert.equal(courses.find((c) => c.id === "ortega").status, "coming-soon");
  assert.deepEqual(bld.modules, []);
  const p = {
    ...emptyProgress(),
    reviewed: moduleById("ortega-reference").lessons.map((l) => l.id),
  };
  assert.equal(createProgressIndex(p).isFamiliar("pll-T"), false);
  assert.equal(p.attempts.length, 0);
});
