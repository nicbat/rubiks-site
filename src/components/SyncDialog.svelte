<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  let { state } = $props();
</script>

<DialogContent id="sync-dialog" aria-labelledby="sync-title">
  <div class="dialog-heading">
    <h2 id="sync-title">Sync status</h2>
    <Button
      class="icon-button"
      data-action="close-dialog"
      aria-label="Close sync status">{@html icon("close")}</Button
    >
  </div>
  <p role="status">{state.syncStatus.label}</p>
  <p class="muted">{state.syncStatus.message}</p>
  {#if state.account.sync.failure === "auth"}<Button
      variant="secondary"
      data-action="account-reauth">Sign in again</Button
    >
  {:else if state.account.profile}<Button
      variant="secondary"
      data-action="account-sync"
      aria-disabled={!state.syncStatus.canCheck}>Check sync</Button
    >{/if}
  {#if state.account.sync.conflict}
    <p>
      {state.account.sync.mergeConflict
        ? "Choose how to resolve conflicting edits. Unrelated changes from both devices are kept."
        : "These copies have no shared baseline. Choosing a copy replaces the other. Export a backup first if you need both."}
    </p>
    <div class="button-row">
      <Button
        variant="secondary"
        data-action="account-device"
        disabled={state.account.sync.status === "syncing"}
        >{state.account.sync.mergeConflict
          ? "Use device edits"
          : "Keep this device’s data"}</Button
      ><Button
        variant="secondary"
        data-action="account-cloud"
        disabled={state.account.sync.status === "syncing"}
        >{state.account.sync.mergeConflict
          ? "Use cloud edits"
          : "Use cloud data"}</Button
      >
    </div>
  {/if}
  <Button variant="link" data-action="settings-data">Data & backups</Button>
</DialogContent>
