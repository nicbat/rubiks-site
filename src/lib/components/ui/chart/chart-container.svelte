<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import ChartStyle from "./chart-style.svelte";
  import { setChartContext, type ChartConfig } from "./chart-utils.ts";

  const uid = $props.id();

  let {
    ref = $bindable(null),
    id = uid,
    class: className,
    children,
    config,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> & {
    config: ChartConfig;
  } = $props();

  const chartId = $derived(
    `chart-${(id || uid).replace(/[^a-zA-Z0-9_-]/g, "")}`,
  );

  setChartContext({
    get config() {
      return config;
    },
  });
</script>

<div
  bind:this={ref}
  data-chart={chartId}
  data-slot="chart"
  class={cn("chart-container", className)}
  {...restProps}
>
  <ChartStyle id={chartId} {config} />
  {@render children?.()}
</div>

<style>
  .chart-container {
    min-width: 0;
    width: 100%;
    color: var(--muted);
    font-size: 12px;
  }
  .chart-container :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    max-height: 320px;
    overflow: visible;
  }
  .chart-container :global(text) {
    fill: var(--muted);
    font-size: 11px;
  }
  .chart-container :global(.chart-gridline) {
    stroke: var(--line);
    stroke-width: 1;
  }
</style>
