<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state } = model}
  {@const { progress, pendingImport } = state}

  <DialogContent id="backup-dialog" aria-labelledby="backup-title"
    ><div class="dialog-heading">
      <span>Local progress</span><Button
        class="icon-button"
        data-action="close-dialog"
        aria-label="Close backup">{@html icon("close")}</Button
      >
    </div>
    <h1 id="backup-title">Backup & transfer</h1>
    {#if state.preferences?.testData}<p>
        Test data is on. Exports contain sample data; imports replace only the
        sample data in this tab.
      </p>{:else}<p>
        Your learning history, timer solves, and cubes are saved in this
        browser. Backups include all three. Display settings stay on this
        device.
      </p>{/if}
    <div class="backup-block">
      <h2>Export</h2>
      <p>Download a JSON backup for storage or transfer.</p>
      <Button class="primary" data-action="export"
        >{@html icon("download")} Export progress</Button
      >
    </div>
    <div class="backup-block">
      <h2>Import</h2>
      <p>
        Review a backup before replacing {state.preferences?.testData
          ? "the test data"
          : "this browser’s progress"}.
      </p>
      <Label class="file-label"
        >Choose backup file<Input
          id="import-file"
          type="file"
          accept=".json,application/json"
        /></Label
      >
      <div id="import-message" role="status">{state.importMessage || ""}</div>
      {#if pendingImport}<div class="import-preview">
          {#if pendingImport.legacyVersion === 1}<p>
              Version 1 backup: learning history will be converted to version 2.
              Original practice dates and algorithm variants are kept.
            </p>{/if}
          <strong
            >{pendingImport.progress.selected.length} selected cases · {pendingImport
              .progress.attempts.length} attempts · {pendingImport.progress
              .reviewed?.length || 0} reviewed lessons</strong
          >
          <p>
            {#if pendingImport.solves}
              Includes {pendingImport.solves.length} solves and {pendingImport
                .cubeCollection.cubes.length} cubes. This replaces all learning, solves,
              and cubes.
            {:else}Learning-only backup. Timer solves and cubes will be kept.{/if}
          </p>
          <p>
            This will replace your current {progress.attempts.length} attempts and
            {progress.selected.length} selected cases.
          </p>
          <Button class="primary" data-action="confirm-import"
            >Replace with this backup</Button
          >
        </div>{/if}
    </div>
    <p class="muted">
      Clearing browser data also clears your progress. Guest progress stays on
      this device. Signed-in account data syncs automatically.
    </p></DialogContent
  >
{/snippet}
{@render content(model)}
