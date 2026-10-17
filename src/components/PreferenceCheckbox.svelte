<script>
  import { getContext } from "svelte";
  import Checkbox from "../lib/components/ui/checkbox/checkbox.svelte";
  let { id, checked = false, ...restProps } = $props();
  const actions = getContext("actions");
</script>

<Checkbox
  {id}
  {checked}
  {...restProps}
  onCheckedChange={(next) => actions?.setPreference(id, next)}
/>
