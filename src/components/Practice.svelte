<script>
  import CaseOccurrence from "./CaseOccurrence.svelte";
  import Algorithm from "./Algorithm.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state, byId, variant, selected, caseDiagram, sideToggle } = model}
  {@const { session } = state}

  {#if session}{@const c = byId.get(session.caseId)}
    {@const hidden = session.stage !== "answer"}
    {@const recognition = session.mode === "recognition"}
    <div class="practice-top">
      <Button class="text-button" data-action="exit"
        >{@html icon("close")} End practice</Button
      ><span
        >{recognition ? "Hidden-case practice" : "Algorithm rehearsal"}
        <span class="count">{session.completed} completed</span></span
      >
    </div>
    <section class="trainer">
      <div class="step-label">
        {recognition
          ? session.stage === "setup"
            ? "1 / Set up"
            : session.stage === "recognize"
              ? "2 / Recognize & solve"
              : "3 / Rate"
          : "Rehearsal"}
      </div>
      <h1>
        {recognition && hidden
          ? session.stage === "setup"
            ? "Set up your cube"
            : "Recognize & solve"
          : c.name}
      </h1>
      {#if recognition && session.stage === "setup"}<p>
          Start solved, with yellow on top and green in front.<br />Follow these
          moves with your cube out of sight.
        </p>
        {@render sideToggle()}
        <div class="scramble" aria-label="Setup moves">{session.setup}</div>
        <div class="trainer-actions">
          <Button class="primary" data-action="ready"
            >Ready to recognize {@html icon("arrow")}</Button
          ><Button class="text-button" data-action="skip"
            >Try another setup</Button
          >
        </div>
        <p class="trainer-footnote">
          {(session.pool?.length ?? selected().length) === 1
            ? "One case selected. Add more to practice recognition."
            : "Reveal the answer after solving, or ask for a hint."}
        </p>{/if}
      {#if recognition && session.stage === "recognize"}<p>
          Bring your cube into view, put the last layer on top, and solve from
          memory.
        </p>
        <div class="mystery-cube" aria-hidden="true">
          {#each Array(9) as _, i}<i>{i === 4 ? "?" : ""}</i>{/each}
        </div>
        <div class="trainer-actions">
          <Button class="primary" data-action="finished"
            >Finished {@html icon("check")}</Button
          ><Button class="secondary" data-action="hint">Show hint</Button>
        </div>
        <details class="setup-reminder">
          <summary>Show setup moves again</summary>
          <p>{session.setup}</p>
        </details>{/if}
      {#if !hidden || !recognition}<div class="answer-layout">
          <div class="answer-diagram">
            {@render caseDiagram(c)}<span>{c.group}</span><Button
              class="text-button"
              data-action="display-color">Change color</Button
            >
          </div>
          <div>
            <CaseOccurrence item={c} />
            <Algorithm moves={c.algorithms[variant(c)].moves} />
            <p class="muted">
              Put the last layer on top and match the pattern, regardless of
              color. Use U turns or rotate the cube as needed. {c.section ===
              "OLL"
                ? "This step orients the top; finish PLL before the next setup."
                : "Finish with a U turn if needed."}
            </p>
          </div>
        </div>
        {#if recognition}<h2 class="rating-heading">How did it go?</h2>
          <div class="ratings">
            <Button data-action="rate" data-result="help"
              ><span>Needed help</span></Button
            ><Button
              data-action="rate"
              data-result="effort"
              {...session.hinted ? { disabled: true } : {}}
              ><span>Solved with effort</span></Button
            ><Button
              data-action="rate"
              data-result="confident"
              {...session.hinted ? { disabled: true } : {}}
              ><span>Recognized & solved confidently</span></Button
            >
          </div>
          {#if session.hinted}<p class="muted">
              Hint used: record “Needed help”.
            </p>{/if}{:else}<p class="rehearsal-instruction">
            Practice the moves, then repeat from memory.
          </p>
          <Button class="primary" data-action="rehearsal-done"
            >{@html icon("check")} Record a repetition</Button
          >
          <p class="muted">
            Rehearsals don’t count toward confidence.
          </p>{/if}{/if}
    </section>{/if}
{/snippet}
{@render content(model)}
