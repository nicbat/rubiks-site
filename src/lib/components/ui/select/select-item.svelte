<script>
  import { Select as SelectPrimitive } from "bits-ui";
  let { children, disabled = false, ...restProps } = $props();
</script>

<SelectPrimitive.Item
  data-slot="select-item"
  {...restProps}
  {disabled}
  aria-disabled={disabled || undefined}
  >{@render children?.()}</SelectPrimitive.Item
>
