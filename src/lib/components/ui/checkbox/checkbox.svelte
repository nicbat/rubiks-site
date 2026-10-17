<script>
  import { Checkbox as CheckboxPrimitive } from "bits-ui";
  let { checked = false, children, ...restProps } = $props();
</script>

<CheckboxPrimitive.Root {checked} data-slot="checkbox" {...restProps}>
  <span class="checkbox-indicator" aria-hidden="true"
    >{#if checked}<svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"><path d="m3 8 3 3 7-7" /></svg
      >{/if}</span
  >
</CheckboxPrimitive.Root>
