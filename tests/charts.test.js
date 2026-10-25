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
  scramble: Array(10).fill("R U").join(" "),
}));
const summary = solveSummary(solves, {
  today: "2026-10-17",
  distribution: true,
});

test("daily charts isolate shared chart colors and legends while preserving DNF selection", () => {
  const { body } = render(DailySolveCharts, {
    props: { summary, state: { dashboard: { solveId: "chart-1" } } },
  });
  const ids = [...body.matchAll(/data-chart="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 1);
  assert.equal(new Set(ids).size, 1);
  for (const id of ids) assert.match(body, new RegExp(`data-chart=${id}`));
  assert.match(body, /--color-ao5: var\(--chart-2\)/);
  assert.equal([...body.matchAll(/aria-label="Chart legend"/g)].length, 1);
  assert.match(body, /aria-label="Solve 2: DNF" aria-current="true"/);
  assert.doesNotMatch(body, /aria-haspopup="dialog"/);
  assert.equal((summary.pathTime.match(/M/g) || []).length, 2);
});

test("review chart retains focus anchors and all-DNF solve inspection without a bar chart", () => {
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
  assert.match(empty, /Solve 1: DNF/);
  assert.equal([...empty.matchAll(/data-slot="chart"/g)].length, 1);
  assert.doesNotMatch(empty, /class="distribution-bar"/);
});

test("charts expose keyboard inspection and distinguish DNF from a completed point", () => {
  const body = render(DailySolveCharts, { props: { summary, cubes: [] } }).body;
  assert.match(body, /tabindex="0" aria-label="Inspect solve timeline/);
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

test("timeline shows only average lines and their legend while retaining solve review targets", () => {
  const body = render(SolveTimeline, { props: { summary, review: true } }).body;
  assert.doesNotMatch(body, /class="individual-times"/);
  assert.match(body, /class="average-five"/);
  assert.match(body, /class="average-twelve"/);
  const legend = body.match(
    /<ul[^>]+aria-label="Chart legend"[^>]*>([\s\S]*?)<\/ul>/,
  )[1];
  assert.equal([...legend.matchAll(/<li/g)].length, 2);
  assert.match(legend, /ao5/);
  assert.match(legend, /ao12/);
  assert.doesNotMatch(legend, /> Solve/);
  assert.equal([...body.matchAll(/data-action="solve-details"/g)].length, 3);
});

test("full-width chart geometry keeps fixed pixel margins and inspection aligned", async () => {
  const { chartX, chartCoordinate, chartPath } =
    await import("../src/lib/components/ui/chart/inspection.js");
  for (const width of [240, 320, 667, 1024]) {
    assert.equal(chartX(35, width), 44);
    assert.equal(chartX(315, width), width - 16);
    assert.equal(chartX(175, width), (width + 28) / 2);
    assert.equal(chartCoordinate(44, width), 35);
    assert.equal(chartCoordinate(width - 16, width), 315);
  }
  assert.equal(
    chartPath("M35.0,50 L315.0,80 M175.0,60", 1024),
    "M44,50 L1008,80 M526,60",
  );
});

test("selected solves render the full review inline, keep cube visibility and wait for explicit selection", () => {
  const state = {
    solveInline: true,
    solveDetailId: "chart-1",
    solvePreviewVisible: true,
    solves,
    dashboard: { solveId: "chart-1" },
    preferences: { timerMinutes: true },
    cubeCollection: { cubes: [] },
  };
  const selected = solveSummary(solves, {
    today: "2026-10-17",
    selectedId: "chart-1",
  });
  const body = render(DailySolveCharts, {
    props: { summary: selected, state },
  }).body;
  assert.match(body, /aria-label="Selected solve details"/);
  assert.match(body, /id="solve-notes"/);
  assert.match(body, /data-action="timer-penalty"/);
  assert.match(body, /data-action="solve-delete"/);
  assert.match(body, /data-action="solve-preview"[^>]*aria-expanded="true"/);
  assert.match(body, /Hide cube/);
  assert.match(body, /data-player-id="solve-preview-chart-1"/);
  assert.match(body, /data-id="chart-0"/);
  assert.match(body, /data-id="chart-2"/);
  assert.doesNotMatch(body, /<dialog|Review solve<|aria-haspopup="dialog"/);
  const idle = render(DailySolveCharts, {
    props: { summary, state: { ...state, solveInline: false } },
  }).body;
  assert.doesNotMatch(
    idle,
    /id="solve-notes"|aria-label="Selected solve details"/,
  );
});
