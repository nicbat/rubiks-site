<script>
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
</script>

<section class="account-workspace" aria-label="Your account">
  <div class="page-heading">
    <h1>
      {section === "profile"
        ? "My profile"
        : section === "edit"
          ? "Edit profile"
          : "Account settings"}
    </h1>
    {#if section === "profile"}<div class="button-row">
        {#if account.profile}<Button
            variant="secondary"
            href="#/account/profile/edit">Edit profile</Button
          >{/if}<Button variant="link" href="#/account">Account settings</Button
        >
      </div>
    {:else if section === "edit"}<Button
        variant="secondary"
        href="#/account/profile">Back to my profile</Button
      >
    {:else if account.profile}<Button
        variant="secondary"
        href="#/account/profile">My profile</Button
      >{/if}
  </div>
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
