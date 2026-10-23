<script>
  import { courseById, moduleById } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet reviewButton(id, reviewed)}
  <Button
    class={reviewed ? "secondary" : "primary"}
    data-action="review-lesson"
    data-id={id}
    aria-pressed={!!reviewed}>{reviewed ? "Reviewed" : "Mark reviewed"}</Button
  >
{/snippet}
{#snippet content(courseId, moduleId, method = "full")}
  {@const course = courseById(courseId)}
  {@const module = moduleById(moduleId)}
  {#if course && !course.status && module && course.modules.includes(moduleId)}
    <div class="page-heading">
      <h1>{course.title}</h1>
      <Button class="text-button" data-action="courses-back">All courses</Button
      >
    </div>
    {#if courseId === "cfop"}
      {@const current = module.guide || module.section.toLowerCase()}
      <nav class="guide-sections cfop-sections" aria-label="CFOP sections">
        {#each [["cross", "Cross"], ["f2l", "F2L"], ["oll", "OLL"], ["pll", "PLL"]] as [id, label]}<Button
            data-action="open-module"
            data-course="cfop"
            data-id={id === "cross" || id === "f2l" ? id : `${method}-${id}`}
            aria-pressed={current === id}>{label}</Button
          >{/each}
      </nav>
    {:else}
      <nav
        class="guide-sections course-sections"
        aria-label={course.title + " lessons"}
      >
        {#each course.modules as id}<Button
            class="secondary"
            data-action="open-module"
            data-course={courseId}
            data-id={id}
            aria-current={id === moduleId ? "step" : undefined}
          >
            {moduleById(id).title}
          </Button>{/each}
      </nav>
    {/if}
  {/if}
{/snippet}

{@render content(props.courseId, props.moduleId, props.method)}
