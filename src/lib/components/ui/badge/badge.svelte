<script>
  import { cn } from "$lib/utils.js";
  let { class: className, children, ...restProps } = $props();
</script>

<span data-slot="badge" class={cn("badge", className)} {...restProps}
  >{@render children?.()}</span
>
