<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CommandPrimitive.ItemProps = $props();
</script>

<!-- parity-ignore-upstream: data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 | cmdk sets data-disabled="true"; Bits sets an empty data-disabled attribute, matched by data-disabled: instead -->

<CommandPrimitive.Item
  bind:ref
  data-slot="command-item"
  class={cn(
    "aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</CommandPrimitive.Item>
