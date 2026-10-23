<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import AccountIdentity from "./AccountIdentity.svelte";
  import AccountProfile from "./AccountProfile.svelte";
  import AccountData from "./AccountData.svelte";
  import DashboardActivity from "./DashboardActivity.svelte";
  import Progress from "./Progress.svelte";
  import { dayKey } from "../progress.js";
  import { solveSummary } from "../dashboard.js";
  import {
    accountOverview,
    trainingSourceLabel,
  } from "../account-workspace.js";
  import { formatElapsed } from "../solve-timer.js";
  let { model } = $props();
  let state = $derived(model.state);
  let section = $derived(
    state.view === "progress" ? "progress" : state.accountSection || "overview",
  );
  let account = $derived(state.account || {});
  const titles = {
    overview: "Account",
    progress: "Progress",
    profile: "Profile",
    sync: "Sync and data",
  };
  const time = (value) =>
    value === null
      ? "—"
      : Number.isFinite(value)
        ? formatElapsed(value, true)
        : "DNF";
</script>

<section class="account-workspace" aria-label="Private account workspace">
  <div class="page-heading">
    <div>
      <h1>{titles[section]}</h1>
      <p class="muted">
        {trainingSourceLabel(account, state.preferences.testData)}
      </p>
    </div>
    <Button variant="secondary" data-action="backup">Backup & transfer</Button>
  </div>
  <nav class="account-nav" aria-label="Account sections">
    {#each [["overview", "Overview"], ["progress", "Progress"], ["profile", "Profile"], ["sync", "Sync and data"]] as [id, label]}
      <Button
        variant="secondary"
        href={id === "overview" ? "#/account" : `#/account/${id}`}
        aria-current={section === id ? "page" : undefined}>{label}</Button
      >
    {/each}
  </nav>
  {#if section === "progress"}
    <Progress {model} />
  {:else if section === "profile"}
    <Card class="account-panel"
      ><AccountProfile
        {account}
        page={state.profilePage}
        testData={state.preferences.testData}
      /></Card
    >
  {:else if section === "sync"}
    <Card class="account-panel"
      ><AccountData {account} testData={state.preferences.testData} /></Card
    >
    <p class="muted">Export backups for recovery.</p>
  {:else}
    {@const today = dayKey()}
    {@const overview = accountOverview(model, today)}
    {@const summary = solveSummary(state.solves || [], {
      since: overview.activity.since,
      today,
      cube: state.dashboard?.cube || "all",
    })}
    <Card class="account-panel account-identity"
      ><h2>{account.email ? "Your account" : "Guest training"}</h2>
      <AccountIdentity {account} testData={state.preferences.testData} /></Card
    >
    <DashboardActivity
      {model}
      {today}
      activity={overview.activity}
      confident={overview.confident}
      total={overview.cases.length}
    />
    <div class="account-summaries">
      <Card class="account-panel"
        ><h2>Learning</h2>
        <dl class="account-totals">
          <div>
            <dt>Already known</dt>
            <dd>{overview.known}</dd>
          </div>
          <div>
            <dt>Confident cases</dt>
            <dd>{overview.confident}</dd>
          </div>
        </dl>
        <p class="muted">
          Current variants · {state.method === "two-look" ? "Two-look" : "Full"} CFOP.
          Known marks and earned confidence stay separate.
        </p>
        <Button
          variant="secondary"
          data-action="account-progress"
          data-tab="learning">View learning progress</Button
        ></Card
      >
      <Card class="account-panel"
        ><h2>Solves</h2>
        <dl class="account-totals">
          {#each [["Best single", summary.best], ["Latest ao5", summary.ao5], ["Latest ao12", summary.ao12]] as [label, value]}<div
            >
              <dt>{label}</dt>
              <dd>{time(value)}</dd>
            </div>{/each}
        </dl>
        <p class="muted">Selected period and cube; penalties included.</p>
        <Button
          variant="secondary"
          data-action="account-progress"
          data-tab="solves">View solve progress</Button
        ></Card
      >
    </div>
    {#if !(state.solves?.length || state.progress.attempts.length)}<div
        class="account-empty"
      >
        <h2>Start your training</h2>
        <div class="button-row">
          <Button variant="secondary" href="#/courses">Browse courses</Button
          ><Button variant="secondary" href="#/timer">Open timer</Button>
        </div>
      </div>{/if}
  {/if}
</section>
