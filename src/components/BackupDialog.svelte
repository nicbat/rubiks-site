<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
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
    <p>
      Your courses, reviewed lessons, shared progress links, and practice
      history are saved in this browser.
    </p>
    <div class="backup-block">
      <h2>Export</h2>
      <p>Download a JSON backup for storage or transfer.</p>
      <Button class="primary" data-action="export"
        >{@html icon("download")} Export progress</Button
      >
    </div>
    <div class="backup-block">
      <h2>Import</h2>
      <p>Review a backup before replacing this browser’s progress.</p>
      <Label class="file-label"
        >Choose backup file<input
          id="import-file"
          type="file"
          accept=".json,application/json"
        /></Label
      >
      <div id="import-message" role="status">{state.importMessage || ""}</div>
      {#if pendingImport}<div class="import-preview">
          <strong
            >{pendingImport.selected.length} selected cases · {pendingImport
              .attempts.length} attempts · {pendingImport.reviewed?.length || 0} reviewed
            lessons</strong
          >
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
      Clearing browser data also clears your progress. Phone and laptop progress
      do not sync automatically.
    </p></DialogContent
  >
{/snippet}
{@render content(model)}
