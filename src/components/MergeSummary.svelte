<script>
  let { summary } = $props();
</script>

{#if summary?.error}
  <p role="status">Merge unavailable: {summary.error}</p>
{:else if summary}
  <p>
    Merge adds {summary.added.attempts} attempts, {summary.added.solves} solves,
    {summary.added.cubes} cubes, {summary.added.selected} selected cases and
    {summary.added.reviewed} reviewed lessons and {summary.added.known || 0} known
    marks.
  </p>
  <p>
    {summary.duplicates} matching records are counted once.
    {#if summary.conflicts}{summary.conflicts} differing records keep the current
      version.{/if}
  </p>
{/if}
<p class="muted">
  Existing records, algorithm choices, course positions and default cube are
  kept. Learning sets, known marks and reviewed lessons are combined. Matching
  uses record IDs, so separate attempts at the same time are kept.
</p>
