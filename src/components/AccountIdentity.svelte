<script>
  import { getContext } from "svelte";
  import { normalizeUsername } from "../profiles.js";
  import { accountSetupStage, accountSetupTitle } from "../account-setup.js";
  import ProfilePicture from "./ProfilePicture.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  let { account, heading = true, testData: sampleData = false } = $props();
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
      Demo account. Code: 123456. No email is sent.
    </p>{/if}
  {#if !account.configured}
    <p class="muted">{account.message}</p>
  {:else if account.email && !account.reauth}
    <p class="muted">{account.email}</p>
    {#if account.profile}<ProfilePicture id={account.profile.avatar_id} />
      <h3>{account.profile.display_name || `@${account.profile.username}`}</h3>
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
      {#if heading}<h2>{accountSetupTitle(account)}</h2>{/if}
      <form id="username-form" class="auth-form" novalidate>
        <div class="auth-field">
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
              ? "username-error username-help username-policy"
              : "username-help username-policy"}
            aria-invalid={!!account.usernameError}
          />
          {#if account.usernameError}<p
              id="username-error"
              class="field-error"
              role="alert"
            >
              {account.usernameError}
            </p>{/if}
          <p id="username-help" class="muted">
            3–24 characters: a–z, 0–9 or _. Start with a letter.
          </p>
          <p id="username-policy" class="muted">
            Saved in lowercase. Cannot be changed.
          </p>
          {#if preview}<p class="username-preview">
              <strong>@{preview}</strong>
            </p>{/if}
        </div>
        <Button
          variant="default"
          type="submit"
          disabled={account.busy || testData}>Finish account setup</Button
        >
        <p class="muted">
          Your profile is visible to everyone. Statistics start private.
        </p>
      </form>
    {/if}
  {:else}
    {#if heading}<h2>{accountSetupTitle(account)}</h2>{/if}
    {#if stage !== "verify"}<p class="muted">
        Sync your progress across devices. No password needed.
      </p>{/if}
    <form id="account-form" class="auth-form">
      {#if account.codeSent}
        <div class="auth-recipient">
          <p>Sent to <strong>{account.signInEmail}</strong></p>
          {#if !account.reauth}<Button
              variant="link"
              data-action="account-reset"
              disabled={account.busy}>Change email</Button
            >{/if}
        </div>
        <div class="auth-field">
          <Label for="account-code">Email code</Label>
          <Input
            id="account-code"
            class="auth-code-input"
            name="code"
            value={account.codeDraft || ""}
            oninput={(event) =>
              actions?.setAccountField("codeDraft", event.currentTarget.value)}
            aria-describedby={account.signInError
              ? "signin-error code-help"
              : "code-help"}
            aria-invalid={!!account.signInError}
            disabled={account.busy}
            autocomplete="one-time-code"
            inputmode="numeric"
            required
            maxlength={32}
          />
          {#if account.signInError}<p
              id="signin-error"
              class="field-error"
              role="alert"
            >
              {account.signInError}
            </p>{/if}
          <p id="code-help" class="muted">
            Enter the code or open the link in your email.
          </p>
        </div>
      {:else}
        <div class="auth-field">
          <Label for="account-email">Email</Label>
          <Input
            id="account-email"
            value={account.signInEmail || ""}
            name="email"
            placeholder="you@example.com"
            oninput={(event) =>
              actions?.setAccountField(
                "signInEmail",
                event.currentTarget.value,
              )}
            type="email"
            autocomplete="email"
            readonly={account.reauth}
            required
            disabled={account.busy || testData}
            aria-describedby={account.signInError ? "signin-error" : undefined}
            aria-invalid={!!account.signInError}
          />
          {#if account.signInError}<p
              id="signin-error"
              class="field-error"
              role="alert"
            >
              {account.signInError}
            </p>{/if}
        </div>
      {/if}
      <div class="auth-actions">
        <Button
          variant="default"
          type="submit"
          disabled={account.busy ||
            testData ||
            (!account.codeSent && resendSeconds > 0)}
          >{account.busy
            ? "Please wait…"
            : account.codeSent
              ? "Verify code"
              : "Continue with email"}</Button
        >
        {#if account.codeSent}<Button
            variant="link"
            data-action="account-resend"
            disabled={account.busy || resendSeconds > 0}>Resend code</Button
          >{/if}
      </div>
      {#if resendSeconds > 0}<p class="muted">
          Resend available in {resendSeconds}s.
        </p>{/if}
    </form>
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
