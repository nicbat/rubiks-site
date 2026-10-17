<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";
  import { icon } from "../../../../icons.js";
  let {
    ref = $bindable(null),
    class: className,
    value = $bindable(""),
    "aria-controls": controls,
    ...restProps
  }: CommandPrimitive.InputProps = $props();
</script>

<div data-slot="command-input-wrapper">
  <span aria-hidden="true">{@html icon("search")}</span>
  <CommandPrimitive.Input
    bind:ref
    bind:value
    data-slot="command-input"
    class={cn("cn-command-input", className)}
    {...restProps}
  >
    {#snippet child({ props })}
      <!-- Bits 2.19 defaults to the inner viewport; allow the named listbox target. -->
      <input
        {...props}
        aria-controls={controls ??
          (props["aria-controls"] as string | undefined)}
        bind:value
      />
    {/snippet}
  </CommandPrimitive.Input>
</div>
