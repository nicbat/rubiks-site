import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { profileSummary, profileSummaryV2 } from "../src/profile-summary.js";
import { summaryFixture } from "./helpers/profile-summary-fixture.js";
import { EVENT_IDS } from "../src/cube-events.js";

test("v2 profile combines activity while compatibility speed fields remain regular 3x3", () => {
  const source = summaryFixture();
  const legacy = profileSummary(source, catalog);
  const data = {
    ...source,
    solves: source.solves.map((s) => ({ ...s, eventId: "333" })),
  };
  data.solves.push({
    id: "other",
    eventId: "222",
    date: "2026-10-31T00:00:00Z",
    day: "2026-10-30",
    elapsed: 1000,
  });
  const before = structuredClone(data);
  const result = profileSummaryV2(data, catalog);
  assert.equal(result.summary_version, 2);
  assert.equal(result.activity.solve_count, 15);
  assert.equal(result.activity.total_time_ms, 106000);
  assert.equal(result.activity.active_days, 8);
  assert.equal(result.active_days, 8);
  assert.equal(result.events["222"].best_ms, 1000);
  assert.equal(result.events["333"].best_ms, 2000);
  for (const key of [
    "solve_count",
    "total_time_ms",
    "best_ms",
    "median_ms",
    "best_ao5_ms",
    "best_ao12_ms",
    "confident_count",
    "case_count",
    "practice_count",
  ])
    assert.equal(result[key], legacy[key], key);
  assert.deepEqual(Object.keys(result.events).sort(), [...EVENT_IDS].sort());
  assert.equal(result.events["444bf"].best_ms, null);
  assert.deepEqual(data, before);
});

test("v2 profile rejects missing event identities instead of silently mixing legacy data", () => {
  assert.throws(() => profileSummaryV2(summaryFixture(), catalog), /event/i);
});
