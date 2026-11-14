import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";
import { trainingBackup } from "../src/training-backup.js";
import { canonical, mergeTraining } from "../src/training-merge.js";
import {
  normalizeTrainingSnapshot,
  trainingFingerprint,
  readTrainingBaseline,
  prepareTrainingReconciliation,
} from "../src/training-schema.js";
const fixture = () =>
  trainingBackup(
    emptyProgress(),
    [
      {
        id: "legacy",
        date: "2026-10-01T00:00:00Z",
        day: "2026-09-30",
        elapsed: 5000,
        scramble: "R U R U R U R U R U R U R U R U R U R U",
      },
    ],
    { cubes: [], defaultId: null },
  );
const hash = (value) =>
  createHash("sha256").update(canonical(value)).digest("hex");

test("baseline verifies original v1 fingerprint before migrating to a new hash", async () => {
  const payload = fixture(),
    fingerprint = hash(payload);
  const original = structuredClone(payload);
  const result = await readTrainingBaseline(
    { revision: 7, payload, fingerprint },
    catalog,
  );
  assert.equal(result.sourceVersion, 1);
  assert.equal(result.revision, 7);
  assert.equal(result.sourceFingerprint, fingerprint);
  assert.equal(result.payload.version, 2);
  assert.notEqual(result.fingerprint, fingerprint);
  assert.equal(result.fingerprint, hash(result.payload));
  assert.equal(await trainingFingerprint(payload), fingerprint);
  assert.deepEqual(payload, original);
  assert.equal(result.payload.solves[0].day, "2026-09-30");
});
test("tampered, unknown future, malformed baselines never acquire merge authority", async () => {
  const payload = fixture(),
    fingerprint = hash(payload);
  payload.solves[0].elapsed = 1;
  assert.equal(
    await readTrainingBaseline({ revision: 7, payload, fingerprint }, catalog),
    null,
  );
  payload.version = 3;
  assert.equal(
    await readTrainingBaseline(
      { revision: 7, payload, fingerprint: hash(payload) },
      catalog,
    ),
    null,
  );
  assert.equal(
    await readTrainingBaseline({ revision: -1, payload, fingerprint }, catalog),
    null,
  );
});
test("async baseline verification captures the exact payload it authenticates", async () => {
  const payload = fixture();
  const pending = readTrainingBaseline(
    { revision: 7, payload, fingerprint: hash(payload) },
    catalog,
  );
  payload.solves[0].elapsed = 1;
  assert.equal((await pending).payload.solves[0].elapsed, 5000);
});
test("mixed-version reconciliation preserves deletion meaning and schema-only upload signal", async () => {
  const base = fixture();
  const device = normalizeTrainingSnapshot(base, catalog);
  device.solves = [];
  const result = await prepareTrainingReconciliation(
    {
      metadata: { revision: 2, payload: base, fingerprint: hash(base) },
      device,
      cloud: base,
    },
    catalog,
  );
  assert.equal(result.cloudNeedsUpgrade, true);
  assert.equal(result.baseline.payload.version, 2);
  assert.deepEqual(result.cloud, result.baseline.payload);
  assert.deepEqual(result.device.solves, []);
  const merged = mergeTraining(
    result.baseline.payload,
    result.device,
    result.cloud,
  );
  assert.deepEqual(merged.value.solves, []);
  assert.deepEqual(merged.conflicts, []);
  const current = await prepareTrainingReconciliation(
    { metadata: null, device, cloud: device },
    catalog,
  );
  assert.equal(current.cloudNeedsUpgrade, false);
  assert.equal(current.baseline, null);
});
