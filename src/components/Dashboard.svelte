<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import { dayKey } from "../progress.js";
  import { formatElapsed } from "../solve-timer.js";
  import { caseOfTheDay, learningActivity } from "../dashboard-home.js";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const today = dayKey()}
  {@const activity = learningActivity(
    model.progressIndex,
    model.state.solves || [],
    today,
  )}
  {@const featured = caseOfTheDay(model.catalog, today)}
  <section class="learning-activity" aria-labelledby="recent-activity-title">
    <div class="section-heading">
      <h2 id="recent-activity-title">Recent activity</h2>
      <Button class="secondary" data-action="nav" data-view="progress"
        >View progress</Button
      >
    </div>
    <Card class="learning-activity-summary">
      <dl aria-label="Today">
        <div>
          <dt>Practice attempts today</dt>
          <dd>{activity.attempts}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{activity.streak}</dd>
        </div>
        <div>
          <dt>Best solve today</dt>
          <dd>
            {activity.best === null ? "—" : formatElapsed(activity.best, false)}
          </dd>
        </div>
      </dl>
      {#if activity.recent.length}
        <ul aria-label="Recent active days">
          {#each activity.recent as day}
            <li>
              <time datetime={day.day}>{day.day}</time><span
                >{day.recognition + day.rehearsal} practice attempts · {day.solves}
                solves</span
              >
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Your practice and solves will appear here.</p>
      {/if}
    </Card>
  </section>
  <nav class="learning-tools" aria-label="More practice tools">
    <Button class="secondary" data-action="nav" data-view="timer"
      >Start timer</Button
    >
    <Button class="secondary" data-action="nav" data-view="library"
      >Browse algorithms</Button
    >
    <Button class="secondary" data-action="pll-quiz">PLL quiz</Button>
    <Button class="text-button" data-action="detail" data-id={featured.id}
      >Case of the day</Button
    >
  </nav>
{/snippet}

{@render content(model)}
