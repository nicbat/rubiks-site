<script>
  import { getContext } from "svelte";
  import { normalizeUsername } from "../profiles.js";
  import { accountSetupStage } from "../account-setup.js";
  import ProfilePicture from "./ProfilePicture.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { account, testData: sampleData = false } = $props();
  const actions = getContext("actions");
  let testData = $derived(sampleData && !account.demo);
  let stage = $derived(accountSetupStage(account));
  let preview = $derived(normalizeUsername(account.usernameDraft));
  let now = $state(Date.now());
  let resendSeconds = $derived(
    Math.max(0, Math.ceil(((account.resendAvailableAt || 0) - now) / 1000)),
  );
  $effect(() => {
    const until = account.resendAvailableAt;
    const current = Date.now();
    now = current;
    if (!until || until <= current) return;
    const timer = setInterval(() => {
      now = Date.now();
      if (now >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  });
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
      <h2>Finish account setup</h2>
      <p>A username is required to sync your progress across devices.</p>
      <form id="username-form" novalidate>
        <Label for="account-username">Choose your username</Label>
        <Input
          id="account-username"
          name="username"
          value={account.usernameDraft || ""}
          required
          placeholder="cube_learner"
          oninput={(event) =>
            actions?.setAccountField(
              "usernameDraft",
              event.currentTarget.value,
            )}
          autocomplete="username"
          autocapitalize="none"
          spellcheck={false}
          disabled={account.busy}
          aria-describedby={account.usernameError
            ? "username-help username-error"
            : "username-help"}
          aria-invalid={!!account.usernameError}
        />
        <p id="username-help" class="muted">
          3–24 characters. Start with an English letter (a–z); use letters,
          numbers or underscores. Saved in lowercase.
        </p>
        {#if preview}<p class="username-preview">
            Your username: <strong>@{preview}</strong>
          </p>{/if}
        <p class="muted">
          Your username cannot currently be changed. Your display name can be
          changed later.
        </p>
        <p class="muted">
          Your profile is discoverable. Statistics start private.
        </p>
        {#if account.usernameError}<p id="username-error" role="alert">
            {account.usernameError}
          </p>{/if}
        <Button
          variant="default"
          type="submit"
          disabled={account.busy || testData}>Finish account setup</Button
        >
      </form>
    {/if}
  {:else}
    <h2>
      {account.reauth
        ? "Sign in again"
        : stage === "verify"
          ? "Check your email"
          : "Sign in or create an account"}
    </h2>
    <p class="muted">
      {stage === "verify"
        ? "Open the link in your email, or paste its code below."
        : "Sync progress, solves and cubes across devices. No password needed."}
      Guest progress stays on this device until you choose to add it.
    </p>
    <form id="account-form">
      <Label class="cube-field" for="account-email"
        >Email<Input
          id="account-email"
          value={account.signInEmail || ""}
          name="email"
          placeholder="you@example.com"
          oninput={(event) =>
            actions?.setAccountField("signInEmail", event.currentTarget.value)}
          type="email"
          autocomplete="email"
          required
          readonly={account.reauth || account.codeSent}
          disabled={account.busy || testData}
          aria-describedby={account.signInError ? "signin-error" : undefined}
          aria-invalid={!!account.signInError && !account.codeSent}
        /></Label
      >
      {#if account.codeSent}
        <Label class="cube-field" for="account-code"
          >Email code<Input
            id="account-code"
            name="code"
            value={account.codeDraft || ""}
            oninput={(event) =>
              actions?.setAccountField("codeDraft", event.currentTarget.value)}
            aria-describedby={account.signInError ? "signin-error" : undefined}
            aria-invalid={!!account.signInError}
            disabled={account.busy}
            autocomplete="one-time-code"
            inputmode="numeric"
            required
            maxlength={32}
          /></Label
        >
      {/if}
      {#if account.signInError}<p id="signin-error" role="alert">
          {account.signInError}
        </p>{/if}
      <div class="button-row">
        <Button
          variant="default"
          type="submit"
          disabled={account.busy ||
            testData ||
            (!account.codeSent && resendSeconds > 0)}
          >{account.busy
            ? account.codeSent
              ? "Verifying…"
              : "Sending…"
            : account.codeSent
              ? "Verify code"
              : "Continue with email"}</Button
        >
        {#if account.codeSent}<Button
            variant="secondary"
            data-action="account-resend"
            disabled={account.busy || resendSeconds > 0}>Resend code</Button
          >
          {#if !account.reauth}<Button
              variant="secondary"
              data-action="account-reset"
              disabled={account.busy}>Change email</Button
            >{/if}
        {/if}
      </div>
    </form>
    {#if resendSeconds > 0}<p class="muted">
        You can resend in {resendSeconds}s.
      </p>{/if}
    {#if !account.reauth}<Button variant="link" href="/dashboard"
        >Continue as guest</Button
      >{/if}
  {/if}
  {#if account.message && account.configured && (!account.profile || account.reauth)}<p
      role="status"
    >
      {account.message}
    </p>{/if}
</section>
