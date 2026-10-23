<script>
  import { progressRanges } from "../dashboard.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import SelectControl from "./SelectControl.svelte";
  let { dashboard, cubes = [], since, until } = $props();
</script>

<div
  class="dashboard-toolbar dashboard-range-toolbar"
  role="group"
  aria-label="Graph filters"
>
  <div
    class="dashboard-range-presets"
    role="group"
    aria-label="Time range"
    aria-describedby="dashboard-period-label"
  >
    {#each progressRanges as range}
      <Button
        id={`dashboard-range-${range.value}`}
        variant="secondary"
        data-action="dashboard-range"
        data-range={range.value}
        aria-pressed={dashboard.range === range.value}>{range.label}</Button
      >
    {/each}
  </div>
  <div class="dashboard-cube-filter">
    <SelectControl
      id="dashboard-cube"
      label="Filter solves by cube"
      value={dashboard.cube || "all"}
      options={[
        { value: "all", label: "All cubes" },
        { value: "none", label: "Not specified" },
        ...cubes.map((cube) => ({
          value: cube.id,
          label: cube.name + (cube.deleted ? " (deleted)" : ""),
        })),
      ]}
    />
  </div>
</div>
<p class="muted" id="dashboard-period-label">
  {since ? `${since} – ${until}` : `All time through ${until}`} · local dates
</p>
