<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import Algorithm from "./Algorithm.svelte";
  import {
    twoByTwoLessons,
    twoByTwoAlgorithms,
    twoByTwoSetup,
  } from "../two-by-two.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet content(progress, chunks)}
  <div class="page-heading">
    <div>
      <h1>2×2 Ortega reference</h1>
      <p>One face → opposite face → both layers.</p>
    </div>
  </div>
  <p class="bld-intro">
    Reference only. Use your own 2×2; interactive practice will follow. <a
      href="https://jperm.net/2x2/faster"
      target="_blank"
      rel="noreferrer">J Perm’s Ortega tutorial</a
    >
  </p>
  <div class="bld-lessons">
    {#each twoByTwoLessons as lesson, i}{@const stage =
        i === 1 ? "OLL" : i === 2 ? "PBL" : null}
      {@const reviewed = progress.reviewed?.includes(lesson.id)}
      <Card class="bld-lesson" aria-labelledby={lesson.id}
        ><h2 id={lesson.id}>{i + 1}. {lesson.title}</h2>
        <p>{lesson.text}</p>
        <p class="lesson-exercise"><strong>Try it</strong> {lesson.exercise}</p>
        {#if stage}<p>
            <a
              href={"https://jperm.net/algs/2x2" + stage.toLowerCase()}
              target="_blank"
              rel="noreferrer"
              >{stage} algorithms and recognition diagrams · J Perm</a
            >
          </p>
          {#each twoByTwoAlgorithms.filter((a) => a.stage === stage) as a}<section
              class="bld-algorithm"
              aria-label={a.name}
            >
              <h3>{a.name}</h3>
              <Algorithm moves={a.moves} />
              <details class="setup-disclosure">
                <summary>Build {a.name} example</summary>
                <p>
                  Start solved, any color up. Apply the setup, keep your grip,
                  then do the algorithm.
                </p>
                <p class="plain-moves">{twoByTwoSetup(a)}</p>
              </details>
            </section>{/each}{/if}<Button
          class={reviewed ? "secondary" : "primary"}
          data-action="review-lesson"
          data-id={lesson.id}
          aria-pressed={!!reviewed}
          >{reviewed ? "Reviewed" : "Mark reviewed"}</Button
        ></Card
      >{/each}
  </div>
{/snippet}

{@render content(props.progress, props.chunks)}
