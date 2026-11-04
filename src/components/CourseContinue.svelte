<script>
  import { courses, moduleById } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let {
    progress,
    summaries,
    empty = true,
    heading = "Continue",
    segmented = false,
    embedded = false,
  } = $props();
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
    <h2>{heading}</h2>
    {#each started as course}
      {@const module = moduleById(
        progress.resume?.[course.id] || course.modules[0],
      )}
      <div
        class={embedded ? "course-resume-row" : "course-continue"}
        role="group"
        aria-label={course.title}
      >
        <div>
          <strong>{course.title}</strong>
          <p>
            {module.title} · {summaries[course.id].done} / {summaries[course.id]
              .total} sections complete
          </p>
          {#if segmented}
            <span
              class="step-bar"
              role="img"
              aria-label={`${summaries[course.id].done} of ${summaries[course.id].total} sections complete`}
            >
              {#each { length: summaries[course.id].total } as _, index}<i
                  class:done={index < summaries[course.id].done}
                ></i>{/each}
            </span>
          {/if}
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
  <section aria-label={heading}>
    <h2>{heading}</h2>
    <div class="course-continue">
      <div>
        <strong>Choose a learning path</strong>
        <p>Start with Beginner or build your CFOP skills.</p>
      </div>
      <div class="continue-actions">
        <Button class="primary" data-action="open-course" data-id="beginner"
          >Start Beginner</Button
        >
        <Button class="secondary" data-action="open-course" data-id="cfop"
          >Open CFOP</Button
        >
      </div>
    </div>
  </section>
{/if}
