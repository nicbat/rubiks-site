<script>
  import { progressRanges, shiftDay } from "../dashboard.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { dashboard, today, since, until } = $props();
</script>

<div class="dashboard-toolbar dashboard-range-toolbar">
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
  <details
    class="dashboard-custom-range"
    open={dashboard.range === "custom" || !!dashboard.rangeError}
  >
    <summary>Custom dates</summary>
    <form id="dashboard-custom-range" class="dashboard-range-form">
      <div>
        <Label for="dashboard-range-start">From</Label>
        <Input
          id="dashboard-range-start"
          name="start"
          type="date"
          required
          max={today}
          value={dashboard.rangeStartDraft ??
            dashboard.start ??
            (since || shiftDay(today, -29))}
          aria-describedby={dashboard.rangeError
            ? "dashboard-range-error"
            : undefined}
        />
      </div>
      <div>
        <Label for="dashboard-range-end">Through</Label>
        <Input
          id="dashboard-range-end"
          name="end"
          type="date"
          required
          max={today}
          value={dashboard.rangeEndDraft ?? dashboard.end ?? until}
          aria-describedby={dashboard.rangeError
            ? "dashboard-range-error"
            : undefined}
        />
      </div>
      <Button id="dashboard-range-apply" type="submit" variant="secondary"
        >Apply dates</Button
      >
    </form>
    {#if dashboard.rangeError}<p role="alert" id="dashboard-range-error">
        {dashboard.rangeError}
      </p>{/if}
  </details>
</div>
<p class="muted" id="dashboard-period-label">
  {since ? `${since} – ${until}` : `All time through ${until}`} · local dates
</p>
