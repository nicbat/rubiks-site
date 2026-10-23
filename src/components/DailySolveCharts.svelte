<script>
  import SolveTimeline from "./SolveTimeline.svelte";
  import SolveDetails from "./SolveDetails.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  let { summary, state = {}, toolbar } = $props();
  const selected = $derived(
    state.solveInline
      ? summary.selection?.solve ||
          state.solves?.find((solve) => solve.id === state.solveDetailId)
      : null,
  );
</script>

<div class="daily-charts">
  {#if summary.count}
    <SolveTimeline
      {summary}
      selectedId={state.dashboard?.solveId}
      interactive
    />
  {:else}<p class="muted">No solves in this selection.</p>{/if}
</div>
{@render toolbar?.()}
{#if selected}
  <section
    id="daily-selected-solve"
    class="selected-solve"
    aria-label="Selected solve details"
  >
    <h4 id="selected-solve-title" tabindex="-1">
      {summary.selection
        ? `Solve ${summary.selection.number}`
        : "Selected solve"}
    </h4>
    <div class="solve-point-navigation">
      <Button
        id="previous-selected-solve"
        variant="secondary"
        data-action="daily-solve"
        data-id={summary.selection?.previousId}
        disabled={!summary.selection?.previousId}>Previous solve</Button
      >
      <Button
        id="next-selected-solve"
        variant="secondary"
        data-action="daily-solve"
        data-id={summary.selection?.nextId}
        disabled={!summary.selection?.nextId}>Next solve</Button
      >
    </div>
    <SolveDetails {state} solve={selected} inline />
  </section>
{/if}
