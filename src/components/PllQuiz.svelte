<script>
  import { caseDiagram } from "../case-diagram.js";
  import { pllQuestionCube, twoSideStickers } from "../pll-quiz.js";
  import { centers } from "../cube.js";
  import { palette } from "../diagram.js";
  import { displayColors } from "../display-colors.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet content(quiz, catalog, top, method = "full")}
  {@const q = quiz.question}
  {@const cube = pllQuestionCube(q, top)}
  {@const colors = twoSideStickers(cube)}
  {@const center = centers(cube)}
  {#snippet face(offset, name, color)}
    <div class="quiz-face">
      <div class="quiz-stickers">
        {#each colors.slice(offset, offset + 3) as c}<span
            style={"background:" + palette[c]}
            aria-label={displayColors[c] + " sticker"}
          ></span>{/each}
      </div>
      <span
        class="quiz-center"
        style={"background:" + palette[color]}
        aria-label={displayColors[color] + " center"}
      ></span><small>{name}</small>
    </div>
  {/snippet}
  {@const answer = catalog.find((c) => c.id === q.caseId)}
  <div class="page-heading">
    <div>
      <h1>Two-sided PLL recognition</h1>
      <p>Match two adjacent sides to a case diagram.</p>
    </div>
    <Button
      class="text-button"
      data-action="open-module"
      data-course="cfop"
      data-id={method + "-pll"}>Back to PLL</Button
    >
  </div>
  <section class="pll-quiz">
    <p>
      {quiz.correct} / {quiz.total} correct this session · {displayColors[top]} on
      top
    </p>
    <div
      class="two-side-view"
      role="img"
      aria-label="Two adjacent sides: front on the left, right on the right"
    >
      {@render face(0, "Front", center.F)}{@render face(3, "Right", center.R)}
    </div>
    <p class="muted">
      Look for matching corners, bars, and opposite colors. Centers show the
      side colors.
    </p>
    <Button class="text-button" data-action="display-color">Change color</Button
    >
    <div class="quiz-choices" role="group" aria-label="PLL case diagrams">
      {#each q.choices.map( (id) => catalog.find((c) => c.id === id) ) as c}<Button
          class="secondary"
          data-action="pll-answer"
          data-id={c.id}
          aria-label={c.name}
          {...q.answer ? { disabled: true } : {}}
          >{@html caseDiagram(c.algorithms[0].moves, "PLL", "Case pattern", {
            top,
            arrows: true,
            neutralSides: true,
          })}<small>{c.name}</small></Button
        >{/each}
    </div>
    {#if q.answer}<div class="quiz-result" role="status">
        <h2>
          {q.answer === q.caseId ? "Correct" : "Keep practicing"} · {answer.name}
        </h2>
        {@html caseDiagram(
          answer.algorithms[0].moves,
          "PLL",
          "Correct case pattern",
          { top, arrows: true, neutralSides: true },
        )}<Button class="primary" data-action="pll-next">Next case</Button>
      </div>{/if}
    <p class="source-note">
      Quiz scores do not change algorithm mastery. <a
        href="https://sarah.cubing.net/3x3x3/pll-recognition-guide"
        target="_blank"
        rel="noreferrer">Recognition guide by Sarah Strong</a
      >
    </p>
  </section>
{/snippet}

{@render content(props.quiz, props.catalog, props.top, props.method)}
