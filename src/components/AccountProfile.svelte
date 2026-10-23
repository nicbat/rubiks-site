<script>
  import { getContext } from "svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Textarea from "../lib/components/ui/textarea/textarea.svelte";
  import Checkbox from "../lib/components/ui/checkbox/checkbox.svelte";
  import Profile from "./Profile.svelte";
  import { visitorProfile, profileHasDraft } from "../profiles.js";
  const actions = getContext("actions");
  let {
    account,
    testData: sampleData = false,
    page = { status: "idle", profile: null },
  } = $props();
  let testData = $derived(sampleData && !account.demo);
  let dirty = $derived(profileHasDraft(account));
</script>

<section class="account-settings" aria-label="Profile settings">
  {#if account.profile}
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
      disabled={account.busy || testData}
      >{account.profile.is_public
        ? "Make profile private"
        : "Make profile public"}</Button
    >
    {#if dirty}<p role="status">You have unsaved profile changes.</p>{/if}
    <form id="profile-edit-form">
      {#each [["profile-name", "display_name", "Display name", 60], ["profile-bio", "bio", "Bio", 280], ["profile-goal", "learning_goal", "Learning goal", 120]] as [id, name, label, maximum]}
        <Label for={id}>{label}</Label>
        {#if name === "bio"}<Textarea
            {id}
            {name}
            maxlength={maximum}
            rows={3}
            value={account.profileDraft?.[name] ?? account.profile[name] ?? ""}
            disabled={account.busy || testData}
          />
        {:else}<Input
            {id}
            {name}
            maxlength={maximum}
            value={account.profileDraft?.[name] ?? account.profile[name] ?? ""}
            autocomplete={name === "display_name" ? "nickname" : undefined}
            placeholder={name === "learning_goal"
              ? "Learning full PLL"
              : undefined}
            disabled={account.busy || testData}
          />{/if}
      {/each}
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
        Share solve count, best single, averages of 5 and 12, and known
        algorithms. Individual solves and notes stay private.
      </p>
      <Button
        variant="default"
        type="submit"
        disabled={account.busy || testData}>Save profile</Button
      >
      {#if dirty}<Button
          variant="secondary"
          data-action="account-profile-discard"
          disabled={account.busy}>Discard changes</Button
        >{/if}
    </form>
    {#if account.message && account.configured}<p role="status">
        {account.message}
      </p>{/if}
    <details class="visitor-preview" aria-label="Visitor preview">
      <summary>View as a visitor</summary>
      <p class="muted">
        Saved profile. Email and training history stay private.
      </p>
      <Profile
        preview
        page={{
          ...page,
          status: account.profile.is_public ? page.status : "ready",
          profile:
            page.status === "error"
              ? null
              : visitorProfile({
                  ...account.profile,
                  stats:
                    page.profile?.username === account.profile.username
                      ? page.profile.stats
                      : null,
                }),
        }}
      />
    </details>
  {:else}<p>Finish account setup to edit your profile.</p>
    <Button variant="secondary" href="#/account/profile"
      >Open account setup</Button
    >{/if}
</section>
