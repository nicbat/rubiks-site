<script>
  import { formatSolvingTime } from "../dashboard.js";
  import { formatElapsed } from "../solve-timer.js";
  let { stats } = $props();
  const time = (value) =>
    value === null
      ? "—"
      : Number.isFinite(value)
        ? formatElapsed(value, true)
        : "DNF";
</script>

<div
  class="progress-stats dashboard-stats dashboard-panel"
  role="group"
  aria-label="Activity summary"
>
  <div>
    <strong>{stats.practice_count}</strong><span>Practice attempts</span>
  </div>
  <div><strong>{stats.active_days}</strong><span>Active days</span></div>
  <div>
    <strong>{stats.confident_count}<small> / {stats.case_count}</small></strong
    ><span>Confident cases · all time</span>
  </div>
  <div>
    <strong>{formatSolvingTime(stats.total_time_ms)}</strong><span
      >Time solving</span
    >
  </div>
</div>
<div
  class="progress-stats dashboard-stats dashboard-panel"
  role="group"
  aria-label="Timer summary"
>
  {#each [["Solves", stats.solve_count], ["Best single", time(stats.best_ms)], ["Median", time(stats.median_ms)], ["Best ao5", time(stats.best_ao5_ms)], ["Best ao12", time(stats.best_ao12_ms)]] as [label, value]}
    <div><strong>{value}</strong><span>{label}</span></div>
  {/each}
</div>
