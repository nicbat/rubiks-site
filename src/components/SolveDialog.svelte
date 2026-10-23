<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import SolveDetails from "./SolveDetails.svelte";
  import { icon } from "../icons.js";
  let { state } = $props();
  const solve = $derived(
    state.solves.find((item) => item.id === state.solveDetailId),
  );
</script>

{#if solve}
  <DialogContent id="solve-dialog" aria-labelledby="solve-title">
    <div class="dialog-heading">
      <h2 id="solve-title">Solve details</h2>
      <Button
        class="icon-button"
        data-action="close-dialog"
        aria-label="Close solve details">{@html icon("close")}</Button
      >
    </div>
    <SolveDetails {state} {solve} />
  </DialogContent>
{/if}
