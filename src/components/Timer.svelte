<script>
  import TimerClock from "./TimerClock.svelte";
  import { icon } from "../icons.js";
  import { recentStats, solveTime } from "../solve-history.js";
  import { formatElapsed } from "../solve-timer.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import SelectControl from "./SelectControl.svelte";
  import SolvePenalties from "./SolvePenalties.svelte";
  import SolveHistoryRow from "./SolveHistoryRow.svelte";
  let props = $props();
</script>

{#snippet content({
  status,
  hold = "idle",
  scramble,
  elapsed,
  minutes = true,
  hideTimer = false,
  solves = [],
  cubes = [],
  cubeId = null,
  currentSolveId = null,
  historyLimit = 50,
})}
  {@const cubeName =
    cubes.find((c) => c.id === cubeId)?.name || "Not specified"}
  {#snippet cubeChoice()}{#if status === "running"}<Button
        id="timer-cube"
        class="timer-cube-disabled"
        role="combobox"
        aria-label="Cube"
        aria-expanded="false"
        disabled
        ><span class="select-value">{cubeName}</span><span aria-hidden="true"
          >⌄</span
        ></Button
      >{:else}<SelectControl
        id={"timer-cube"}
        label={"Cube"}
        value={cubeId || ""}
        options={[
          { value: "", label: "Not specified" },
          ...cubes
            .filter((c) => !c.deleted)
            .map((c) => ({ value: c.id, label: c.name })),
        ]}
        compact={true}
      />{/if}{/snippet}
  {@const format = (time) =>
    time === Infinity ? "DNF" : formatElapsed(time, minutes)}
  {@const current =
    status === "stopped" && solves.find((solve) => solve.id === currentSolveId)}
  {#snippet stats()}{#each [5, 12] as count}{@const { average, best } =
        recentStats(solves, count)}
      <div>
        <h2>Recent {count}</h2>
        <p>
          Average: <strong>{average === null ? "—" : format(average)}</strong>
        </p>
        <p>Best: <strong>{best === null ? "—" : format(best)}</strong></p>
      </div>{/each}{/snippet}
  {@const light =
    status === "running" ? "green" : hold === "armed" ? "yellow" : "red"}
  {#snippet startLights()}
    <span class="timer-light" aria-hidden="true">
      {#each ["red", "yellow", "green"] as lamp}
        <span
          class="timer-lamp"
          data-lamp={lamp}
          data-lit={lamp === light ? "" : undefined}
        ></span>
      {/each}
    </span>
  {/snippet}
  {@const action =
    status === "running"
      ? "Stop timer"
      : status === "stopped"
        ? "Next scramble (Tab)"
        : "Hold to start (Space)"}
  {@const timerMessage =
    hold === "armed"
      ? "Release to start"
      : hold === "holding"
        ? "Keep holding…"
        : status === "running"
          ? "Running"
          : ""}
  <section class="solve-timer" aria-labelledby="timer-heading">
    <header class="page-heading">
      <h1 id="timer-heading">Timer</h1>
      <div class="timer-cube-choice">{@render cubeChoice()}</div>
    </header>
    <p class="timer-note">Hold yellow on top, green in front.</p>
    {#if status !== "running"}<div class="timer-scramble">
        <p id="timer-scramble">{scramble}</p>
        <Button
          class="icon-button"
          data-action="scramble-preview"
          aria-label="Preview scrambled cube"
          title="Preview scrambled cube"
          aria-haspopup="dialog">{@html icon("cube")}</Button
        >
      </div>{/if}
    <div
      class="timer-clock-panel"
      data-timer-status={status}
      data-timer-hold={hold}
      data-timer-light={light}
    >
      <div class="timer-clock-row">
        {@render startLights()}
        {#if hideTimer && status === "running"}<div
            class="timer-clock"
            aria-hidden="true"
          >
            —
          </div>{:else}<TimerClock
            running={status === "running"}
            time={current ? format(solveTime(current)) : format(elapsed)}
          />{/if}
        {@render startLights()}
      </div>
      <div class="timer-status-slot">
        {#if timerMessage}<p id="timer-status" role="status">
            {timerMessage}
          </p>{/if}
      </div>
      <Button
        id="timer-toggle"
        class="primary timer-toggle"
        data-action="timer-toggle">{action}</Button
      >
    </div>
    {#if current}<SolvePenalties solve={current} />
      <Button
        class="text-button timer-review"
        data-action="solve-details"
        data-id={current.id}
        data-review-fallback="timer-toggle"
        aria-haspopup="dialog">Review solve</Button
      >
      <p class="timer-note">
        +2: one move off · DNF: more than one move off{current.penalty
          ? ` · Raw time: ${format(current.elapsed)}`
          : ""}
      </p>{/if}
    {#if status === "ready"}<Button
        class="secondary timer-new"
        data-action="timer-new">New scramble (Tab)</Button
      >{/if}
    <section class="timer-stats" aria-label="Recent solve statistics">
      {@render stats()}
    </section>
    <p class="timer-note">
      Averages drop the fastest and slowest solve; two DNFs make an average DNF.
      Complete 5 or 12 solves for an average.
    </p>
    <details class="timer-history">
      <summary>Solve history ({solves.length})</summary>
      <p class="timer-note">
        Saved on this device. Open a solve to review or edit it.
      </p>
      {#if solves.length}<p class="timer-note" role="status">
          Showing {Math.min(historyLimit, solves.length)} of {solves.length} solves.
        </p>
        <ol id="timer-history-list" reversed start={solves.length}>
          {#each solves.slice(-historyLimit).reverse() as solve (solve.id)}<li>
              <SolveHistoryRow
                {solve}
                {cubes}
                {minutes}
                scope="timer"
                disabled={status === "running"}
              />
            </li>{/each}
        </ol>
        {#if solves.length > historyLimit}<Button
            id="timer-history-more"
            variant="secondary"
            data-action="timer-history-more"
            aria-controls="timer-history-list"
            disabled={status === "running"}>Show more</Button
          >{/if}{:else}<p>No solves yet.</p>{/if}
    </details>
  </section>
{/snippet}

{@render content(props)}
