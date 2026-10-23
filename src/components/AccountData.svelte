<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { account, testData: sampleData = false } = $props();
  let testData = $derived(sampleData && !account.demo);
</script>

<section class="account-settings" aria-label="Sync and account data">
  <h2>Automatic sync</h2>
  {#if account.email}
    <p class="muted">{account.email}</p>
    <p role="status">
      {testData
        ? "Sync paused for test data."
        : !account.profile
          ? "Sync starts after account setup."
          : account.sync.message}
    </p>
    {#if account.profile}<p class="muted">
        {account.demo
          ? "Demo changes stay in this tab. Reset the demo account to start again."
          : "Saved changes sync automatically. Offline changes upload when you reconnect."}
      </p>{/if}
    <p class="muted">
      Guest data stays separate. Display settings stay on this device.
    </p>
    {#if account.profile}
      {#if account.guestImportPending}
        <p>
          Add this device’s guest progress, solves and cubes to your account?
          Existing account edits win if the same record differs. The guest copy
          stays here.
        </p>
        <div class="button-row">
          <Button
            variant="secondary"
            data-action="account-import-guest"
            disabled={account.busy || testData}>Add guest progress</Button
          >
          <Button
            variant="secondary"
            data-action="account-import-cancel"
            disabled={account.busy}>Cancel guest transfer</Button
          >
        </div>
      {:else}
        <Button
          variant="secondary"
          data-action="account-import-preview"
          disabled={account.busy || testData}
          >Bring guest progress into my account</Button
        >
      {/if}
    {/if}
    <div class="button-row">
      <Button
        variant="default"
        data-action="account-sync"
        disabled={account.busy ||
          !account.profile ||
          testData ||
          account.sync.status === "syncing"}>Sync now</Button
      >
      <Button
        variant="secondary"
        data-action="account-signout"
        disabled={account.busy}>Sign out</Button
      >
    </div>
    <h2>Account backup</h2>
    <div class="button-row">
      <Button
        variant="secondary"
        data-action="account-export"
        disabled={account.busy || testData}>Export account backup</Button
      >
    </div>
    <section class="account-danger" aria-labelledby="account-danger-title">
      <h2 id="account-danger-title">Delete account</h2>
      <p class="muted">
        Export a backup before permanently deleting your account.
      </p>
      <Button
        variant="destructive"
        data-action="account-delete-preview"
        disabled={account.busy ||
          account.profileLoading ||
          account.profileError ||
          testData}>Delete account</Button
      >
      {#if account.deletePending}
        <form id="account-delete-form">
          <p>
            {account.demo
              ? "Delete this demo account? Reset restores it. Your real data is kept."
              : "Permanently delete your account, profile and cloud training data? This clears this account’s data on this device. Export a backup first."}
          </p>
          <Label for="account-delete-confirmation"
            >Type {account.profile?.username || "DELETE"} to confirm</Label
          >
          <Input
            id="account-delete-confirmation"
            name="confirmation"
            value={account.deleteConfirmation || ""}
            autocomplete="off"
            required
            disabled={account.busy}
          />
          <div class="button-row">
            <Button
              variant="destructive"
              type="submit"
              disabled={account.busy || testData}
              >Permanently delete my account</Button
            >
            <Button
              variant="secondary"
              data-action="account-delete-cancel"
              disabled={account.busy}>Keep account</Button
            >
          </div>
        </form>
      {/if}
    </section>
    {#if account.sync.conflict && !testData}
      <p class="muted">
        {account.sync.mergeConflict
          ? "Your choice applies to conflicting edits. Other changes from both devices will be combined."
          : "The sync baseline is unavailable. Choosing a copy replaces the other copy, including deletions. Export a backup first if you need both."}
      </p>
      <div class="button-row">
        <Button
          variant="secondary"
          data-action="account-device"
          disabled={account.sync.status === "syncing"}
          >{account.sync.mergeConflict
            ? "Use device edits"
            : "Keep this device’s data"}</Button
        >
        <Button
          variant="secondary"
          data-action="account-cloud"
          disabled={account.sync.status === "syncing"}
          >{account.sync.mergeConflict
            ? "Use cloud edits"
            : "Use cloud data"}</Button
        >
      </div>
    {/if}
    {#if account.message}<p role="status">{account.message}</p>{/if}
  {:else}<p>
      Guest progress stays on this device. Sign in to sync across devices.
    </p>
    <Button variant="secondary" href="#/account">Open sign-in</Button>{/if}
</section>
