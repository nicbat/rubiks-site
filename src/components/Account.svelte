<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import AccountIdentity from "./AccountIdentity.svelte";
  import AccountProfile from "./AccountProfile.svelte";
  import AccountData from "./AccountData.svelte";
  import Profile from "./Profile.svelte";
  import GuestTransfer from "./GuestTransfer.svelte";
  import PersonalWorkspaceHeader from "./PersonalWorkspaceHeader.svelte";
  let { model } = $props();
  let state = $derived(model.state);
  let account = $derived(state.account || {});
  let section = $derived(state.accountSection || "settings");
</script>

<section class="account-workspace" aria-label="Your account">
  {#if section === "profile" || section === "edit"}
    <PersonalWorkspaceHeader
      current="profile"
      title={section === "edit" ? "Edit profile" : "My profile"}
      description={section === "edit"
        ? "Changes stay in your draft until you save."
        : account.profile
          ? "Saved profile. Statistics sharing is optional."
          : "Guest training stays on this device."}
    >
      {#snippet actions()}
        {#if section === "edit"}
          <Button variant="link" href="/account/profile"
            >Back to my profile</Button
          >
        {:else}
          {#if account.profile}<Button
              variant="secondary"
              href="/account/profile/edit">Edit profile</Button
            >{/if}
          <Button id="find-learner" variant="link" href="/people"
            >Find a learner</Button
          >
        {/if}
        <Button variant="link" href="/settings">Settings</Button>
      {/snippet}
    </PersonalWorkspaceHeader>
  {:else}
    <div class="page-heading">
      <h1>Account settings</h1>
      <Button variant="link" href="/account/profile">Back to my profile</Button>
    </div>
  {/if}
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
    <Card class="account-panel"
      ><AccountIdentity {account} testData={state.preferences.testData} /></Card
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
