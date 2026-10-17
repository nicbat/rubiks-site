<script>
  import TimerClock from "./TimerClock.svelte";
  import { icon } from "../icons.js";
  import { recentStats, solveTime } from "../solve-history.js";
  import { formatElapsed } from "../solve-timer.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import SelectControl from "./SelectControl.svelte";
  import CubePicker from "./CubePicker.svelte";
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
  {@const result = (solve) =>
    `${format(solveTime(solve))}${solve.penalty === "+2" ? " (+2)" : ""}`}
  {#snippet penalties(solve)}
    <div
      class="cube-actions timer-penalties"
      role="group"
      aria-label="Solve penalty"
    >
      {#each [["none", "No penalty"], ["+2", "+2 sec"], ["dnf", "DNF"]] as [value, label]}<Button
          class="secondary"
          data-action="timer-penalty"
          data-solve-id={solve.id}
          data-penalty={value}
          aria-pressed={(solve.penalty || "none") === value}
          {...status === "running" ? { disabled: true } : {}}>{label}</Button
        >{/each}
    </div>
  {/snippet}
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
      <Button class="primary timer-toggle" data-action="timer-toggle"
        >{action}</Button
      >
    </div>
    {#if current}{@render penalties(current)}
      <p class="timer-note">
        +2: one move off · DNF: more than one move off{current.penalty
          ? ` · Raw time: ${format(current.elapsed)}`
          : ""}
      </p>{/if}
    {#if status === "ready"}<Button
        class="secondary timer-new"
        data-action="timer-new">New scramble (Tab)</Button
      >{/if}
    {#if currentSolveId && status === "stopped"}<Button
        class="secondary"
        data-action="timer-delete"
        data-solve-id={currentSolveId}>Delete last solve (Backspace)</Button
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
        Saved on this device. Timer history is separate from learning backups.
      </p>
      {#if solves.length}<ol reversed>
          {#each solves.slice().reverse() as solve}<li>
              <div>
                <strong>{result(solve)}</strong> ·
                <time datetime={solve.date}
                  >{new Date(solve.date).toLocaleString()}</time
                >
                <p>{solve.scramble}</p>
                <CubePicker
                  id={`solve-cube-${solve.id}`}
                  label={"Cube for this solve"}
                  {cubes}
                  value={solve.cubeId}
                  disabled={status === "running"}
                />{@render penalties(solve)}
              </div>
              <Button
                class="secondary"
                data-action="timer-delete"
                data-solve-id={solve.id}
                aria-label={"Delete solve " + result(solve)}
                {...status === "running" ? { disabled: true } : {}}
                >Delete</Button
              >
            </li>{/each}
        </ol>{:else}<p>No solves yet.</p>{/if}
    </details>
  </section>
{/snippet}

{@render content(props)}
