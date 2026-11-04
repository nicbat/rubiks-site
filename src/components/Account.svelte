<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import AccountIdentity from "./AccountIdentity.svelte";
  import AccountProfile from "./AccountProfile.svelte";
  import AccountData from "./AccountData.svelte";
  import GuestTransfer from "./GuestTransfer.svelte";
  import AccountSyncStatus from "./AccountSyncStatus.svelte";
  let { model } = $props();
  let state = $derived(model.state);
  let account = $derived(state.account || {});
  let section = $derived(state.accountSection || "settings");
</script>

<section class="account-workspace" aria-label="Your account">
  <div class="page-heading">
    <h1>{section === "edit" ? "Edit profile" : "Account settings"}</h1>
    <Button variant="link" href="/progress">Back to my profile</Button>
  </div>
  <AccountSyncStatus
    {account}
    demo={state.preferences.testData}
    presentation={state.syncStatus}
    notice={state.notice}
  />
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
  {#if section === "edit" && account.profile}
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
        ><AccountData {account} testData={state.preferences.testData} /></Card
      >{/if}
    <Button variant="secondary" data-action="settings-data"
      >Data & backups</Button
    >
  {/if}
</section>
