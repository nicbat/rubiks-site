<script>
  import { cn } from "$lib/utils.js";
  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  } = $props();
</script>

<select
  bind:this={ref}
  data-slot="native-select"
  class={cn(className)}
  {...restProps}>{@render children?.()}</select
>
