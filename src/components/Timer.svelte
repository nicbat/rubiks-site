<script>
  import TimerClock from "./TimerClock.svelte";
  import { icon } from "../icons.js";
  import { recentStats, solveTime } from "../solve-history.js";
  import { formatElapsed } from "../solve-timer.js";
  import { timerFire } from "../pixel-fire.js";
  import { timerConfetti } from "../confetti.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import SelectControl from "./SelectControl.svelte";
  import SolvePenalties from "./SolvePenalties.svelte";
  import SolveHistoryRow from "./SolveHistoryRow.svelte";
  import SolveTimeline, { timelineNote } from "./SolveTimeline.svelte";
  import { dayKey } from "../progress.js";
  import {
    currentSession,
    formatChange,
    previousSolve,
    sessionProgress,
    timerRanges,
    timerTrend,
  } from "../solve-sessions.js";
  import { getContext } from "svelte";
  import Checkbox from "../lib/components/ui/checkbox/checkbox.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let props = $props();
  const actions = getContext("actions");
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
  bulk = null,
  trendRange = "session",
})}
  {@const shown = solves.slice(-historyLimit).reverse()}
  {@const selected = new Set(bulk?.selected || [])}
  {@const shownSelected = shown.filter((solve) =>
    selected.has(solve.id),
  ).length}
  {@const running = status === "running"}
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
  {@const session = currentSession(solves, Date.now())}
  {@const progress = sessionProgress(session)}
  {@const previous = previousSolve(session, current ? current.id : null)}
  {@const trend = timerTrend(solves, trendRange, { session, today: dayKey() })}
  {@const direction = (change) =>
    change === null
      ? undefined
      : change < 0
        ? "faster"
        : change > 0
          ? "slower"
          : "same"}
  {#snippet lcd(text)}<strong
      data-ghost={/\d/.test(text) ? text.replace(/\d/g, "8") : undefined}
      >{text}</strong
    >{/snippet}
  {@const time = (value) => (value === null ? "—" : format(value))}
  <!-- One readout: a label over an LCD window of the panel's shared width. -->
  {#snippet cell(label, text, trend)}<div
      class="timer-readout"
      data-trend={trend}
    >
      <dt>{label}</dt>
      <dd>
        {@render lcd(text)}{#if trend}<span class="sr-only"
            >{trend === "same" ? "no change" : trend}</span
          >{/if}
      </dd>
    </div>{/snippet}
  {#snippet changeCell(label, value)}{@render cell(
      label,
      value === null ? "—" : formatChange(value, minutes),
      direction(value),
    )}{/snippet}
  <!-- The note shows on hover or keyboard focus; a tap pins it open for
     touch. -->
  {#snippet info(id, label, note)}<details class="timer-info">
      <summary class="secondary" aria-label={label} aria-describedby={id}
        >{@html icon("info")}<span {id} class="timer-info-note" role="tooltip"
          >{@render note()}</span
        ></summary
      >
    </details>{/snippet}
  {#snippet graphNote()}{@render timelineNote(trend)}{/snippet}
  {#snippet statsNote()}A 30-minute break starts a new session. Changes compare
    displayed times: − is faster, + is slower; ao5 vs start compares the current
    ao5 with the session's first. Averages drop the fastest and slowest solve;
    two DNFs make an average DNF. Complete 5 or 12 solves for an average.{/snippet}
  {@const mode =
    status === "running"
      ? "Run"
      : hold === "armed"
        ? "Armed"
        : hold === "holding"
          ? "Hold"
          : status === "stopped"
            ? "Done"
            : "Standby"}
  {@const countdown =
    status === "running"
      ? "SOLVE!"
      : status === "ready" && hold === "armed"
        ? "Set…"
        : status === "ready" && hold === "holding"
          ? "Ready…"
          : ""}
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
    <header class="page-toolbar">
      <h1 id="timer-heading" class="sr-only">Timer</h1>
      <p class="timer-note">Hold yellow on top, green in front.</p>
      <div class="timer-cube-choice">{@render cubeChoice()}</div>
    </header>
    <div class="timer-scramble-wrap">
      <!-- The bar keeps its place during a start so the clock never jumps; the
         countdown covers the scramble in step with the start lights. -->
      <div
        class="timer-scramble"
        data-countdown={countdown ? light : undefined}
        data-finished={status === "stopped" ? "" : undefined}
      >
        <p id="timer-scramble">{scramble}</p>
        <div class="timer-scramble-actions">
          <Button
            class="icon-button"
            data-action="scramble-preview"
            aria-label="Preview scrambled cube"
            title="Preview scrambled cube"
            aria-haspopup="dialog"
            disabled={!!countdown || status === "stopped"}
            >{@html icon("cube")}</Button
          >
          {#if status === "ready"}<Button
              class="icon-button"
              data-action="timer-new"
              aria-label="New scramble (Tab)"
              title="New scramble (Tab)"
              disabled={!!countdown}>{@html icon("shuffle")}</Button
            >{/if}
        </div>
        {#if status === "stopped"}<span class="timer-solved" aria-hidden="true"
            ><span class="timer-checks"></span><span class="timer-solved-word"
              ><span>Solved!</span></span
            ></span
          >{/if}
        {#if status === "running"}
          <!-- Each frame is a 4px-pixel tile repeated across the bar, colored
             like the logo fireball: pink-to-purple flame, lighter core, dim
             tips. CSS shows one frame at a time. -->
          <svg
            class="timer-fire"
            aria-hidden="true"
            height={timerFire.height * 4}
            shape-rendering="crispEdges"
          >
            <defs>
              <linearGradient
                id="timer-fire-outer"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2={timerFire.height}
              >
                <stop offset="0" style="stop-color: var(--brand-top)" />
                <stop offset="1" style="stop-color: var(--brand-bottom)" />
              </linearGradient>
              <linearGradient
                id="timer-fire-core"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2={timerFire.height}
              >
                <stop
                  offset="0"
                  style="stop-color: color-mix(in srgb, var(--brand-top), #fff 45%)"
                />
                <stop
                  offset="1"
                  style="stop-color: color-mix(in srgb, var(--brand-bottom), #fff 35%)"
                />
              </linearGradient>
              {#each timerFire.frames as runs, i}
                <pattern
                  id="timer-fire-{i}"
                  patternUnits="userSpaceOnUse"
                  width={timerFire.width * 4}
                  height={timerFire.height * 4}
                  viewBox="0 0 {timerFire.width} {timerFire.height}"
                >
                  {#each runs as d, level}{#if d}<path
                        {d}
                        fill="url(#timer-fire-{level < 3 ? 'outer' : 'core'})"
                        opacity={level === 0 ? 0.55 : undefined}
                      />{/if}{/each}
                </pattern>
              {/each}
            </defs>
            {#each timerFire.frames as _, i}<rect
                width="100%"
                height="100%"
                fill="url(#timer-fire-{i})"
              />{/each}
          </svg>
        {/if}
        {#if countdown}{#key countdown}<span
              class="timer-countdown"
              aria-hidden="true">{countdown}</span
            >{/key}{/if}
      </div>
      {#if status === "stopped"}
        <!-- Decorative: a confetti burst out of both sides on stop. -->
        <span class="timer-confetti" aria-hidden="true"
          >{#each timerConfetti as piece}<i
              data-side={piece.side < 0 ? "left" : "right"}
              style:--dx="{piece.dx * piece.side}px"
              style:--rise="{piece.rise}px"
              style:--fall="{piece.fall}px"
              style:--spin="{piece.spin}deg"
              style:--delay="{piece.delay}s"
              style:--w="{piece.width}px"
              style:--h="{piece.height}px"
              style:--c="var({piece.color})"
            ></i>{/each}</span
        >
      {/if}
    </div>
    <div
      class="timer-clock-panel"
      data-timer-status={status}
      data-timer-hold={hold}
      data-timer-light={light}
    >
      <!-- Decorative faceplate legend; the clock and status carry the meaning. -->
      <span class="timer-legend" aria-hidden="true"
        ><span>Solve time</span><span class="timer-mode"><i></i>{mode}</span
        ></span
      >
      <p class="timer-previous">
        Previous time: {@render lcd(
          previous ? format(solveTime(previous)) : "—",
        )}
      </p>
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
      <span class="timer-vent" aria-hidden="true"></span>
      <div class="timer-status-slot">
        {#if timerMessage}<p id="timer-status" role="status">
            {timerMessage}
          </p>{:else if current?.penalty}<p class="timer-raw">
            Raw time: {format(current.elapsed)}
          </p>{/if}
      </div>
      <Button
        id="timer-toggle"
        class="primary timer-toggle"
        data-action="timer-toggle">{action}</Button
      >
      <!-- Always in place, so finishing a solve never moves the page; the
         keys come alive for the finished solve. -->
      <div class="timer-solve-keys">
        <SolvePenalties solve={current || null} />
        <Button
          variant="secondary"
          class="timer-review"
          data-action="solve-details"
          data-id={current ? current.id : undefined}
          data-review-fallback="timer-toggle"
          aria-haspopup="dialog"
          disabled={!current}>Review solve</Button
        >
      </div>
    </div>
    <section class="timer-trend" aria-labelledby="timer-trend-heading">
      <header class="timer-panel-head">
        <h2 id="timer-trend-heading">Improvement</h2>
        {#if trend.count}{@render info(
            "timer-trend-note",
            "About this graph",
            graphNote,
          )}{/if}
      </header>
      <div
        class="dashboard-range-presets"
        role="group"
        aria-label="Graph range"
      >
        {#each timerRanges as range}<Button
            id={`timer-range-${range.value}`}
            variant="secondary"
            data-action="timer-range"
            data-range={range.value}
            aria-pressed={trendRange === range.value}
            disabled={running}>{range.label}</Button
          >{/each}
      </div>
      {#if trend.count}<SolveTimeline
          summary={trend}
          review
          fallback="timer-toggle"
          level={3}
          caption={false}
        />{:else}<p class="timer-note">
          {trendRange === "session"
            ? "No solves this session yet. The graph builds as you solve."
            : "No solves in this range."}
        </p>{/if}
    </section>
    <section class="timer-readouts" aria-label="Solve statistics">
      <header class="timer-panel-head">
        <h2>This session</h2>
        {@render info(
          "timer-readouts-note",
          "About these statistics",
          statsNote,
        )}
      </header>
      <dl class="timer-readout-grid">
        {@render cell("Solves", String(progress.count))}
        {@render cell("Mean", time(progress.mean))}
        {@render cell("Best", time(progress.best))}
        {@render changeCell("Vs previous", progress.change)}
        {@render changeCell("ao5 vs start", progress.ao5Change)}
      </dl>
      <h2>Recent</h2>
      <dl class="timer-readout-grid">
        {#each [5, 12] as count}{@const { average, best } = recentStats(
            solves,
            count,
          )}
          {@render cell(`ao${count}`, time(average))}
          {@render cell(`Best of ${count}`, time(best))}{/each}
      </dl>
    </section>
    <details class="timer-history">
      <summary>Solve history ({solves.length})</summary>
      <p class="timer-note">Open a solve to review or edit it.</p>
      {#if solves.length}
        <Button
          id="timer-select-mode"
          variant="secondary"
          data-action="timer-select-mode"
          aria-pressed={!!bulk}
          disabled={running}>{bulk ? "Done" : "Select solves"}</Button
        >
        {#if bulk}
          <section class="timer-bulk" aria-label="Bulk solve actions">
            <div class="cube-actions timer-bulk-selection">
              <Checkbox
                id="timer-select-shown"
                checked={shownSelected === shown.length}
                indeterminate={shownSelected > 0 &&
                  shownSelected < shown.length}
                disabled={running}
                onCheckedChange={(checked) =>
                  actions?.setTimerSelection(
                    shown.map((s) => s.id),
                    checked,
                  )}
              />
              <Label for="timer-select-shown"
                >Select shown solves ({shown.length})</Label
              >
            </div>
            <p class="timer-note">
              Only selects the rows shown below. Show more reveals older solves.
            </p>
            <p class="timer-bulk-count" aria-live="polite">
              {selected.size} selected
            </p>
            <div class="cube-actions timer-bulk-actions">
              <SelectControl
                id="timer-bulk-cube"
                label="Cube for selected solves"
                value={bulk.cubeId}
                disabled={running || !selected.size || bulk.confirmDelete}
                options={[
                  { value: "keep", label: "Choose cube…" },
                  { value: "", label: "Not specified" },
                  ...cubes
                    .filter((cube) => !cube.deleted)
                    .map((cube) => ({
                      value: `cube:${cube.id}`,
                      label: cube.name,
                    })),
                ]}
              />
              <Button
                data-action="timer-bulk-apply"
                disabled={running ||
                  !selected.size ||
                  bulk.cubeId === "keep" ||
                  bulk.confirmDelete}>Apply cube</Button
              >
              <Button
                data-action="timer-bulk-delete"
                variant="destructive"
                disabled={running || !selected.size || bulk.confirmDelete}
                >Delete selected</Button
              >
              <Button
                data-action="timer-bulk-clear"
                variant="secondary"
                disabled={running || !selected.size}>Clear selection</Button
              >
            </div>
            {#if bulk.confirmDelete}
              <div
                class="timer-bulk-confirm"
                role="group"
                aria-label="Confirm bulk deletion"
              >
                <p>
                  Delete {selected.size}
                  {selected.size === 1 ? "solve" : "solves"}? This cannot be
                  undone.
                </p>
                <div class="cube-actions">
                  <Button
                    id="timer-bulk-delete-cancel"
                    data-action="timer-bulk-delete-cancel"
                    variant="secondary"
                    disabled={running}>Cancel</Button
                  >
                  <Button
                    data-action="timer-bulk-delete-confirm"
                    variant="destructive"
                    disabled={running}
                    >Delete {selected.size}
                    {selected.size === 1 ? "solve" : "solves"}</Button
                  >
                </div>
              </div>
            {/if}
            {#if bulk.failed}<p role="alert">
                Changes could not be saved. Your history and selection are
                preserved. Try again.
              </p>{/if}
          </section>
        {/if}
        <p class="timer-note" role="status">
          Showing {Math.min(historyLimit, solves.length)} of {solves.length} solves.
        </p>
        <ol id="timer-history-list" reversed start={solves.length}>
          {#each shown as solve, index (solve.id)}<li>
              <div
                class="timer-history-entry"
                data-selected={bulk && selected.has(solve.id)
                  ? "true"
                  : undefined}
              >
                {#if bulk}
                  <Checkbox
                    id={`timer-select-${solve.id}`}
                    aria-label={`Select solve ${solves.length - index}`}
                    aria-describedby={`timer-solve-meta-${solve.id}`}
                    checked={selected.has(solve.id)}
                    disabled={running}
                    onCheckedChange={(checked) =>
                      actions?.setTimerSelection([solve.id], checked)}
                  />
                {/if}
                <SolveHistoryRow
                  {solve}
                  {cubes}
                  {minutes}
                  scope="timer"
                  disabled={status === "running"}
                />
              </div>
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
