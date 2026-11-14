<script>
  let { summary } = $props();
</script>

Hover, touch, or use arrow keys to inspect. Select a point for details. DNF
points sit above the time scale. {#if summary.showAverages !== false}Lines show
  ao5 and ao12 only; averages break at DNF.{/if}
{#if summary.count > summary.points.length}
  {#if summary.overview}Selected period: {summary.count} solves, {summary.points
      .length} representative points. {#if summary.showAverages !== false}Average
      lines are sampled too.{/if}
  {:else}Showing the latest {summary.points.length} solves; statistics use all
    {summary.count}.{/if}
{/if}
