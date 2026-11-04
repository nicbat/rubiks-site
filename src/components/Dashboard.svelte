<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import Algorithm from "./Algorithm.svelte";
  import CourseContinue from "./CourseContinue.svelte";
  import { icon } from "../icons.js";
  import { dayKey } from "../progress.js";
  import { formatElapsed } from "../solve-timer.js";
  import { caseOfTheDay, learningActivity } from "../dashboard-home.js";
  let { model } = $props();
  const actions = [
    {
      label: "Hidden practice",
      detail: "Choose cases and recall with the answer hidden",
      view: "home",
      learningPage: "practice",
      color: "var(--cube-blue)",
    },
    {
      label: "Start timer",
      detail: "Scramble, inspect and time a solve",
      view: "timer",
      color: "var(--cube-red)",
    },
    {
      label: "Browse algorithms",
      detail: "Every OLL and PLL case",
      view: "library",
      color: "var(--cube-green)",
    },
    {
      label: "PLL quiz",
      detail: "Name the case from two sides",
      color: "var(--cube-orange)",
    },
  ];
</script>

{#snippet content(model)}
  {@const {
    state,
    catalog,
    variant,
    caseDiagram,
    selected,
    status,
    courseSummaries,
  } = model}
  {@const activity = learningActivity(
    model.progressIndex,
    state.solves || [],
    dayKey(),
  )}
  {@const featured = caseOfTheDay(catalog, dayKey())}
  {@const list = selected()}
  {@const started = Object.values(courseSummaries).some(
    (course) => course.started && !course.finished,
  )}
  <div class="page-toolbar"><h1 class="sr-only">Dashboard</h1></div>
  <div class="dashboard-home">
    <Card class="dashboard-panel dashboard-next">
      {#if started}
        <CourseContinue
          progress={state.progress}
          summaries={courseSummaries}
          empty={false}
          heading="Continue learning"
          segmented
          embedded
        />
      {:else}
        <h2>Continue learning</h2>
        <div class="path-choices">
          <div class="path-choice">
            <h3>New to the cube?</h3>
            <p>Learn your first solve in eight short lessons.</p>
            <Button class="primary" data-action="open-course" data-id="beginner"
              >Start Beginner {@html icon("arrow")}</Button
            >
          </div>
          <div class="path-choice">
            <h3>Already solving?</h3>
            <p>Get faster with CFOP: cross, F2L, OLL and PLL.</p>
            <Button class="secondary" data-action="open-course" data-id="cfop"
              >Open CFOP {@html icon("arrow")}</Button
            >
          </div>
        </div>
      {/if}
    </Card>
    <Card class="dashboard-panel dashboard-today">
      <h2>Today</h2>
      <dl aria-label="Today">
        <div>
          <dt>Practice attempts</dt>
          <dd>{activity.attempts}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{activity.streak}</dd>
        </div>
        <div>
          <dt>Best solve</dt>
          <dd>
            {activity.best === null ? "—" : formatElapsed(activity.best, false)}
          </dd>
        </div>
      </dl>
    </Card>
    <nav class="quick-actions" aria-label="Quick actions">
      {#each actions as action}
        <Button
          class="secondary quick-key"
          style={`--c: ${action.color}`}
          data-action={action.view ? "nav" : "pll-quiz"}
          data-view={action.view}
          data-learning-page={action.learningPage}
          ><strong>{action.label}</strong><small>{action.detail}</small></Button
        >
      {/each}
    </nav>
    <Card class="dashboard-panel dashboard-learning">
      <div class="section-heading">
        <h2>Your learning set <span class="count">{list.length}</span></h2>
        <Button
          class="secondary"
          data-action="nav"
          data-view="home"
          data-learning-page="study">Open learning set</Button
        >
      </div>
      {#if list.length}
        <ul class="learning-set-preview" aria-label="Learning set preview">
          {#each list.slice(0, 4) as c}<li>
              {@render caseDiagram(c)}<strong>{c.name}</strong><small
                >{status(c).label}</small
              >
            </li>{/each}
        </ul>
        {#if list.length > 4}<p class="muted">
            {list.length - 4} more in your learning set
          </p>{/if}
      {:else}<p class="muted">
          Choose a few cases to start learning. Add more any time.
        </p>{/if}
    </Card>
    <Card class="dashboard-panel dashboard-case">
      <div class="dashboard-case-diagram">{@render caseDiagram(featured)}</div>
      <div class="dashboard-case-body">
        <p class="dashboard-eyebrow">Case of the day</p>
        <h2>{featured.name}</h2>
        <p class="muted">{featured.section} · {featured.group}</p>
        <Algorithm
          moves={featured.algorithms[variant(featured)].moves}
        /><Button class="secondary" data-action="detail" data-id={featured.id}
          >View case {@html icon("arrow")}</Button
        >
      </div>
    </Card>
    <Card class="dashboard-panel dashboard-recent">
      <section aria-labelledby="recent-activity-title">
        <div class="section-heading">
          <h2 id="recent-activity-title">Recent activity</h2>
          <Button class="text-button" data-action="nav" data-view="progress"
            >View progress</Button
          >
        </div>
        {#if activity.recent.length}
          <ul class="recent-active-days" aria-label="Recent active days">
            {#each activity.recent as day}<li>
                <time datetime={day.day}>{day.day}</time><span
                  >{day.recognition + day.rehearsal} practice attempts · {day.solves}
                  solves</span
                >
              </li>{/each}
          </ul>
        {:else}<p class="muted">
            Your practice and solves will appear here.
          </p>{/if}
      </section>
    </Card>
  </div>
{/snippet}
{@render content(model)}
