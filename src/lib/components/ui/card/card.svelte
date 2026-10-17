<script>
  import { cn } from "$lib/utils.js";
  let { class: className, children, ...restProps } = $props();
</script>

<article data-slot="card" class={cn(className)} {...restProps}>
  {@render children?.()}
</article>
