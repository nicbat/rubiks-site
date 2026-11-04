<script>
  import Button from "../lib/components/ui/button/button.svelte";
  // Without a solve the keys stay in place, unpressed and disabled.
  let { solve = null, disabled = false } = $props();
  const help = { "+2": "One move off", dnf: "More than one move off" };
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
      data-solve-id={solve?.id}
      data-penalty={value}
      title={help[value]}
      aria-pressed={!!solve && (solve.penalty || "none") === value}
      disabled={disabled || !solve}>{label}</Button
    >
  {/each}
</div>
