<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import Badge from "../lib/components/ui/badge/badge.svelte";
  import { courses } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CourseContinue from "./CourseContinue.svelte";
  let { progress, summaries } = $props();
  const available = courses.filter((course) => !course.status);
  const puzzles = [...new Set(available.map((course) => course.puzzle))];
</script>

{#snippet card(course, finished = false)}
  {@const summary = summaries[course.id]}
  <Card class="course-card">
    <h3>{course.title}</h3>
    <p>{course.description}</p>
    {#if summary?.started}<small class="muted"
        >{summary.done} / {summary.total} sections complete</small
      >{/if}
    {#if finished}<Badge>Finished</Badge>{/if}
    <Button class="secondary" data-action="open-course" data-id={course.id}>
      {finished ? "Review" : "Open"}
      {course.title}
    </Button>
  </Card>
{/snippet}

<div class="page-toolbar"><h1 class="sr-only">Courses</h1></div>
<CourseContinue {progress} {summaries} empty={false} />
{#each puzzles as puzzle}
  <section
    class="course-category"
    aria-label={puzzle.replace("x", "×") + " courses"}
  >
    <h2>{puzzle.replace("x", "×")}</h2>
    <div class="course-grid">
      {#each available.filter((course) => course.puzzle === puzzle) as course}{@render card(
          course,
          summaries[course.id].finished,
        )}{/each}
    </div>
  </section>
{/each}
<section class="course-category" aria-label="Upcoming courses">
  <h2>Coming soon</h2>
  <div class="course-grid">
    {#each courses.filter((course) => course.status) as course}
      <Card class="course-card">
        <small class="muted">{course.puzzle.replace("x", "×")}</small>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <Badge>Work in progress</Badge>
      </Card>
    {/each}
  </div>
</section>
{#if available.some((course) => summaries[course.id].finished)}
  <section class="course-category" aria-label="Finished courses">
    <h2>Finished</h2>
    <p class="muted">Completed courses stay available to review.</p>
    <div class="course-grid">
      {#each available.filter((course) => summaries[course.id].finished) as course}{@render card(
          course,
          true,
        )}{/each}
    </div>
  </section>
{/if}
