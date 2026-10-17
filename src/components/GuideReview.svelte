<script>
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet reviewButton(id, reviewed)}
  <Button
    class={reviewed ? "secondary" : "primary"}
    data-action="review-lesson"
    data-id={id}
    aria-pressed={!!reviewed}>{reviewed ? "Reviewed" : "Mark reviewed"}</Button
  >
{/snippet}
{#snippet content(id, progress)}
  <div class="guide-review">
    <p>Reviewed this guide? You can return to it any time.</p>
    {@render reviewButton(id, progress.reviewed?.includes(id))}
  </div>
{/snippet}

{@render content(props.id, props.progress)}
