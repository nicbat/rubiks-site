<script>
  import { courseById, moduleById, courseExamples } from "../courses.js";
  import { applyAlg, solvedCube } from "../cube.js";
  import { f2lDiagram } from "../f2l-diagram.js";
  import Algorithm from "./Algorithm.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  let { courseId, moduleId, progress, example = null, summary } = $props();
  const course = $derived(courseById(courseId));
  const lesson = $derived(moduleById(moduleId));
</script>

{#snippet nodes(items)}
  {#each items as node}
    {#if node.type === "text"}{node.text}
    {:else if node.type === "code"}<code>{node.text}</code>
    {:else if node.type === "br"}<br />
    {:else if node.type === "inline"}{@render nodes(node.children)}
    {:else if node.type === "paragraph"}<p>{@render nodes(node.children)}</p>
    {:else if node.type === "heading"}
      {#if node.depth === 2}<h3>{@render nodes(node.children)}</h3>{:else}<h4>
          {@render nodes(node.children)}
        </h4>{/if}
    {:else if node.type === "strong"}<strong
        >{@render nodes(node.children)}</strong
      >
    {:else if node.type === "em"}<em>{@render nodes(node.children)}</em>
    {:else if node.type === "link"}<a href={node.href}
        >{@render nodes(node.children)}</a
      >
    {:else if node.type === "list"}
      {#if node.ordered}<ol start={node.start}>
          {#each node.items as item}<li>{@render nodes(item)}</li>{/each}
        </ol>
      {:else}<ul>
          {#each node.items as item}<li>{@render nodes(item)}</li>{/each}
        </ul>{/if}
    {:else if node.type === "cube"}
      {@const demo = courseExamples[node.example]}
      {@const before = applyAlg(solvedCube(), demo.setup)}
      {@const rotation = demo.view === "underneath" ? "z2" : ""}
      <section class="lesson-example" aria-label={demo.title}>
        <h4>{demo.title}</h4>
        <p>{demo.caption}</p>
        <div class="lesson-diagrams">
          {#each [["Before", before], ["After", applyAlg(before, demo.algorithm)]] as [label, cube]}
            <figure>
              {@html f2lDiagram(
                cube,
                `${demo.title}: ${label.toLowerCase()}${rotation ? ", viewed underneath" : ", yellow up"}`,
                { targets: demo.targets, rotation },
              )}
              <figcaption>{label}{rotation ? " · underneath" : ""}</figcaption>
            </figure>
          {/each}
        </div>
        <Algorithm moves={demo.algorithm} />
        <Button
          class="secondary"
          data-action="course-example"
          data-id={node.example}
          aria-expanded={example === node.example}
          aria-controls={"lesson-demo-" + node.example}
        >
          {example === node.example ? "Hide example" : "Show example"}
        </Button>
        <div id={"lesson-demo-" + node.example}>
          {#if example === node.example}<CubePlayer
              id={node.example}
              mode="lesson"
              setup={demo.setup}
              algorithm={demo.algorithm}
            />{/if}
        </div>
      </section>
    {/if}
  {/each}
{/snippet}

{#if course && lesson?.kind === "lesson" && course.modules.includes(lesson.id)}
  {@const position = course.modules.indexOf(moduleId)}
  {@const reviewed = progress.reviewed?.includes(moduleId)}
  <article class="course-lesson" aria-labelledby="lesson-title">
    <p class="muted">Lesson {position + 1} of {course.modules.length}</p>
    <h2 id="lesson-title">{lesson.title}</h2>
    {@render nodes(lesson.nodes)}
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
