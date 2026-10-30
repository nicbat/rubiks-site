<script>
  import ProfilePicture from "./ProfilePicture.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  let {
    page,
    account = {},
    preview = false,
    embedded = false,
    lookup = true,
  } = $props();
</script>

<section
  class="profile-page"
  aria-labelledby={preview ? "visitor-profile-title" : "profile-title"}
>
  <div class="page-heading">
    <svelte:element
      this={preview ? "h3" : embedded ? "h2" : "h1"}
      id={preview ? "visitor-profile-title" : "profile-title"}
    >
      {page.profile
        ? page.profile.display_name || `@${page.profile.username}`
        : page.status === "search"
          ? "Find a learner"
          : "Profile"}
    </svelte:element>
  </div>
  {#if page.status !== "search"}<Card class="profile-card">
      {#if page.status === "loading"}<p role="status">Loading profile…</p>
      {:else if page.profile}
        <ProfilePicture id={page.profile.avatar_id} />
        {#if page.profile.display_name}<p>@{page.profile.username}</p>{/if}
        {#if page.profile.bio}<p class="profile-bio">{page.profile.bio}</p>{/if}
        {#if page.profile.learning_goal}<p>
            <strong>Learning goal:</strong>
            {page.profile.learning_goal}
          </p>{/if}
        {#if !preview}<Button
            variant="secondary"
            data-action="account-copy-profile">Copy profile link</Button
          >{/if}
        {#if account.profile?.username === page.profile.username}
          <p class="muted">
            {account.profile.is_public
              ? "Your profile and all-time progress summary are public."
              : "Your profile is discoverable. Only you can view your statistics."}
          </p>
          {#if !embedded}<Button
              variant="secondary"
              href="/account/profile/edit">Edit profile</Button
            >{/if}
        {/if}
      {:else}<p role="status">
          {page.status === "error"
            ? "Profile could not be loaded. Check your connection and try again."
            : "This profile is unavailable."}
        </p>
        {#if page.status === "error"}<Button
            variant="secondary"
            data-action="account-profile-retry">Try again</Button
          >{/if}
      {/if}
    </Card>{/if}
  {#if !preview && page.status !== "search" && page.message}<p role="status">
      {page.message}
    </p>{/if}
  {#if page.profile?.stats}
    <section class="profile-summary" aria-label="All-time progress">
      <svelte:element this={preview ? "h4" : "h2"}
        >All-time progress</svelte:element
      >
      <p class="muted">
        3×3 · All cubes · Full CFOP confidence · {account.demo
          ? "Demo training"
          : "Last synced training"}
      </p>
      <ProgressSummary stats={page.profile.stats} />
    </section>
  {:else if page.profile && !page.profile.is_public && (preview || account.profile?.username !== page.profile.username)}
    <p role="status">Statistics are private.</p>
  {:else if page.profile}
    <ProfilePicture id={page.profile.avatar_id} />
    <p role="status">Progress summary is temporarily unavailable.</p>
    {#if !preview}<Button
        variant="secondary"
        data-action="account-profile-retry">Try again</Button
      >{/if}
  {/if}
  {#if !preview && lookup && page.status !== "search"}
    <Button variant="link" href="/people">Find a learner</Button>
  {/if}
  {#if !preview && lookup && page.status === "search"}<form
      id="profile-lookup-form"
    >
      <Label for="profile-lookup">Look up a username</Label>
      <Input
        id="profile-lookup"
        name="username"
        required
        minlength={3}
        maxlength={24}
        autocomplete="off"
        autocapitalize="none"
        spellcheck={false}
      />
      <Button variant="secondary" type="submit">View profile</Button>
      <p class="muted" role="status">
        {page.message ||
          (account.demo
            ? "Demo lookup: demo_friend shares stats; demo_private keeps stats private."
            : "Look up any username. Learners choose whether to share their statistics.")}
      </p>
    </form>{/if}
</section>

<style>
  .profile-page {
    width: 100%;
    min-width: 0;
  }
  .profile-page h1,
  .profile-page p {
    overflow-wrap: anywhere;
  }
  .profile-page :global(.profile-card) {
    padding: 24px;
  }
  .profile-bio {
    white-space: pre-wrap;
  }
  .profile-summary {
    margin-top: 24px;
    min-width: 0;
  }
  .profile-summary :is(h2, h4) {
    font-size: 1.25rem;
  }
  form {
    display: grid;
    gap: 12px;
    margin-top: 24px;
    max-width: 360px;
  }
  form :global(input) {
    width: 100%;
    min-width: 0;
    font-size: 16px;
  }
</style>
