<script>
  import {
    accountOverview,
    trainingSourceLabel,
  } from "../account-workspace.js";
  import { dayKey } from "../progress.js";
  import { heatmapWeeks, solveSummary } from "../dashboard.js";
  import { formatElapsed } from "../solve-timer.js";
  import DailySolveCharts from "./DailySolveCharts.svelte";
  import SolveHistoryRow from "./SolveHistoryRow.svelte";
  import SelectControl from "./SelectControl.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  import ProgressRange from "./ProgressRange.svelte";
  let { model } = $props();
  const time = (value) =>
    value === null
      ? "—"
      : Number.isFinite(value)
        ? formatElapsed(value, true)
        : "DNF";
</script>

{#snippet content(model)}
  {@const {
    state,
    catalog,
    variant,
    progressIndex,
    status,
    caseDiagram,
    badge,
  } = model}
  {@const today = dayKey()}
  {@const dashboard = state.dashboard || {
    range: "30",
    day: null,
    cube: "all",
  }}
  {@const { activity, cases, confident } = accountOverview(model, today)}
  {@const day = activity.days.get(dashboard.day)}
  {@const daily = solveSummary(state.solves || [], {
    since: dashboard.day || activity.since,
    today: dashboard.day || activity.until,
    overview: !dashboard.day,
    recentLimit: 50,
    cube: dashboard.cube || "all",
    selectedId: state.solveDetailId,
    distribution: true,
  })}

  <div class="page-toolbar">
    <h1 class="sr-only">Progress</h1>
    <p class="muted">
      3×3 · {trainingSourceLabel(state.account, state.preferences.testData)}
    </p>
    <Button class="secondary" data-action="backup">Backup & transfer</Button>
  </div>
  <ProgressSummary
    stats={{
      practice_count: activity.totals.recognition + activity.totals.rehearsal,
      active_days: activity.totals.days,
      confident_count: confident,
      case_count: cases.length,
      total_time_ms: daily.totalTime,
      solve_count: daily.count,
      best_ms: daily.best,
      median_ms: daily.distribution.median,
      best_ao5_ms: daily.best5,
      best_ao12_ms: daily.best12,
    }}
  />
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
            <span class="heatmap-week-label" aria-hidden="true"
              >{week.label}</span
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
    <div class="activity-detail">
      {#if dashboard.day}
        <div class="section-heading">
          <h3 id="activity-detail-title" tabindex="-1">{dashboard.day}</h3>
          <Button class="secondary" data-action="activity-all">All days</Button>
        </div>
      {:else}<h3 id="activity-detail-title" class="sr-only" tabindex="-1">
          Timer solves
        </h3>{/if}
      {#if dashboard.day}
        <dl>
          <div>
            <dt>Hidden practice</dt>
            <dd>{day?.recognition || 0}</dd>
          </div>
          <div>
            <dt>Rehearsals</dt>
            <dd>{day?.rehearsal || 0}</dd>
          </div>
          <div>
            <dt>Timer solves</dt>
            <dd>{day?.solves || 0}</dd>
          </div>
        </dl>
        {#if day}
          {#if dashboard.deleteDay === dashboard.day}
            <div role="group" aria-label="Delete day confirmation">
              <p>
                Delete {day.recognition + day.rehearsal} practice attempts and {day.solves}
                timer solves from {dashboard.day}? This includes all cubes and
                cannot be undone.
              </p>
              <p class="muted">
                Selected cases, known marks, and cubes will be kept.
              </p>
              <div class="dashboard-toolbar">
                <Button class="secondary" data-action="cancel-delete-day"
                  >Cancel</Button
                >
                <Button variant="destructive" data-action="confirm-delete-day"
                  >Delete this day</Button
                >
              </div>
              {#if dashboard.deleteMessage}<p role="alert">
                  {dashboard.deleteMessage}
                </p>{/if}
            </div>
          {:else}
            <Button class="secondary" data-action="delete-day"
              >Delete day’s activity</Button
            >
          {/if}
        {/if}
      {/if}
      <section
        class="daily-solves"
        aria-label={dashboard.day
          ? "Selected day timer solves"
          : "Period timer solves"}
      >
        <p class="muted">
          {dashboard.day
            ? "Averages use only this day’s solves."
            : "Averages use only the selected period’s solves."} Times include +2
          penalties; time solving uses recorded elapsed time.
        </p>
        <p class="muted">
          +2: {daily.plusTwo} · DNF: {daily.dnfs}{daily.count
            ? ` (${Math.round((daily.dnfs / daily.count) * 100)}%)`
            : ""} · Mean: {time(daily.mean)} · Middle 50%: {time(
            daily.distribution.q1,
          )}–{time(daily.distribution.q3)}
        </p>
        <DailySolveCharts summary={daily} {state}>
          {#snippet toolbar()}
            <ProgressRange
              {dashboard}
              cubes={state.cubeCollection?.cubes || []}
              since={activity.since}
              until={activity.until}
            />
          {/snippet}
        </DailySolveCharts>
        <details class="recent-solves daily-results">
          <summary>Individual solves ({daily.count})</summary>
          {#if daily.count > 50}<p class="muted">
              Showing the latest 50 solves.
            </p>{/if}
          <ol>
            {#each daily.recent as point (point.solve.id)}
              <li>
                <SolveHistoryRow
                  solve={point.solve}
                  cubes={state.cubeCollection?.cubes}
                  minutes={state.preferences.timerMinutes}
                  scope="daily"
                  fallbackId="dashboard-cube"
                />
              </li>
            {/each}
          </ol>
        </details>
      </section>
      {#if dashboard.day && !day}<p class="muted">
          No activity recorded on this day.
        </p>{/if}
      <p class="muted">
        Older solves use this device’s timezone. New solves retain their
        original local date.
      </p>
    </div>
  </section>
  <section class="dashboard-panel" aria-labelledby="case-map-title">
    <div class="section-heading">
      <h2 id="case-map-title">Your cases</h2>
      <SelectControl
        id="method"
        label="Recognition method"
        value={state.method || "full"}
        options={[
          { value: "full", label: "Full CFOP" },
          { value: "two-look", label: "Two-look CFOP" },
        ]}
      />
    </div>
    <p class="muted">
      Current algorithm variants. Known marks are separate from earned
      confidence.
    </p>
    {#each ["OLL", "PLL"] as section}
      {@const sectionCases = cases.filter((c) => c.section === section)}
      {#if sectionCases.length}
        <h3 class="case-section-heading">
          <Button
            class="case-section-toggle"
            data-action="dashboard-section"
            data-section={section}
            aria-expanded={!dashboard.collapsed?.[section]}
            aria-controls={`case-map-${section}`}
            ><span
              >{section}
              <small class="muted">{sectionCases.length} cases</small></span
            ><span aria-hidden="true"
              >{dashboard.collapsed?.[section] ? "+" : "−"}</span
            ></Button
          >
        </h3>
        <div
          id={`case-map-${section}`}
          class="case-map"
          hidden={!!dashboard.collapsed?.[section]}
        >
          {#each sectionCases as c}{@const s = status(c)}
            <Button
              class="case-map-cell"
              data-action="detail"
              data-id={c.id}
              aria-label={`${c.name}: ${s.label}`}
            >
              {@render caseDiagram(c)}<strong>{c.name}</strong>{@render badge(
                c,
              )}
              <span
                class="day-dots"
                aria-label={`${Math.min(s.days, 3)} of 3 confident days`}
                >{#each [0, 1, 2] as n}<i class={s.days > n ? "filled" : ""}
                  ></i>{/each}</span
              >
              <small>{s.attempts} attempts</small>
            </Button>
          {/each}
        </div>{/if}
    {/each}
    <p class="source-note">
      Three confident hidden-practice days after the last difficult attempt earn
      confidence. Rehearsals do not earn confident days.
    </p>
  </section>
{/snippet}
{@render content(model)}
