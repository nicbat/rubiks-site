<script>
  import { Select as SelectPrimitive } from "bits-ui";
  let { children, ...restProps } = $props();
</script>

<SelectPrimitive.Item data-slot="select-item" {...restProps}
  >{@render children?.()}</SelectPrimitive.Item
>
