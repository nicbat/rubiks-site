<script>
  import { Select as SelectPrimitive } from "bits-ui";
  let { children, ...restProps } = $props();
</script>

<!-- Keep the popup within its page/dialog so native modal layering is respected. -->
<SelectPrimitive.Content
  data-slot="select-content"
  class="select-options"
  sideOffset={4}
  align="end"
  collisionPadding={12}
  preventScroll={false}
  {...restProps}
>
  {@render children?.()}
</SelectPrimitive.Content>
