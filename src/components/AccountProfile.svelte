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
    <Button variant="secondary" data-action="account-copy-profile"
      >Copy profile link</Button
    >
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
    <section class="visitor-preview" aria-label="Visitor preview">
      <h2>View as a visitor</h2>
      <p class="muted">
        Saved profile. Email and training history stay private.
      </p>
      {#if dirty}<p role="status">You have unsaved profile changes.</p>{/if}
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
    </section>
  {:else}<p>Finish account setup to edit your profile.</p>
    <Button variant="secondary" href="#/account">Open account setup</Button
    >{/if}
</section>
