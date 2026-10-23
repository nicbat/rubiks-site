<script>
  import { courseById, moduleById } from "../courses.js";
  import CourseContent from "./CourseContent.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  let { courseId, moduleId, progress, example = null, summary } = $props();
  const course = $derived(courseById(courseId));
  const lesson = $derived(moduleById(moduleId));
</script>

{#if course && lesson?.kind === "lesson" && course.modules.includes(lesson.id)}
  {@const position = course.modules.indexOf(moduleId)}
  {@const reviewed = progress.reviewed?.includes(moduleId)}
  <article class="course-lesson" aria-labelledby="lesson-title">
    <p class="muted">Lesson {position + 1} of {course.modules.length}</p>
    <h2 id="lesson-title">{lesson.title}</h2>
    <CourseContent nodes={lesson.nodes} {example} headingOffset={1} />
    <div class="lesson-completion">
      <p role="status">
        {summary?.finished
          ? "Course finished. You can revisit any lesson."
          : `${summary?.done || 0} of ${course.modules.length} lessons complete.`}
      </p>
      <Button
        class={reviewed ? "secondary" : "primary"}
        data-action="review-lesson"
        data-id={moduleId}
        aria-pressed={!!reviewed}
      >
        {reviewed ? "Lesson complete" : "Mark complete"}
      </Button>
    </div>
    <nav class="lesson-pagination" aria-label="Lesson navigation">
      {#if position > 0}<Button
          class="secondary"
          data-action="open-module"
          data-course={courseId}
          data-id={course.modules[position - 1]}>Previous lesson</Button
        >{/if}
      {#if position < course.modules.length - 1}<Button
          class="secondary"
          data-action="open-module"
          data-course={courseId}
          data-id={course.modules[position + 1]}>Next lesson</Button
        >{:else}<Button class="secondary" data-action="courses-back"
          >All courses</Button
        >{/if}
    </nav>
  </article>
{/if}
