<script>
  import SelectControl from "./SelectControl.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { id, label, cubes, value, disabled = false } = $props();
  let options = $derived([
    { value: "", label: "Not specified" },
    ...(value && !cubes.some((cube) => cube.id === value)
      ? [{ value, label: "Unavailable cube" }]
      : []),
    ...cubes
      .filter((cube) => !cube.deleted || cube.id === value)
      .map((cube) => ({ value: cube.id, label: cube.name })),
  ]);
</script>

<div class="cube-field">
  <Label for={id}>{label}</Label>
  <SelectControl {id} {label} {options} {disabled} value={value || ""} />
</div>
