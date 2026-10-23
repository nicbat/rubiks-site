<script>
  import { useChart } from "./chart-utils.ts";
  const chart = useChart();
  let { id, item } = $props();
</script>

<div
  {id}
  role="tooltip"
  aria-live="polite"
  data-slot="chart-tooltip"
  class="chart-tooltip"
  class:below={item.y < 110}
  class:left={item.x > 175}
>
  <strong>{item.label}</strong>
  {#if item.description}<div class="chart-tooltip-description">
      {item.description}
    </div>{/if}
  <dl>
    {#each item.rows as row}
      <div>
        <dt>
          <span style:background={`var(--color-${row.key})`} aria-hidden="true"
          ></span>{chart.config[row.key]?.label || row.key}
        </dt>
        <dd>{row.value}</dd>
      </div>
    {/each}
  </dl>
</div>

<style>
  .chart-tooltip {
    position: absolute;
    z-index: 2;
    top: 8px;
    right: 8px;
    width: 210px;
    max-width: calc(100% - 16px);
    box-sizing: border-box;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--popover);
    color: var(--popover-foreground);
    padding: 10px 12px;
    box-shadow: 0 4px 12px #0002;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .chart-tooltip.below {
    top: auto;
    bottom: 8px;
  }
  .chart-tooltip.left {
    right: auto;
    left: 8px;
  }
  .chart-tooltip-description {
    color: var(--muted);
    margin-top: 4px;
  }
  .chart-tooltip dl {
    display: block;
    margin: 8px 0 0;
    line-height: 1.4;
  }
  .chart-tooltip dl > div,
  .chart-tooltip dt {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .chart-tooltip dl > div {
    flex: none;
    border: 0;
    padding: 0;
    justify-content: space-between;
    margin-top: 4px;
  }
  .chart-tooltip dt span {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex: none;
  }
  .chart-tooltip dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
</style>
