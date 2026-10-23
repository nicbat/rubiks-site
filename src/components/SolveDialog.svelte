<script>
  import { MAX_SOLVE_NOTES_LENGTH, solveTime } from "../solve-history.js";
  import { formatElapsed } from "../solve-timer.js";
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Textarea from "../lib/components/ui/textarea/textarea.svelte";
  import CubePicker from "./CubePicker.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  import SolvePenalties from "./SolvePenalties.svelte";
  import { icon } from "../icons.js";
  let { state } = $props();
  let solve = $derived(
    state.solves.find((item) => item.id === state.solveDetailId),
  );
  let time = $derived(solve && solveTime(solve));
</script>

{#if solve}
  <DialogContent id="solve-dialog" aria-labelledby="solve-title">
    <div class="dialog-heading">
      <h2 id="solve-title">Solve details</h2>
      <Button
        class="icon-button"
        data-action="close-dialog"
        aria-label="Close solve details">{@html icon("close")}</Button
      >
    </div>
    <div class="solve-result">
      <strong
        >{time === Infinity
          ? "DNF"
          : formatElapsed(time, state.preferences.timerMinutes)}</strong
      >
      <time class="timer-note" datetime={solve.date}
        >{new Date(solve.date).toLocaleString()}</time
      >
      {#if solve.penalty}<small class="timer-note"
          >Raw time: {formatElapsed(
            solve.elapsed,
            state.preferences.timerMinutes,
          )}</small
        >{/if}
    </div>
    <SolvePenalties {solve} />
    <CubePicker
      id={`solve-cube-${solve.id}`}
      label="Cube for this solve"
      cubes={state.cubeCollection.cubes}
      value={solve.cubeId}
    />
    <section class="solve-scramble" aria-labelledby="solve-scramble-title">
      <h3 id="solve-scramble-title">Scramble</h3>
      <p class="scramble-preview-moves">{solve.scramble}</p>
      <div class="cube-actions">
        <Button
          class="secondary"
          data-action="solve-preview"
          aria-expanded={state.solvePreviewVisible}
          >{state.solvePreviewVisible
            ? "Hide cube preview"
            : "Preview cube"}</Button
        >
        <Button class="text-button" data-action="solve-copy"
          >Copy scramble</Button
        >
      </div>
      {#if state.solveCopyMessage}<p role="status" class="timer-note">
          {state.solveCopyMessage}
        </p>{/if}
      {#if state.solvePreviewVisible}
        <p class="timer-note">
          After this scramble · yellow on top, green in front.
        </p>
        <CubePlayer
          id={`solve-preview-${solve.id}`}
          mode="scramble"
          algorithm={solve.scramble}
        />
      {/if}
    </section>
    <div class="cube-field">
      <Label for="solve-notes">Notes (optional)</Label>
      <Textarea
        id="solve-notes"
        value={solve.notes || ""}
        maxlength={MAX_SOLVE_NOTES_LENGTH}
        rows={4}
        placeholder="What would you like to remember?"
        aria-describedby="solve-save-status"
      />
    </div>
    <p id="solve-save-status" role="status" class="timer-note">
      {state.solveSaveFailed
        ? "Changes couldn’t be saved. Keep this tab open and retry, or export a backup."
        : "Notes are included in training backups."}
    </p>
    {#if state.solveSaveFailed}<Button
        class="secondary"
        data-action="solve-retry">Retry saving</Button
      >{/if}
    <div class="solve-delete">
      {#if state.solveDeleteConfirm}
        <p>Delete this solve and its notes?</p>
        <div class="cube-actions">
          <Button class="secondary" data-action="solve-delete-cancel"
            >Cancel</Button
          >
          <Button class="secondary" data-action="solve-delete-confirm"
            >Delete solve</Button
          >
        </div>
      {:else}
        <Button class="text-button" data-action="solve-delete"
          >Delete solve</Button
        >
      {/if}
    </div>
  </DialogContent>
{/if}
