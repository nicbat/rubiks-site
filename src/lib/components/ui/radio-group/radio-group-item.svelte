<script>
  import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
  let { ref = $bindable(null), ...restProps } = $props();
</script>

<RadioGroupPrimitive.Item bind:ref data-slot="radio-group-item" {...restProps}>
  <span class="radio-indicator" aria-hidden="true"></span>
</RadioGroupPrimitive.Item>
