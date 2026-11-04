<script>
  import Label from "../lib/components/ui/label/label.svelte";
  let { id, label, description, children } = $props();
</script>

<div class="settings-row">
  <div class="settings-row-copy">
    <Label for={id}>{label}</Label>
    <p id={`${id}-help`} class="muted">{description}</p>
  </div>
  <div class="settings-row-control">{@render children()}</div>
</div>
