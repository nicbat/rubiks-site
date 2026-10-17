<script>
  import NativeSelect from "../lib/components/ui/native-select/native-select.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let props = $props();
</script>

{#snippet content(id, label, cubes, value, disabled = false)}
  <Label class="cube-field" for={id}
    ><span>{label}</span><NativeSelect
      {id}
      data-cube-picker
      {...disabled ? { disabled: true } : {}}
      ><option value="">Not specified</option
      >{#if value && !cubes.some((c) => c.id === value)}<option {value} selected
          >Unavailable cube</option
        >{/if}{#each cubes.filter((c) => !c.deleted || c.id === value) as c}<option
          value={c.id}
          {...c.id === value ? { selected: true } : {}}>{c.name}</option
        >{/each}</NativeSelect
    ></Label
  >
{/snippet}

{@render content(
  props.id,
  props.label,
  props.cubes,
  props.value,
  props.disabled,
)}
