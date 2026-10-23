<script>
  import { solveTime } from "../solve-history.js";
  import { formatElapsed } from "../solve-timer.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Badge from "../lib/components/ui/badge/badge.svelte";
  let {
    solve,
    cubes = [],
    scope,
    fallbackId,
    minutes = true,
    disabled = false,
  } = $props();
  let time = $derived(solveTime(solve));
  let formatted = $derived(
    time === Infinity ? "DNF" : formatElapsed(time, minutes),
  );
</script>

<Button
  id={`${scope}-solve-${solve.id}`}
  class="text-button solve-history-row"
  data-action="solve-details"
  data-id={solve.id}
  data-review-scope={scope}
  data-review-fallback={fallbackId}
  aria-label={`Review solve ${formatted}${solve.penalty === "+2" ? " (+2)" : ""}`}
  aria-describedby={`${scope}-solve-meta-${solve.id}`}
  aria-haspopup={scope === "timer" ? "dialog" : undefined}
  aria-controls={scope !== "timer" ? "daily-selected-solve" : undefined}
  {disabled}
>
  <span class="cube-actions"
    ><strong>{formatted}</strong>
    {#if solve.penalty}<Badge>{solve.penalty === "+2" ? "+2" : "DNF"}</Badge
      >{/if}
    {#if solve.notes}<Badge>Note</Badge>{/if}
  </span>
  <span
    class="cube-actions solve-history-meta"
    id={`${scope}-solve-meta-${solve.id}`}
  >
    <span
      >{cubes.find((cube) => cube.id === solve.cubeId)?.name ||
        "Not specified"}</span
    >
    <time datetime={solve.date}>{new Date(solve.date).toLocaleString()}</time>
  </span>
</Button>
