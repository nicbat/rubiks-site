<script>
  import * as Chart from "../lib/components/ui/chart/index.js";
  const chartConfig = {
    solve: { label: "Solve", color: "var(--chart-1)" },
    ao5: { label: "ao5", color: "var(--chart-2)" },
    ao12: { label: "ao12", color: "var(--chart-3)" },
  };
  import { chartX, chartPath } from "../lib/components/ui/chart/inspection.js";
  import { formatElapsed } from "../solve-timer.js";
  let {
    summary,
    selectedId = null,
    interactive = false,
    review = false,
  } = $props();
  const time = (n) =>
    n === null ? "—" : Number.isFinite(n) ? formatElapsed(n, true) : "DNF";
  const inspection = $derived(
    summary.points.map((point) => ({
      x: point.x,
      y: point.y,
      label: `Solve ${point.number}${point.solve.penalty === "+2" ? " (+2)" : ""}`,
      description: new Date(point.solve.date).toLocaleString(),
      rows: [
        { key: "solve", value: time(point.time) },
        { key: "ao5", value: time(point.ao5) },
        { key: "ao12", value: time(point.ao12) },
      ],
    })),
  );
</script>

<figure class="solve-chart daily-timeline">
  <h4>Solve timeline</h4>
  <Chart.Container config={chartConfig}>
    <Chart.Plot
      items={inspection}
      label="Inspect solve timeline: use Left and Right arrow keys"
    >
      {#snippet children(tooltipId, width)}
        {@const x = (value) => chartX(value, width)}
        <svg
          viewBox={`0 0 ${width} 220`}
          role={interactive || review ? "group" : "img"}
          aria-label={review
            ? "Solve timeline: open a solve to review"
            : interactive
              ? "Solve timeline: select a solve to see details"
              : "Solve times in chronological order, with rolling averages of 5 and 12"}
        >
          {#each [0, 0.25, 0.5, 0.75, 1] as fraction}
            <line
              x1={x(35)}
              x2={x(315)}
              y1={180 - fraction * 155}
              y2={180 - fraction * 155}
              class="chart-gridline"
            />
            <text x={x(35) - 8} y={184 - fraction * 155} text-anchor="end"
              >{((summary.maximum * fraction) / 1000).toLocaleString(
                undefined,
                {
                  maximumFractionDigits: summary.maximum < 10000 ? 1 : 0,
                },
              )}s</text
            >
          {/each}
          <path d={chartPath(summary.path5, width)} class="average-five" />
          <path d={chartPath(summary.path12, width)} class="average-twelve" />
          {#each summary.points as point, index}
            <a
              id={review ? `trend-solve-${point.solve.id}` : undefined}
              href={review
                ? "#solve-dialog"
                : interactive
                  ? "#daily-selected-solve"
                  : undefined}
              data-action={review
                ? "solve-details"
                : interactive
                  ? "daily-solve"
                  : undefined}
              data-review-fallback={review ? "dashboard-cube" : undefined}
              aria-haspopup={review ? "dialog" : undefined}
              data-id={point.solve.id}
              aria-label={`Solve ${point.number}: ${time(point.time)}${point.solve.penalty === "+2" ? " (+2)" : ""}`}
              aria-describedby={tooltipId}
              aria-current={point.solve.id === selectedId ? "true" : undefined}
              data-chart-index={index}
              class="solve-point"
            >
              <circle cx={x(point.x)} cy={point.y} r="7" fill="transparent" />
              {#if !Number.isFinite(point.time)}
                <path
                  d={`M${x(point.x) - 3},${point.y - 3}l6,6m-6,0l6,-6`}
                  class="dnf-dot"
                />
              {:else}
                <circle
                  cx={x(point.x)}
                  cy={point.y}
                  r={point.solve.id === selectedId ? 4 : 2.5}
                  class="solve-dot"
                />
              {/if}
            </a>
          {/each}
          <text x={x(35)} y="205">#{summary.points[0].number}</text>
          <text x={x(175)} y="205" text-anchor="middle">Solve order</text>
          <text x={x(315)} y="205" text-anchor="end">#{summary.count}</text>
        </svg>
      {/snippet}
    </Chart.Plot>
    <Chart.Legend keys={["ao5", "ao12"]} dashed={["ao12"]} />
  </Chart.Container>
  <figcaption>
    Hover, touch, or use arrow keys to inspect. Select a point for details. DNF
    points sit above the time scale. Lines show ao5 and ao12 only; averages
    break at DNF.
    {#if summary.count > summary.points.length}
      {#if summary.overview}Selected period: {summary.count} solves, {summary
          .points.length} representative points. Average lines are sampled too.
      {:else}Showing the latest {summary.points.length} solves; statistics use all
        {summary.count}.{/if}
    {/if}
  </figcaption>
</figure>
