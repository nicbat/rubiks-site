<script>
  import { useChart } from "./chart-utils.ts";
  const chart = useChart();
  let { dashed = [] } = $props();
</script>

<ul class="chart-legend" aria-label="Chart legend">
  {#each Object.entries(chart.config) as [key, item]}
    <li>
      <span
        class="chart-swatch"
        class:dashed={dashed.includes(key)}
        style:--swatch={`var(--color-${key})`}
        aria-hidden="true"
      ></span>
      {item.label || key}
    </li>
  {/each}
</ul>

<style>
  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 16px;
    list-style: none;
    margin: 12px 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .chart-swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--swatch);
  }
  .chart-swatch.dashed {
    height: 0;
    width: 16px;
    border-top: 2px dashed var(--swatch);
    background: transparent;
  }
</style>
