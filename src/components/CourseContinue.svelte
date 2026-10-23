<script>
  import { courses, moduleById } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let { progress, summaries, empty = true } = $props();
  const started = $derived(
    courses.filter(
      (course) =>
        summaries[course.id]?.started &&
        !summaries[course.id]?.finished &&
        !course.status,
    ),
  );
</script>

{#if started.length}
  <section class="course-continue-list" aria-label="Courses in progress">
    <h2>Continue</h2>
    {#each started as course}
      {@const module = moduleById(
        progress.resume?.[course.id] || course.modules[0],
      )}
      <div class="course-continue" role="group" aria-label={course.title}>
        <div>
          <strong>{course.title}</strong>
          <p>
            {module.title} · {summaries[course.id].done} / {summaries[course.id]
              .total} sections complete
          </p>
        </div>
        <Button
          class="primary"
          data-action="open-module"
          data-id={module.id}
          data-course={course.id}>Continue course</Button
        >
      </div>
    {/each}
  </section>
{:else if empty}
  <div class="course-continue">
    <div>
      <strong>Choose a learning path</strong>
      <p>Start with Beginner or build your CFOP skills.</p>
    </div>
    <Button class="primary" data-action="nav" data-view="courses"
      >Explore courses</Button
    >
  </div>
{/if}
