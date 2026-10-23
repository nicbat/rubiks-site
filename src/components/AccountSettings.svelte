<script>
  import { getContext } from "svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Textarea from "../lib/components/ui/textarea/textarea.svelte";
  import Checkbox from "../lib/components/ui/checkbox/checkbox.svelte";
  const actions = getContext("actions");
  let { account, testData: sampleData, running } = $props();
  // Real account controls stay blocked in a training sandbox. The demo account
  // uses its own in-memory controller and can exercise those same controls.
  let testData = $derived(sampleData && !account.demo);
</script>

<section class="account-settings" aria-labelledby="account-title">
  <h2 id="account-title">Account and sync</h2>
  {#if account.demo}<p class="muted">
      Demo account. Use sign-in code 123456. No emails or cloud requests.
    </p>{/if}
  {#if !account.configured}
    <p class="muted">{account.message}</p>
  {:else if account.email}
    <p class="muted">{account.email}</p>
    {#if account.profileLoading}
      <p role="status">Loading account…</p>
    {:else if account.profileError}
      <p role="status">
        Account setup could not be loaded. Your device data is kept.
      </p>
      <Button variant="secondary" data-action="account-setup-retry"
        >Try again</Button
      >
    {:else if !account.profile}
      <form id="username-form">
        <Label for="account-username">Choose your username</Label>
        <Input
          id="account-username"
          name="username"
          value={account.usernameDraft || ""}
          required
          minlength={3}
          maxlength={24}
          pattern={"[A-Za-z][A-Za-z0-9_]{2,23}"}
          autocomplete="username"
          autocapitalize="none"
          spellcheck={false}
          disabled={account.busy}
          aria-describedby="username-help"
        />
        <p id="username-help" class="muted">
          3–24 letters, numbers or underscores, starting with a letter. Your
          username sets your page address and cannot be changed yet. Your
          profile starts private.
        </p>
        <Button
          variant="default"
          type="submit"
          disabled={account.busy || testData}>Create my page</Button
        >
      </form>
    {:else}
      <p>
        <Button variant="link" href={`#/u/${account.profile.username}`}
          >@{account.profile.username}</Button
        >
      </p>
      <p class="muted">
        {account.profile.is_public
          ? "Public profile: anyone can view your name, bio and learning goal."
          : "Private profile: only you can view your page."} Email and training history
        stay private.
      </p>
      <Button
        variant="secondary"
        data-action="account-visibility"
        disabled={account.busy || running || testData}
        >{account.profile.is_public
          ? "Make profile private"
          : "Make profile public"}</Button
      >
      <form id="profile-edit-form">
        <Label for="profile-name">Display name</Label>
        <Input
          id="profile-name"
          name="display_name"
          maxlength={60}
          value={account.profileDraft?.display_name ??
            account.profile.display_name ??
            ""}
          autocomplete="nickname"
          disabled={account.busy || testData}
        />
        <Label for="profile-bio">Bio</Label>
        <Textarea
          id="profile-bio"
          name="bio"
          maxlength={280}
          rows={3}
          value={account.profileDraft?.bio ?? account.profile.bio ?? ""}
          disabled={account.busy || testData}
        />
        <Label for="profile-goal">Learning goal</Label>
        <Input
          id="profile-goal"
          name="learning_goal"
          maxlength={120}
          value={account.profileDraft?.learning_goal ??
            account.profile.learning_goal ??
            ""}
          placeholder="Learning full PLL"
          disabled={account.busy || testData}
        />
        <Label class="setting-toggle" for="profile-share-stats">
          <Checkbox
            id="profile-share-stats"
            checked={account.profileDraft?.share_stats ??
              account.profile.share_stats ??
              false}
            onCheckedChange={(checked) =>
              actions?.setProfileField("share_stats", checked)}
            disabled={account.busy || testData}
          />
          Show statistics on my public profile
        </Label>
        <p class="muted">
          Shares solve count, best single, recent averages of 5 and 12, and
          algorithms marked known. Notes and individual solves stay private.
        </p>
        <Button
          variant="default"
          type="submit"
          disabled={account.busy || testData}>Save profile</Button
        >
      </form>
    {/if}
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
            disabled={account.busy || running || testData}
            >Add guest progress</Button
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
          disabled={account.busy || running || testData}
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
          running ||
          testData ||
          account.sync.status === "syncing"}>Sync now</Button
      >
      <Button
        variant="secondary"
        data-action="account-signout"
        disabled={account.busy || running}>Sign out</Button
      >
    </div>
    <div class="button-row">
      <Button
        variant="secondary"
        data-action="account-export"
        disabled={account.busy || testData}>Export account backup</Button
      >
      <Button
        variant="destructive"
        data-action="account-delete-preview"
        disabled={account.busy ||
          account.profileLoading ||
          account.profileError ||
          running ||
          testData}>Delete account</Button
      >
    </div>
    {#if account.deletePending}
      <form id="account-delete-form">
        <p>
          {account.demo
            ? "Delete this fake account? Your real account and data stay unchanged. Reset the demo account to restore it."
            : "Delete your account, profile and cloud training data permanently? This also clears this account’s saved data on this device. Export a backup first if you want to keep it."}
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
          <Button
            variant="secondary"
            data-action="account-delete-cancel"
            disabled={account.busy}>Keep account</Button
          >
        </div>
      </form>
    {/if}
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
          disabled={running || account.sync.status === "syncing"}
          >{account.sync.mergeConflict
            ? "Use device edits"
            : "Keep this device’s data"}</Button
        >
        <Button
          variant="secondary"
          data-action="account-cloud"
          disabled={running || account.sync.status === "syncing"}
          >{account.sync.mergeConflict
            ? "Use cloud edits"
            : "Use cloud data"}</Button
        >
      </div>
    {/if}
  {:else}
    <p class="muted">
      Sign in by email to sync progress, solves, and cubes. Guest data stays on
      this device.
    </p>
    <form id="account-form">
      <Label class="cube-field" for="account-email"
        >Email<Input
          id="account-email"
          value={account.signInEmail || ""}
          name="email"
          type="email"
          autocomplete="email"
          required
          disabled={account.busy || account.codeSent || running || testData}
        /></Label
      >
      {#if account.codeSent}
        <Label class="cube-field" for="account-code"
          >Email code<Input
            id="account-code"
            name="code"
            autocomplete="one-time-code"
            inputmode="numeric"
            required
            maxlength={10}
          /></Label
        >
      {/if}
      <div class="button-row">
        <Button
          variant="default"
          type="submit"
          disabled={account.busy || running || testData}
          >{account.codeSent ? "Verify code" : "Send sign-in email"}</Button
        >
        {#if account.codeSent}<Button
            variant="secondary"
            data-action="account-reset"
            disabled={account.busy}>Change email / resend</Button
          >{/if}
      </div>
    </form>
  {/if}
  {#if account.message && account.configured}<p role="status">
      {account.message}
    </p>{/if}
</section>

<style>
  .account-settings {
    min-width: 0;
  }
  .account-settings p {
    overflow-wrap: anywhere;
  }
  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  form {
    display: grid;
    gap: 12px;
  }
  form :global(input),
  form :global(textarea) {
    min-width: 0;
    width: 100%;
    font-size: 16px;
  }
</style>
