<script>
  import { getContext } from "svelte";
  import * as Select from "../lib/components/ui/select/index.js";
  let { id, label, value, options, compact = false } = $props();
  const actions = getContext("actions");
  let chosen = $derived(
    options.find((option) => String(option.value) === String(value)),
  );
</script>

<div class="select-control" data-select={id}>
  <Select.Root
    type="single"
    value={String(value)}
    onValueChange={(next) => actions?.chooseOption(id, next)}
  >
    <Select.Trigger role="combobox" {id} aria-label={label}>
      {#if compact}<span class="select-value">{chosen?.label ?? ""}</span
        >{:else}{chosen?.label ?? ""}{/if}<span aria-hidden="true">⌄</span>
    </Select.Trigger>
    <Select.Content id={`${id}-options`} aria-label={label}>
      {#each options as option}
        <Select.Item value={String(option.value)} label={option.label}
          >{option.label}</Select.Item
        >
      {/each}
    </Select.Content>
  </Select.Root>
</div>
