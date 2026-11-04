<script>
  import { accountSetupStage, accountSetupTitle } from "../account-setup.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import AccountIdentity from "./AccountIdentity.svelte";
  import AccountProfile from "./AccountProfile.svelte";
  import AccountData from "./AccountData.svelte";
  import Profile from "./Profile.svelte";
  import GuestTransfer from "./GuestTransfer.svelte";
  let { model } = $props();
  let state = $derived(model.state);
  let account = $derived(state.account || {});
  let section = $derived(state.accountSection || "settings");
  let setupStage = $derived(accountSetupStage(account));
  let identityFlow = $derived(
    account.configured && (!account.profile || account.reauth),
  );
</script>

<section class="account-workspace" aria-label="Your account">
  <div class="page-heading">
    <h1>
      {identityFlow
        ? accountSetupTitle(account)
        : section === "profile"
          ? "My profile"
          : section === "edit"
            ? "Edit profile"
            : "Account settings"}
    </h1>
    {#if section === "profile"}<div class="button-row">
        {#if account.profile}<Button
            variant="secondary"
            href="/account/profile/edit">Edit profile</Button
          >{/if}<Button variant="secondary" href="/people"
          >Find a learner</Button
        ><Button variant="link" href="/account">Account settings</Button>
      </div>
    {:else if section === "edit"}<Button
        variant="secondary"
        href="/account/profile">Back to my profile</Button
      >
    {:else if account.profile}<Button
        variant="secondary"
        href="/account/profile">My profile</Button
      >{/if}
  </div>
  {#if account.demo}<Button
      variant="secondary"
      data-action="account-demo-signup"
      disabled={account.busy}>Preview new account</Button
    >{/if}
  {#if account.profile && account.guestImportPending && !state.settings}
    <Card class="account-panel"
      ><GuestTransfer
        {account}
        testData={state.preferences.testData}
        progress={state.progress}
        solves={state.solves}
        cubeCollection={state.cubeCollection}
      /></Card
    >
  {/if}
  {#if account.setupActive && setupStage === "comparing"}
    <Card class="account-panel"
      ><section class="account-settings" aria-label="Guest progress comparison">
        <h2>Guest progress</h2>
        <p role="status">Syncing before comparing guest progress…</p>
        <Button variant="secondary" data-action="account-import-cancel"
          >Keep separate</Button
        >
      </section></Card
    >
  {/if}
  {#if account.setupActive && setupStage === "ready"}
    <Card class="account-panel">
      <section class="account-settings" aria-label="Account setup complete">
        <h2>Signed in as @{account.profile.username}</h2>
        <Button variant="default" data-action="account-setup-continue"
          >Continue learning</Button
        >
      </section>
    </Card>
  {/if}
  {#if account.profile && section === "profile" && account.message}
    <p role="status">{account.message}</p>
  {/if}
  {#if section === "profile" && account.profile}
    <Profile page={state.profilePage} {account} embedded lookup={false} />
  {:else if section === "edit" && account.profile}
    <Card class="account-panel"
      ><AccountProfile
        {account}
        page={state.profilePage}
        testData={state.preferences.testData}
      /></Card
    >
  {:else}
    <Card
      class={identityFlow
        ? "account-panel account-auth-panel"
        : "account-panel"}
      ><AccountIdentity
        {account}
        heading={false}
        testData={state.preferences.testData}
      /></Card
    >
    {#if account.email}<Card class="account-panel"
        >{#if account.profile}<Button variant="link" data-action="sync-details"
            >Sync status</Button
          >{/if}<AccountData
          {account}
          testData={state.preferences.testData}
        /></Card
      >{/if}
    <Button variant="secondary" data-action="settings-data"
      >Data & backups</Button
    >
  {/if}
</section>
