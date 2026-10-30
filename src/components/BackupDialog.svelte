<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import MergeSummary from "./MergeSummary.svelte";
  import OriginRecovery from "./OriginRecovery.svelte";
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
        Test data is on. Exports contain sample data; imports affect only the
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
      {#if state.earlierLearning && !state.preferences?.testData}
        <p>An earlier learning copy is available in this browser.</p>
        <Button variant="secondary" data-action="export-earlier-learning"
          >Export earlier learning</Button
        >
      {/if}
    </div>
    <div class="backup-block">
      <h2>Import</h2>
      <p>
        Merge a backup with or replace {state.preferences?.testData
          ? "the test data"
          : state.account?.email
            ? "your account’s training data"
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
                .cubeCollection.cubes.length} cubes.
            {:else}Learning-only backup. Timer solves and cubes will be kept.{/if}
          </p>
          <MergeSummary summary={state.importPreview} />
          {#if pendingImport.legacyAttempts}<p class="muted">
              This file has {pendingImport.legacyAttempts} attempts without original
              IDs. Importing this same learning backup again counts them once. Overlapping
              attempts from different legacy backups may be added again.
            </p>{/if}
          <Button
            class="primary"
            data-action="merge-import"
            disabled={!state.importPreview || !!state.importPreview.error}
            >Merge with current data</Button
          >
          <p>
            Replace instead removes your current {progress.attempts.length} attempts
            and
            {progress.selected.length} selected cases.
            {#if pendingImport.solves}It also replaces all timer solves and
              cubes.{/if}
          </p>
          {#if state.account?.email && !state.preferences?.testData}<p
              class="muted"
            >
              Changes apply to your signed-in account and sync to other devices.
            </p>{/if}
          <Button variant="secondary" data-action="confirm-import"
            >Replace with this backup</Button
          >
        </div>{/if}
    </div>
    <OriginRecovery />
    <p class="muted">
      Clearing browser data also clears your progress. Guest progress stays on
      this device. Signed-in account data syncs automatically.
    </p></DialogContent
  >
{/snippet}
{@render content(model)}
