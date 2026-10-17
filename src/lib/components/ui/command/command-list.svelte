<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    children,
    class: className,
    ...restProps
  }: CommandPrimitive.ListProps = $props();
</script>

<CommandPrimitive.List
  bind:ref
  data-slot="command-list"
  class={cn(
    "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
    className,
  )}
  {...restProps}
>
  <!-- Bits UI 2.19 requires a viewport for selection and ARIA relationships. -->
  <CommandPrimitive.Viewport>{@render children?.()}</CommandPrimitive.Viewport>
</CommandPrimitive.List>
