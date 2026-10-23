<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import SelectControl from "./SelectControl.svelte";
  import { trainingSourceLabel } from "../account-workspace.js";
  import { heatmapWeeks } from "../dashboard.js";
  let {
    model,
    activity,
    today,
    confident,
    total,
    children = undefined,
  } = $props();
  let dashboard = $derived(model.state.dashboard || {});
</script>

<div class="dashboard-toolbar">
  <SelectControl
    id="dashboard-range"
    label="Activity period"
    value={dashboard.range}
    options={[
      { value: "28", label: "Last 28 days" },
      { value: "90", label: "Last 90 days" },
      { value: "all", label: "All time" },
    ]}
  />
  <span class="muted"
    >3×3 · {trainingSourceLabel(
      model.state.account,
      model.state.preferences.testData,
    )}</span
  >
</div>
<div class="progress-stats dashboard-stats dashboard-panel">
  <div>
    <strong>{activity.totals.recognition + activity.totals.rehearsal}</strong
    ><span>Practice attempts</span>
  </div>
  <div><strong>{activity.totals.solves}</strong><span>Solves</span></div>
  <div><strong>{activity.totals.days}</strong><span>Active days</span></div>
  <div>
    <strong>{confident}<small> / {total}</small></strong><span
      >Confident cases · all time</span
    >
  </div>
</div>
<section
  class="activity-section dashboard-panel"
  aria-labelledby="activity-title"
>
  <div class="section-heading">
    <h2 id="activity-title">Activity heatmap</h2>
    <span class="muted">Past year · local dates</span>
  </div>
  <div
    class="activity-heatmap-scroll"
    role="region"
    aria-label="Daily activity heatmap"
  >
    <div class="activity-heatmap">
      <div class="heatmap-weekdays" aria-hidden="true">
        <span></span>
        {#each ["", "Mon", "", "Wed", "", "Fri", ""] as label}<span
            >{label}</span
          >{/each}
      </div>
      {#each heatmapWeeks(today, "all") as week}
        <div class="heatmap-week">
          <span class="heatmap-week-label" aria-hidden="true">{week.label}</span
          >
          {#each week.days as date}
            {#if date}
              {@const entry = activity.days.get(date)}
              {@const count = entry
                ? entry.recognition + entry.rehearsal + entry.solves
                : 0}
              <Button
                id={`activity-${date}`}
                class="activity-cell"
                data-action="activity-day"
                data-day={date}
                aria-label={`${date}: ${count} activities`}
                aria-pressed={dashboard.day === date}
                title={`${date}: ${count} activities`}
              >
                <span
                  class="activity-tile"
                  data-level={count === 0
                    ? 0
                    : count < 5
                      ? 1
                      : count < 15
                        ? 2
                        : 3}
                  aria-hidden="true"
                ></span>
              </Button>
            {:else}<span aria-hidden="true"></span>{/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
  <div
    class="heatmap-legend"
    aria-label="Activity levels: none, 1 to 4, 5 to 14, 15 or more"
  >
    <span>Less</span>{#each [0, 1, 2, 3] as level}<span
        class="activity-tile"
        data-level={level}
        aria-hidden="true"
      ></span>{/each}<span>More</span>
  </div>
  {@render children?.()}
</section>
