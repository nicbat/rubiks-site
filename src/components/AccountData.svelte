<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import GuestTransfer from "./GuestTransfer.svelte";
  let {
    account,
    testData: sampleData = false,
    mode = "account",
    running = false,
    progress,
    solves = [],
    cubeCollection,
  } = $props();
  let testData = $derived(sampleData && !account.demo);
</script>

{#snippet actionButton(action, label, disabled)}
  <Button variant="secondary" data-action={action} {disabled}>{label}</Button>
{/snippet}
<section
  class="account-settings"
  aria-label={mode === "data"
    ? "Account backups and transfer"
    : "Account management"}
>
  {#if account.email}
    {#if mode === "data"}
      <div class="button-row">
        {@render actionButton(
          "account-export",
          "Export account backup",
          account.busy || running || testData,
        )}
      </div>
      {#if account.profile}
        {@render actionButton(
          "account-import-preview",
          "Bring guest progress into my account",
          account.busy || running || testData,
        )}
        {#if account.guestImportPending}
          <GuestTransfer
            {account}
            {running}
            {testData}
            {progress}
            {solves}
            {cubeCollection}
          />
        {/if}
      {/if}
    {:else}
      <div class="button-row">
        {@render actionButton("account-signout", "Sign out", account.busy)}
      </div>
      <details class="account-danger">
        <summary>Account deletion</summary>
        <div>
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
                  disabled={account.busy || running || testData}
                  >Permanently delete my account</Button
                >
                {@render actionButton(
                  "account-delete-cancel",
                  "Keep account",
                  account.busy,
                )}
              </div>
            </form>
          {/if}
        </div>
      </details>
    {/if}
    {#if account.message}<p role="status">
        {account.message}
      </p>{/if}
  {:else if mode === "data"}<p class="muted">
      Guest training stays on this device.
    </p>{/if}
</section>
