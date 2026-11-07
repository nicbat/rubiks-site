<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import ProfilePicture from "./ProfilePicture.svelte";
  import AccountIdentity from "./AccountIdentity.svelte";
  import AccountSyncStatus from "./AccountSyncStatus.svelte";
  let { account = {}, testData = false, message = "", sync } = $props();
</script>

<section class="personal-profile" aria-labelledby="personal-profile-title">
  <div class="page-heading">
    <h1 id="personal-profile-title">Profile</h1>
    <div class="button-row">
      {#if account.profile}<Button
          variant="secondary"
          href="/account/profile/edit">Edit profile</Button
        >{/if}
      <Button id="find-learner" variant="link" href="/people"
        >Find a learner</Button
      >
      <Button variant="link" href="/settings">Settings</Button>
      <Button variant="link" data-action="backup">Backup & transfer</Button>
    </div>
  </div>
  {#if account.profile}
    <div class="profile-identity">
      <ProfilePicture id={account.profile.avatar_id} />
      <div class="identity-copy">
        <h2>
          {account.profile.display_name || `@${account.profile.username}`}
        </h2>
        {#if account.profile.display_name}<p>
            <Button variant="link" href={`/u/${account.profile.username}`}
              >@{account.profile.username}</Button
            >
          </p>{/if}
        {#if account.profile.bio}<p class="profile-bio">
            {account.profile.bio}
          </p>{/if}
        {#if account.profile.learning_goal}<p>
            <strong>Learning goal:</strong>
            {account.profile.learning_goal}
          </p>{/if}
        <Button variant="link" data-action="account-copy-profile"
          >Copy profile link</Button
        >
      </div>
    </div>
    <p class="muted">
      Public summary: {account.profile.is_public ? "shared" : "private"}.
      Individual solves, notes and detailed history stay private.
    </p>
    <AccountSyncStatus {account} demo={testData} presentation={sync} />
  {:else if account.email}
    <AccountIdentity {account} {testData} />
  {:else}
    <p class="muted">
      Your training stays on this device. No sign-in is needed.
    </p>
    <details class="profile-sign-in">
      <summary>Sign in to sync across devices</summary>
      <AccountIdentity {account} {testData} />
    </details>
  {/if}
  {#if message || account.message}<p role="status">
      {message || account.message}
    </p>{/if}
</section>

<style>
  .personal-profile {
    min-width: 0;
    margin-bottom: 24px;
  }
  .page-heading {
    margin-block: 28px 20px;
  }
  .button-row {
    align-items: center;
    gap: 8px 20px;
  }
  .profile-identity {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }
  .identity-copy {
    min-width: 0;
    flex: 1;
  }
  h2 {
    margin: 0;
    overflow-wrap: anywhere;
  }
  p {
    margin: 6px 0;
    max-width: 70ch;
    overflow-wrap: anywhere;
  }
  .profile-bio {
    white-space: pre-wrap;
  }
  details {
    margin-top: 12px;
  }
  summary {
    cursor: pointer;
    min-height: 44px;
    padding-block: 12px;
  }
  @media (max-width: 480px) {
    .profile-identity {
      gap: 12px;
    }
  }
</style>
