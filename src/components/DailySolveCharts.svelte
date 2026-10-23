<script>
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
</script>

<div class="daily-charts">
  <SolveTimeline {summary} {selectedId} interactive />
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
