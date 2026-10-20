<script>
  import Button from "../lib/components/ui/button/button.svelte";
  let { solve, disabled = false } = $props();
</script>

<div
  class="cube-actions timer-penalties"
  role="group"
  aria-label="Solve penalty"
>
  {#each [["none", "No penalty"], ["+2", "+2 sec"], ["dnf", "DNF"]] as [value, label]}
    <Button
      class="secondary"
      data-action="timer-penalty"
      data-solve-id={solve.id}
      data-penalty={value}
      aria-pressed={(solve.penalty || "none") === value}
      {disabled}>{label}</Button
    >
  {/each}
</div>
