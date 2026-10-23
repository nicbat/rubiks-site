import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import DailySolveCharts from "../src/components/DailySolveCharts.svelte";
import SolveTimeline from "../src/components/SolveTimeline.svelte";
import { solveSummary } from "../src/dashboard.js";

const solves = [21000, 22000, 23000].map((elapsed, i) => ({
  id: `chart-${i}`,
  elapsed,
  date: `2026-10-17T12:00:0${i}Z`,
  day: "2026-10-17",
  penalty: i === 1 ? "dnf" : null,
}));
const summary = solveSummary(solves, {
  today: "2026-10-17",
  distribution: true,
});

test("daily charts isolate shared chart colors and legends while preserving DNF selection", () => {
  const { body } = render(DailySolveCharts, {
    props: { summary, selectedId: "chart-1", cubes: [] },
  });
  const ids = [...body.matchAll(/data-chart="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  for (const id of ids) assert.match(body, new RegExp(`data-chart=${id}`));
  assert.match(body, /--color-ao5: var\(--chart-2\)/);
  assert.match(body, /--color-count: var\(--chart-2\)/);
  assert.equal([...body.matchAll(/aria-label="Chart legend"/g)].length, 2);
  assert.match(body, /aria-label="Solve 2: DNF" aria-current="true"/);
  assert.match(body, /data-id="chart-1"[^>]*aria-haspopup="dialog"/);
  assert.match(body, /1 DNF excluded/);
  assert.equal((summary.pathTime.match(/M/g) || []).length, 2);
});

test("review chart retains focus anchors and all-DNF distributions remain explicit", () => {
  const { body } = render(SolveTimeline, { props: { summary, review: true } });
  assert.match(body, /data-slot="chart"/);
  assert.match(
    body,
    /id="trend-solve-chart-1" href="#solve-dialog" data-action="solve-details"/,
  );
  assert.match(body, /aria-label="Solve 2: DNF"/);
  const allDnf = solveSummary(
    solves.map((s) => ({ ...s, penalty: "dnf" })),
    {
      today: "2026-10-17",
      distribution: true,
    },
  );
  const empty = render(DailySolveCharts, {
    props: { summary: allDnf, cubes: [] },
  }).body;
  assert.match(empty, /All solves are DNF/);
  assert.equal([...empty.matchAll(/data-slot="chart"/g)].length, 1);
  assert.doesNotMatch(empty, /class="distribution-bar"/);
});

test("charts expose keyboard inspection and distinguish DNF from a completed point", () => {
  const body = render(DailySolveCharts, { props: { summary, cubes: [] } }).body;
  assert.match(body, /tabindex="0" aria-label="Inspect solve timeline/);
  assert.match(body, /tabindex="0" aria-label="Inspect time distribution/);
  assert.equal([...body.matchAll(/data-chart-index=/g)].length, 3);
  assert.equal([...body.matchAll(/class="dnf-dot"/g)].length, 1);
  assert.equal([...body.matchAll(/class="solve-dot"/g)].length, 2);
  // Native SVG titles cannot provide immediate keyboard/touch inspection.
  assert.doesNotMatch(body, /<title>/);
});

test("chart inspection selects the nearest plotted item including sparse overview gaps", async () => {
  const { nearestChartItem } =
    await import("../src/lib/components/ui/chart/inspection.js");
  const items = [{ x: 35 }, { x: 45 }, { x: 300 }];
  assert.equal(nearestChartItem(items, -10), items[0]);
  assert.equal(nearestChartItem(items, 60), items[1]);
  assert.equal(nearestChartItem(items, 290), items[2]);
  assert.equal(nearestChartItem(items, 400), items[2]);
  assert.equal(nearestChartItem([], 50), null);
  assert.equal(nearestChartItem(items, NaN), null);
  assert.deepEqual(items, [{ x: 35 }, { x: 45 }, { x: 300 }]);
});
