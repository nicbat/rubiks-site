<script>
  import { Select as SelectPrimitive } from "bits-ui";
  let { children, ...restProps } = $props();
</script>

<SelectPrimitive.Trigger data-slot="select-trigger" {...restProps}
  >{@render children?.()}</SelectPrimitive.Trigger
>
