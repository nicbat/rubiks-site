<script>
  import ProfilePicture from "./ProfilePicture.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { account, testData: sampleData = false } = $props();
  let testData = $derived(sampleData && !account.demo);
</script>

<section class="account-settings" aria-label="Sign-in and identity">
  {#if account.demo}<p class="muted">
      Demo account. Use sign-in code 123456. No emails or cloud requests.
    </p>{/if}
  {#if !account.configured}
    <p class="muted">{account.message}</p>
  {:else if account.email && !account.reauth}
    <p class="muted">{account.email}</p>
    {#if account.profile}<ProfilePicture id={account.profile.avatar_id} />
      <h3>
        {account.profile.display_name || `@${account.profile.username}`}
      </h3>
      <Button variant="link" href={`/u/${account.profile.username}`}
        >@{account.profile.username}</Button
      >
    {/if}
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
          3–24 letters, numbers or underscores; start with a letter. Your
          username is permanent. Your profile is discoverable; statistics start
          private.
        </p>
        <Button
          variant="default"
          type="submit"
          disabled={account.busy || testData}>Create my page</Button
        >
      </form>
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
          readonly={account.reauth}
          autocomplete="email"
          required
          disabled={account.busy || account.codeSent || testData}
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
          disabled={account.busy || testData}
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
  {#if account.message && account.configured && (!account.profile || account.reauth)}<p
      role="status"
    >
      {account.message}
    </p>{/if}
</section>
