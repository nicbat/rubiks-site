<script>
  import Tooltip from "./chart-tooltip.svelte";
  import { nearestChartItem } from "./inspection.js";
  let { items, label, children } = $props();
  const tooltipId = $props.id();
  let host;
  let active = $state.raw(null);
  // Keep the inspected item tied to its current dataset, never an old filter's data.
  const item = $derived(items.includes(active) ? active : null);

  function inspect(event) {
    if (event.target.closest?.('[role="tooltip"]')) return;
    const bounds = host.getBoundingClientRect();
    active = nearestChartItem(
      items,
      ((event.clientX - bounds.left) / bounds.width) * 350,
    );
  }
  function focus(event) {
    const index =
      event.target.closest?.("[data-chart-index]")?.dataset.chartIndex;
    active = items[Number(index ?? 0)];
  }
  function keydown(event) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const index = items.indexOf(item);
    active =
      items[
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : Math.max(
                0,
                Math.min(
                  items.length - 1,
                  index + (event.key === "ArrowLeft" ? -1 : 1),
                ),
              )
      ];
  }
  $effect(() => {
    function dismiss(event) {
      if (event.key !== "Escape" || !item) return;
      active = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  });
</script>

<!-- Chart inspection deliberately has a local application keyboard scope; its SVG
     links remain available to Tab. The chart surface itself accepts arrow keys. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={host}
  class="chart-plot"
  role="application"
  aria-roledescription="interactive chart"
  tabindex="0"
  aria-label={label}
  aria-describedby={item ? tooltipId : undefined}
  onpointermove={inspect}
  onpointerdown={inspect}
  onpointerleave={(event) => {
    if (event.pointerType === "touch") return;
    if (!host.contains(document.activeElement)) active = null;
  }}
  onfocusin={focus}
  onfocusout={(event) => {
    if (!host.contains(event.relatedTarget)) active = null;
  }}
  onkeydown={keydown}
>
  {@render children(item ? tooltipId : undefined)}
  {#if item}
    <div
      class="chart-cursor"
      style:left={`${(item.x / 350) * 100}%`}
      aria-hidden="true"
    ></div>
    <Tooltip id={tooltipId} {item} />
  {/if}
</div>

<style>
  .chart-plot {
    position: relative;
    min-width: 0;
    max-width: 560px;
    margin-inline: auto;
    border-radius: var(--radius);
  }
  .chart-plot:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 3px;
  }
  .chart-cursor {
    position: absolute;
    top: 10%;
    bottom: 18%;
    border-left: 1px dashed var(--muted);
    pointer-events: none;
  }
</style>
