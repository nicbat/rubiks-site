<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Algorithm from "./Algorithm.svelte";
  import { icon } from "../icons.js";
  import { dayKey } from "../progress.js";
  import { formatElapsed } from "../solve-timer.js";
  import { caseOfTheDay, nextStep, todaySummary } from "../dashboard-home.js";
  let { model } = $props();

  // The most-used places, each keyed to its main-nav color where it has one.
  const actions = [
    {
      label: "Hidden practice",
      detail: "Recall cases with the answer hidden",
      attrs: { "data-action": "nav", "data-view": "home" },
      color: "var(--cube-blue)",
    },
    {
      label: "Start timer",
      detail: "Scramble, inspect and time a solve",
      attrs: { "data-action": "nav", "data-view": "timer" },
      color: "var(--cube-red)",
    },
    {
      label: "Algorithm library",
      detail: "Every OLL and PLL case",
      attrs: { "data-action": "nav", "data-view": "library" },
      color: "var(--cube-green)",
    },
    {
      label: "PLL quiz",
      detail: "Name the case from two sides",
      attrs: { "data-action": "pll-quiz" },
      color: "var(--cube-orange)",
    },
  ];
</script>

{#snippet content(model)}
  {@const { state, catalog, variant, caseDiagram, courseSummaries } = model}
  {@const today = dayKey()}
  {@const step = nextStep(state.progress, courseSummaries)}
  {@const day = todaySummary(state.progress, state.solves || [], today)}
  {@const featured = caseOfTheDay(catalog, today)}
  <div class="page-toolbar"><h1 class="sr-only">Dashboard</h1></div>
  <div class="dashboard-home">
    <section
      class="dashboard-panel dashboard-next"
      aria-labelledby="dashboard-next-title"
    >
      {#if step.kind === "choose"}
        <h2 id="dashboard-next-title">Where do you want to start?</h2>
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
      {:else}
        <p class="dashboard-eyebrow">Continue</p>
        <h2 id="dashboard-next-title">{step.course.title}</h2>
        <p>{step.module.title} · {step.done} / {step.total} sections</p>
        <span
          class="step-bar"
          role="img"
          aria-label={`${step.done} of ${step.total} sections complete`}
          >{#each { length: step.total }, index}<i
              class:done={index < step.done}
            ></i>{/each}</span
        >
        <div class="dashboard-next-actions">
          <Button
            class="primary"
            data-action="open-module"
            data-id={step.module.id}
            data-course={step.course.id}
            >Continue {step.course.title} {@html icon("arrow")}</Button
          ><Button class="text-button" data-action="nav" data-view="courses"
            >All courses</Button
          >
        </div>
      {/if}
    </section>

    <section
      class="dashboard-panel dashboard-today"
      aria-labelledby="dashboard-today-title"
    >
      <h2 id="dashboard-today-title">Today</h2>
      <dl>
        <div>
          <dt>Practice attempts</dt>
          <dd>{day.attempts}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{day.streak}</dd>
        </div>
        <div>
          <dt>Best solve</dt>
          <dd>{day.best === null ? "—" : formatElapsed(day.best, false)}</dd>
        </div>
      </dl>
    </section>

    <nav class="quick-actions" aria-label="Quick actions">
      {#each actions as action}<Button
          class="secondary quick-key"
          style={`--c: ${action.color}`}
          {...action.attrs}
          ><strong>{action.label}</strong><small>{action.detail}</small></Button
        >{/each}
    </nav>

    <section
      class="dashboard-panel dashboard-case"
      aria-labelledby="dashboard-case-title"
    >
      <div class="dashboard-case-diagram">{@render caseDiagram(featured)}</div>
      <div class="dashboard-case-body">
        <p class="dashboard-eyebrow">Case of the day</p>
        <h2 id="dashboard-case-title">{featured.name}</h2>
        <p class="muted">{featured.section} · {featured.group}</p>
        <Algorithm moves={featured.algorithms[variant(featured)].moves} />
        <Button class="secondary" data-action="detail" data-id={featured.id}
          >View case {@html icon("arrow")}</Button
        >
      </div>
    </section>
  </div>
{/snippet}

{@render content(model)}
