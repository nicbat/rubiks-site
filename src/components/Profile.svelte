<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import { formatElapsed } from "../solve-timer.js";
  let { page, account } = $props();
</script>

<section class="profile-page" aria-labelledby="profile-title">
  <div class="page-heading">
    <h1 id="profile-title">
      {page.profile
        ? page.profile.display_name || `@${page.profile.username}`
        : page.status === "search"
          ? "Find a learner"
          : "Profile"}
    </h1>
  </div>
  {#if page.status !== "search"}<Card class="profile-card">
      {#if page.status === "loading"}<p role="status">Loading profile…</p>
      {:else if page.profile}
        {#if page.profile.display_name}<p>@{page.profile.username}</p>{/if}
        {#if page.profile.bio}<p class="profile-bio">{page.profile.bio}</p>{/if}
        {#if page.profile.learning_goal}<p>
            <strong>Learning goal:</strong>
            {page.profile.learning_goal}
          </p>{/if}
        <Button variant="secondary" data-action="account-copy-profile"
          >Copy profile link</Button
        >
        {#if page.profile.stats}
          {@const stats = page.profile.stats}
          {#if account.profile?.username === page.profile.username && !page.profile.share_stats}
            <p class="muted">Statistics are visible only to you.</p>
          {/if}
          <dl class="profile-stats">
            {#each [["Solves", stats.solve_count], ["Best single", stats.best_ms === null ? "—" : formatElapsed(stats.best_ms)], ["Average of 5", stats.ao5_dnf ? "DNF" : stats.ao5_ms === null ? "—" : formatElapsed(stats.ao5_ms)], ["Average of 12", stats.ao12_dnf ? "DNF" : stats.ao12_ms === null ? "—" : formatElapsed(stats.ao12_ms)], ["Algorithms marked known", stats.known_count]] as [label, value]}
              <div>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            {/each}
          </dl>
        {/if}
        {#if account.profile?.username === page.profile.username}
          <p class="muted">
            {account.profile.is_public
              ? "Your profile is public. Anyone with the link can view it."
              : "Your profile is private. Only you can view it."}
          </p>
          <Button variant="secondary" data-action="nav" data-view="settings"
            >Profile settings</Button
          >
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
  <form id="profile-lookup-form">
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
          ? "Demo lookup: demo_friend is public; demo_private is private. Your own page is linked in Settings."
          : "Private profiles are visible only to their owners.")}
    </p>
  </form>
</section>

<style>
  .profile-page {
    max-width: 720px;
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
  .profile-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-block: 24px;
  }
  .profile-stats dt {
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .profile-stats dd {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
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
