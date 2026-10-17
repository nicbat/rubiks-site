<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import Badge from "../lib/components/ui/badge/badge.svelte";
  import { courses } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet content({ progress })}
  <div class="page-heading">
    <div>
      <h1>Courses</h1>
      <p class="muted">Choose a puzzle and a path.</p>
    </div>
  </div>
  <section class="course-grid" aria-label="Courses">
    {#each courses as c}<Card class="course-card"
        ><span class="muted"
          >{c.puzzle.replace("x", "×")}{c.status ? " · Coming soon" : ""}</span
        >
        <h2>{c.title}</h2>
        <p>{c.description}</p>
        {#if c.status}<Badge>Work in progress</Badge>{:else}<Button
            class={progress.activeCourse === c.id ? "primary" : "secondary"}
            data-action="open-course"
            data-id={c.id}>Open {c.title}</Button
          >{/if}</Card
      >{/each}
  </section>
{/snippet}

{@render content(props)}
