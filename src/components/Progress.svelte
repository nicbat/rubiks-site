<script>
  import { dayKey } from "../progress.js";
  import { solveSummary } from "../dashboard.js";
  import { formatElapsed } from "../solve-timer.js";
  import SolveTimeline from "./SolveTimeline.svelte";
  import DailySolveCharts from "./DailySolveCharts.svelte";
  import SolveHistoryRow from "./SolveHistoryRow.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import SelectControl from "./SelectControl.svelte";
  import { accountOverview } from "../account-workspace.js";
  import DashboardActivity from "./DashboardActivity.svelte";
  let { model } = $props();
  const time = (value) =>
    value === null
      ? "—"
      : Number.isFinite(value)
        ? formatElapsed(value, true)
        : "DNF";
</script>

{#snippet content(model)}
  {@const { state, status, caseDiagram, badge } = model}
  {@const today = dayKey()}
  {@const dashboard = state.dashboard || {
    range: "28",
    tab: "learning",
    day: null,
    cube: "all",
  }}
  {@const { activity, cases, confident } = accountOverview(model, today)}
  {@const day = activity.days.get(dashboard.day)}
  <div class="page-heading">
    <h1>Progress</h1>
    <Button variant="secondary" data-action="backup">Backup & transfer</Button>
  </div>
  <DashboardActivity
    {model}
    {activity}
    {today}
    {confident}
    total={cases.length}
  >
    <div class="activity-detail" aria-live="polite">
      <div class="section-heading">
        <h3 id="activity-detail-title" tabindex="-1">
          {dashboard.day || "All-time activity"}
        </h3>
        <Button
          class="secondary"
          data-action="activity-all"
          aria-pressed={!dashboard.day}>All days</Button
        >
      </div>
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
      {#if !dashboard.day || day?.solves}
        {@const daily = solveSummary(state.solves || [], {
          since: dashboard.day || "",
          today: dashboard.day || today,
          overview: !dashboard.day,
          recentLimit: 50,
          cube: dashboard.dailyCube || "all",
          distribution: true,
        })}
        <section
          class="daily-solves"
          aria-label={dashboard.day
            ? "Selected day timer solves"
            : "All-time timer solves"}
        >
          <div class="section-heading">
            <h3>{dashboard.day ? "Timer solves" : "All-time timer solves"}</h3>
            <SelectControl
              id="daily-cube"
              label={dashboard.day
                ? "Day’s solves by cube"
                : "All-time solves by cube"}
              value={dashboard.dailyCube || "all"}
              options={[
                { value: "all", label: "All cubes" },
                { value: "none", label: "Not specified" },
                ...(state.cubeCollection?.cubes || []).map((c) => ({
                  value: c.id,
                  label: c.name + (c.deleted ? " (deleted)" : ""),
                })),
              ]}
            />
          </div>
          <dl>
            {#each [["Solves", daily.count], ["Best single", time(daily.best)], ["Median", time(daily.distribution.median)], ["Best ao5", time(daily.best5)], ["Best ao12", time(daily.best12)], ["Time solving", time(daily.totalTime)]] as [label, value]}
              <div>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            {/each}
          </dl>
          <p class="muted">
            {dashboard.day
              ? "Averages use only this day’s solves."
              : "All recorded days, independent of the activity-period filter."} Times
            include +2 penalties; time solving uses recorded elapsed time.
          </p>
          <p class="muted">
            +2: {daily.plusTwo} · DNF: {daily.dnfs}{daily.count
              ? ` (${Math.round((daily.dnfs / daily.count) * 100)}%)`
              : ""} · Mean: {time(daily.mean)} · Middle 50%: {time(
              daily.distribution.q1,
            )}–{time(daily.distribution.q3)}
          </p>
          {#if daily.count}
            <DailySolveCharts
              summary={daily}
              allTime={!dashboard.day}
              selectedId={dashboard.solveId}
              cubes={state.cubeCollection?.cubes || []}
            />
          {:else}<p class="muted">No solves in this selection.</p>{/if}
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
                    fallbackId="daily-cube"
                  />
                </li>
              {/each}
            </ol>
          </details>
        </section>
      {/if}
      {#if dashboard.day && !day}<p class="muted">
          No activity recorded on this day.
        </p>{/if}
      <p class="muted">
        Older solves use this device’s timezone. New solves retain their
        original local date.
      </p>
    </div>
  </DashboardActivity>
  <div class="dashboard-toolbar" role="group" aria-label="Progress view">
    {#each [["learning", "Learning"], ["solves", "Solves"]] as [tab, label]}<Button
        id={`dashboard-${tab}`}
        class="secondary"
        data-action="dashboard-tab"
        data-tab={tab}
        aria-pressed={dashboard.tab === tab}>{label}</Button
      >{/each}
  </div>
  {#if dashboard.tab === "learning"}
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
        Three confident hidden-practice days after the last difficult attempt
        earn confidence. Rehearsals do not earn confident days.
      </p>
    </section>
  {:else}
    {@const summary = solveSummary(state.solves || [], {
      since: activity.since,
      today,
      cube: dashboard.cube,
    })}
    <section class="dashboard-panel" aria-labelledby="solve-trends-title">
      <div class="section-heading">
        <h2 id="solve-trends-title">Solve trends</h2>
        <SelectControl
          id="dashboard-cube"
          label="Filter solves by cube"
          value={dashboard.cube}
          options={[
            { value: "all", label: "All cubes" },
            { value: "none", label: "Not specified" },
            ...(state.cubeCollection?.cubes || []).map((c) => ({
              value: c.id,
              label: c.name + (c.deleted ? " (deleted)" : ""),
            })),
          ]}
        />
      </div>
      <p class="muted">
        {summary.count} solves · {summary.dnfs} DNF · selected period and cube
      </p>
      <div class="progress-stats dashboard-stats">
        {#each [["Best single", summary.best], ["Best ao5", summary.best5], ["Best ao12", summary.best12], ["Latest ao5", summary.ao5], ["Latest ao12", summary.ao12]] as [label, value]}<div
          >
            <strong>{time(value)}</strong><span>{label}</span>
          </div>{/each}
      </div>
      {#if summary.count}
        <SolveTimeline {summary} review />
        <p class="muted">
          Averages drop one fastest and one slowest result. One DNF is dropped;
          two make the average DNF. +2 penalties are included.
        </p>
        <details class="recent-solves">
          <summary>Recent results ({summary.recent.length})</summary>
          <ol>
            {#each summary.recent as point (point.solve.id)}<li>
                <SolveHistoryRow
                  solve={point.solve}
                  cubes={state.cubeCollection?.cubes}
                  minutes={state.preferences.timerMinutes}
                  scope="recent"
                  fallbackId="dashboard-cube"
                />
              </li>{/each}
          </ol>
        </details>
      {:else}<div class="no-results">
          <h3>No solves in this selection</h3>
          <Button class="primary" data-action="nav" data-view="timer"
            >Open timer</Button
          >
        </div>{/if}
    </section>
  {/if}
{/snippet}
{@render content(model)}
