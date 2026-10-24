import { test } from "node:test";
import { readFileSync } from "node:fs";
import { partialCases } from "../src/learning-methods.js";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { profileSummary } from "../src/profile-summary.js";
import { emptyProgress } from "../src/progress.js";
import { summaryFixture } from "./helpers/profile-summary-fixture.js";

test("all-time public summary respects penalties, best windows and full-case earned confidence", () => {
  const data = summaryFixture();
  const before = structuredClone(data);
  const stats = profileSummary(data, catalog);
  assert.deepEqual(stats, {
    practice_count: 20,
    active_days: 7,
    confident_count: 1,
    case_count: 78,
    total_time_ms: 105000,
    solve_count: 14,
    best_ms: 2000,
    median_ms: 6500,
    best_ao5_ms: 10000 / 3,
    best_ao12_ms: 6600,
  });
  assert.deepEqual(data, before);
  data.progress.transfers = [{ caseId: "oll-2", variant: 0, method: "full" }];
  assert.equal(profileSummary(data, catalog).confident_count, 2);
  // A new difficult recognition resets the linked objective too.
  data.progress.attempts.push({
    caseId: "oll-2",
    variant: 0,
    mode: "recognition",
    method: "full",
    result: "help",
    day: "2026-10-09",
    at: "2026-10-09T12:00:00Z",
  });
  assert.equal(profileSummary(data, catalog).confident_count, 1);
});
test("empty histories have complete zero summaries and absent times", () => {
  assert.deepEqual(
    profileSummary({ progress: emptyProgress(), solves: [] }, catalog),
    {
      practice_count: 0,
      active_days: 0,
      confident_count: 0,
      case_count: 78,
      total_time_ms: 0,
      solve_count: 0,
      best_ms: null,
      median_ms: null,
      best_ao5_ms: null,
      best_ao12_ms: null,
    },
  );
});
test("all-DNF history keeps raw duration, local activity dates and no finite records", () => {
  const data = summaryFixture();
  data.progress = emptyProgress();
  data.solves = data.solves.slice(0, 5).map((s) => ({ ...s, penalty: "dnf" }));
  delete data.solves[0].day;
  data.solves[0].date = "2026-10-08T23:30:00-07:00";
  const stats = profileSummary(data, catalog);
  assert.equal(stats.active_days, 2); // Recorded Oct 7 plus legacy UTC Oct 9.
  assert.equal(stats.total_time_ms, 15000);
  assert.equal(stats.best_ms, null);
  assert.equal(stats.median_ms, null);
  assert.equal(stats.best_ao5_ms, null);
});

// The backend cannot import runtime JSON: keep its catalog metadata aligned with
// the source catalog so additions/default changes cannot silently miscount cases.
test("server confidence scope tracks the complete catalog and partial recognition objectives", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261023120000_public_progress_summary.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const pairs = [
    ...migration.matchAll(/\('((?:oll|pll)-[^']+)', (\d+)\)/g),
  ].map((match) => [match[1], Number(match[2])]);
  assert.deepEqual(
    pairs,
    catalog.map((c) => [c.id, c.preferredVariant]),
  );
  const partial = migration
    .match(/c.case_id in \(([^)]+)\)/)[1]
    .match(/'[^']+'/g)
    .map((id) => id.slice(1, -1));
  assert.deepEqual(partial, partialCases);
});
