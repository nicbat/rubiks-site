<script>
  import Tooltip from "./chart-tooltip.svelte";
  import { nearestChartItem, chartX, chartCoordinate } from "./inspection.js";
  let { items, label, children } = $props();
  const tooltipId = $props.id();
  let host;
  let width = $state(350);
  let active = $state.raw(null);
  let pointerInspection = false;
  // Keep the inspected item tied to its current dataset, never an old filter's data.
  const item = $derived(items.includes(active) ? active : null);

  function inspect(event) {
    if (event.target.closest?.('[role="tooltip"]')) return;
    pointerInspection = true;
    const bounds = host.getBoundingClientRect();
    active = nearestChartItem(
      items,
      chartCoordinate(event.clientX - bounds.left, bounds.width),
    );
  }
  function focus(event) {
    const index =
      event.target.closest?.("[data-chart-index]")?.dataset.chartIndex;
    if (index !== undefined) active = items[Number(index)];
    else if (!pointerInspection || !item) active = items[0];
  }
  function keydown(event) {
    if (event.key === "Tab") pointerInspection = false;
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    pointerInspection = false;
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
      pointerInspection = false;
      event.preventDefault();
      event.stopPropagation();
    }
    function dismissOutside(event) {
      if (host.contains(event.target)) return;
      active = null;
      pointerInspection = false;
    }
    document.addEventListener("keydown", dismiss, true);
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => {
      document.removeEventListener("keydown", dismiss, true);
      document.removeEventListener("pointerdown", dismissOutside, true);
    };
  });
</script>

<!-- Chart inspection deliberately has a local application keyboard scope; its SVG
     links remain available to Tab. The chart surface itself accepts arrow keys. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={host}
  bind:clientWidth={width}
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
    pointerInspection = false;
    if (!host.contains(document.activeElement)) active = null;
  }}
  onpointercancel={() => {
    pointerInspection = false;
    active = null;
  }}
  onfocusin={focus}
  onfocusout={(event) => {
    if (!host.contains(event.relatedTarget) && !pointerInspection)
      active = null;
  }}
  onkeydown={keydown}
>
  {@render children(item ? tooltipId : undefined, width)}
  {#if item}
    <div
      class="chart-cursor"
      style:left={`${chartX(item.x, width)}px`}
      aria-hidden="true"
    ></div>
    <Tooltip id={tooltipId} {item} />
  {/if}
</div>

<style>
  .chart-plot {
    position: relative;
    min-width: 0;
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
