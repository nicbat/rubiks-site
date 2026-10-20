import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { createTestData } from "../src/test-data.js";
import { dayKey, statusFor, STORAGE_KEY } from "../src/progress.js";
import { SOLVES_KEY } from "../src/solve-history.js";
import { CUBES_KEY } from "../src/cubes.js";
import {
  validateBackup,
  restoreBackup,
  RESTORE_KEY,
} from "../src/training-backup.js";
import { createTrainingStorage } from "../src/training-storage.js";
import { loadPreferences, savePreferences } from "../src/preferences.js";

process.env.TZ = "America/Los_Angeles";
const now = new Date("2026-10-17T19:00:00Z");
const sample = () => createTestData(catalog, now);
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test("test data is repeatable, valid training history with meaningful dashboard variation", () => {
  const data = sample();
  assert.deepEqual(data, sample());
  assert.deepEqual(validateBackup(data, catalog), {
    progress: data.progress,
    solves: data.solves,
    cubeCollection: data.cubeCollection,
  });
  assert.ok(data.solves.length > 7000);
  assert.ok(data.progress.attempts.length > 2000);
  assert.ok(new Set(data.solves.map((s) => s.day)).size > 300);
  assert.ok(data.solves[0].day < "2025-10-17");
  assert.equal(data.solves.at(-1).day, dayKey(now));
  assert.equal(data.solves.filter((s) => s.day === dayKey(now)).length, 36);
  assert.deepEqual(
    new Set(data.solves.map((s) => s.penalty)),
    new Set([undefined, "+2", "dnf"]),
  );
  assert.deepEqual(
    new Set(data.solves.map((s) => s.cubeId)),
    new Set([...data.cubeCollection.cubes.map((c) => c.id), null]),
  );
  assert.ok(data.solves.some((s) => s.notes?.includes("\n")));
  const mean = (solves) =>
    solves.reduce((sum, s) => sum + s.elapsed, 0) / solves.length;
  assert.ok(
    mean(data.solves.slice(0, 100)) > mean(data.solves.slice(-100)) + 15000,
  );
  const statuses = new Set(
    catalog.map(
      (c) => statusFor(data.progress, c.id, data.progress.variants[c.id]).label,
    ),
  );
  assert.deepEqual(
    statuses,
    new Set([
      "Already known",
      "Confident",
      "Needs practice",
      "Learning",
      "Not started",
    ]),
  );
  assert.ok(data.progress.attempts.some((a) => a.method === "two-look"));
  assert.ok(data.progress.attempts.some((a) => a.mode === "rehearsal"));
  assert.ok(Object.values(data.progress.variants).some((v) => v > 0));
});

test("backfill preserves local dates across DST, leap days, and a near-midnight anchor", () => {
  for (const anchor of [
    now,
    new Date("2024-03-11T07:01:00Z"),
    new Date("2026-11-03T08:01:00Z"),
  ]) {
    const data = createTestData(catalog, anchor);
    for (const [rows, field] of [
      [data.solves, "date"],
      [data.progress.attempts, "at"],
    ]) {
      let previous = -Infinity;
      for (const row of rows) {
        const at = new Date(row[field]);
        assert.equal(row.day, dayKey(at));
        assert.ok(+at <= +anchor);
        assert.ok(+at >= previous);
        previous = +at;
      }
    }
  }
});

test("sandbox saves, full imports, learning imports, and day replacements never touch personal bytes", () => {
  const real = memoryStorage();
  const keys = [STORAGE_KEY, SOLVES_KEY, CUBES_KEY, RESTORE_KEY];
  // Even an interrupted/corrupt personal restore is untouched while using test data.
  keys.forEach((key) => real.setItem(key, `personal bytes: ${key}`));
  const before = keys.map((key) => real.getItem(key));
  const source = createTrainingStorage(real, sample, true);
  assert.ok(JSON.parse(source.getItem(SOLVES_KEY)).length > 7000);
  source.setItem(SOLVES_KEY, "[]");
  const replacement = sample();
  replacement.solves = replacement.solves.slice(-5);
  restoreBackup(source.target, replacement);
  assert.equal(JSON.parse(source.getItem(SOLVES_KEY)).length, 5);
  restoreBackup(source.target, {
    progress: { ...replacement.progress, attempts: [] },
  });
  assert.equal(JSON.parse(source.getItem(STORAGE_KEY)).attempts.length, 0);
  assert.equal(JSON.parse(source.getItem(SOLVES_KEY)).length, 5);
  restoreBackup(source.target, {
    ...replacement,
    solves: [],
    progress: { ...replacement.progress, attempts: [] },
  });
  assert.equal(source.getItem(SOLVES_KEY), "[]");
  assert.deepEqual(
    keys.map((key) => real.getItem(key)),
    before,
  );
  source.setTestData(false);
  assert.equal(source.target, real);
  source.setTestData(true);
  assert.equal(
    source.getItem(SOLVES_KEY),
    "[]",
    "same tab retains sandbox edits",
  );
  const reloaded = createTrainingStorage(real, sample, true);
  assert.ok(
    JSON.parse(reloaded.getItem(SOLVES_KEY)).length > 7000,
    "reload regenerates samples",
  );
});

test("test mode works with unavailable personal storage and never sends sandbox saves to it", () => {
  const unavailable = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  const source = createTrainingStorage(unavailable, sample, true);
  assert.ok(source.getItem(STORAGE_KEY));
  source.setItem(SOLVES_KEY, "[]");
  restoreBackup(source.target, sample());
  source.setTestData(false);
  assert.throws(() => source.getItem(STORAGE_KEY), /blocked/);
});

test("test mode defaults off, requires a boolean, and persists independently of training data", () => {
  const storage = memoryStorage();
  assert.equal(loadPreferences(storage).testData, false);
  savePreferences({ testData: "true" }, storage);
  assert.equal(loadPreferences(storage).testData, false);
  savePreferences({ testData: true }, storage);
  assert.equal(loadPreferences(storage).testData, true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
