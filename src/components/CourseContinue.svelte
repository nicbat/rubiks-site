<script>
  import { courseById, moduleById } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet content(progress)}
  {@const course = courseById(progress.activeCourse)}
  {#if !course || course.status}<div class="course-continue">
      <div>
        <strong>Choose a learning path</strong>
        <p>Explore CFOP, with more paths to come.</p>
      </div>
      <Button class="primary" data-action="nav" data-view="courses"
        >Explore courses</Button
      >
    </div>{:else}{@const module = moduleById(
      progress.resume?.[course.id] || course.modules[0],
    )}
    <div class="course-continue">
      <div>
        <strong>{course.title}</strong>
        <p>Continue with {module.title}.</p>
      </div>
      <Button
        class="primary"
        data-action="open-module"
        data-id={module.id}
        data-course={course.id}>Continue course</Button
      >
    </div>{/if}
{/snippet}

{@render content(props.progress)}
