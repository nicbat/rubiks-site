<script>
  import * as Chart from "../lib/components/ui/chart/index.js";
  const chartConfig = {
    count: { label: "Solves", color: "var(--chart-2)" },
    median: { label: "Median", color: "var(--chart-3)" },
  };
  import SolveTimeline from "./SolveTimeline.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import { formatElapsed } from "../solve-timer.js";
  let { summary, selectedId, cubes, allTime = false } = $props();
  const time = (n) => (Number.isFinite(n) ? formatElapsed(n, true) : "DNF");
  let selectedIndex = $derived(
    Math.max(
      0,
      summary.points.findIndex((p) => p.solve.id === selectedId),
    ),
  );
  let selected = $derived(summary.points[selectedIndex]);
  let bins = $derived(summary.distribution.bins);
  let largestBin = $derived(Math.max(1, ...bins.map((b) => b.count)));
  let binWidth = $derived(280 / Math.max(1, bins.length));
  let medianX = $derived(
    bins.length
      ? 35 +
          (280 * (summary.distribution.median - bins[0].lower)) /
            (bins.at(-1).upper - bins[0].lower)
      : 35,
  );
</script>

<div class="daily-charts">
  <SolveTimeline {summary} selectedId={selected.solve.id} interactive />
  <figure class="solve-chart daily-distribution">
    <h4>Time distribution</h4>
    {#if bins.length}
      <Chart.Container config={chartConfig}>
        <svg
          viewBox="0 0 350 220"
          role="img"
          aria-label="Solve time distribution, excluding DNF"
        >
          <text x="35" y="14">Solves</text>
          {#each [0, 1] as fraction}
            <text x="31" y={184 - fraction * 150} text-anchor="end"
              >{largestBin * fraction}</text
            >
            <line
              x1="35"
              x2="315"
              y1={180 - fraction * 150}
              y2={180 - fraction * 150}
              class="chart-gridline"
            />
          {/each}
          {#each bins as bin, index}
            <rect
              x={35 + index * binWidth + 1}
              y={180 - (bin.count / largestBin) * 150}
              width={binWidth - 2}
              height={(bin.count / largestBin) * 150}
              class="distribution-bar"
            >
              <title
                >{bin.lower / 1000}–{bin.upper / 1000}s: {bin.count} solves</title
              >
            </rect>
          {/each}
          <line
            x1={medianX}
            x2={medianX}
            y1="25"
            y2="180"
            class="median-line"
          />
          <text x="35" y="205">{bins[0].lower / 1000}s</text>
          <text x="175" y="205" text-anchor="middle">Solve time</text>
          <text x="315" y="205" text-anchor="end"
            >{bins.at(-1).upper / 1000}s</text
          >
        </svg>
        <Chart.Legend dashed={["median"]} />
      </Chart.Container>
      <figcaption>
        Dashed line: median {time(summary.distribution.median)}. Each bar spans {(bins[0]
          .upper -
          bins[0].lower) /
          1000}s. {summary.dnfs} DNF excluded.
      </figcaption>
    {:else}<p class="muted">
        All solves are DNF. A distribution needs a completed solve.
      </p>{/if}
  </figure>
</div>
<section
  id="daily-selected-solve"
  class="selected-solve"
  aria-label="Selected solve details"
  aria-live="polite"
>
  <div class="daily-solve-heading">
    <h4>Solve {selected.number}</h4>
    <strong
      >{time(selected.time)}{selected.solve.penalty === "+2"
        ? " (+2)"
        : ""}</strong
    >
  </div>
  <p class="muted">
    {new Date(selected.solve.date).toLocaleString([], {
      ...(allTime ? { year: "numeric", month: "short", day: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })} · {cubes.find((c) => c.id === selected.solve.cubeId)?.name ||
      "Not specified"}
  </p>
  <div class="solve-point-navigation">
    <Button
      id="daily-solve-review"
      class="secondary"
      data-action="solve-details"
      data-id={selected.solve.id}
      data-review-fallback="daily-cube"
      aria-haspopup="dialog">Review solve</Button
    >
    <Button
      class="secondary"
      data-action="daily-solve"
      data-id={summary.points[selectedIndex - 1]?.solve.id}
      disabled={selectedIndex === 0}
      >{summary.overview && summary.count > summary.points.length
        ? "Previous plotted solve"
        : "Previous solve"}</Button
    >
    <Button
      class="secondary"
      data-action="daily-solve"
      data-id={summary.points[selectedIndex + 1]?.solve.id}
      disabled={selectedIndex === summary.points.length - 1}
      >{summary.overview && summary.count > summary.points.length
        ? "Next plotted solve"
        : "Next solve"}</Button
    >
  </div>
</section>
