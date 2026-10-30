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
        >{recognition
          ? session.source === "known"
            ? "Known review"
            : "Hidden-case practice"
          : "Algorithm rehearsal"}
        {#if session.section}
          · {session.section === "both" ? "OLL + PLL" : session.section}{/if}
        <span class="count">{session.completed} completed</span></span
      >
    </div>
    <section class="trainer">
      <div class="step-label">
        {recognition
          ? hidden
            ? "1 / Set up & solve"
            : "2 / Rate"
          : "Rehearsal"}
      </div>
      <h1>
        {recognition && hidden ? "Set up & solve" : c.name}
      </h1>
      {#if recognition && hidden}<p>
          Start solved, yellow on top and green in front. Set up out of sight,
          then bring the cube into view and solve from memory.
        </p>
        {@render sideToggle()}
      {/if}
      {#if recognition}
        {#if hidden}<Button
            class="text-button"
            data-action="practice-setup"
            aria-expanded={!session.setupHidden}
            aria-controls="practice-setup-moves"
            >{session.setupHidden ? "Show" : "Hide"} setup moves</Button
          >{/if}
        {#if !hidden}<p class="setup-note">
            Same setup: start solved, yellow on top and green in front.
          </p>{/if}
        <div
          id="practice-setup-moves"
          class="scramble"
          class:revealed-setup={!hidden}
          aria-label="Setup moves"
          hidden={hidden && !!session.setupHidden}
        >
          {session.setup}
        </div>
      {/if}
      {#if recognition && hidden}
        <div class="trainer-actions">
          <Button class="primary" data-action="finished">Reveal answer</Button
          ><Button class="secondary" data-action="hint">Need help</Button>
        </div>
        <Button class="text-button" data-action="skip">Try another setup</Button
        >
        <p class="trainer-footnote">
          {(session.pool?.length ?? selected().length) === 1
            ? "One case selected. Add more to practice recognition."
            : "Need help reveals the answer; rate it Needed help."}
        </p>{/if}
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
            <Button data-action="rate" data-result="help" aria-keyshortcuts="1"
              ><kbd aria-hidden="true">1</kbd><span>Needed help</span></Button
            ><Button
              data-action="rate"
              data-result="effort"
              aria-keyshortcuts="2"
              {...session.hinted ? { disabled: true } : {}}
              ><kbd aria-hidden="true">2</kbd><span>Solved with effort</span
              ></Button
            ><Button
              data-action="rate"
              data-result="confident"
              aria-keyshortcuts="3"
              {...session.hinted ? { disabled: true } : {}}
              ><kbd aria-hidden="true">3</kbd><span
                >Recognized & solved confidently</span
              ></Button
            >
          </div>
          {#if session.hinted}<p class="muted">
              Hint used: record “Needed help”.
            </p>{/if}
          {#if session.source === "known"}
            <div class="relearn-case">
              <Button
                class="secondary"
                data-action="relearn"
                aria-describedby="relearn-help">Relearn this case</Button
              >
              <p id="relearn-help" class="muted">
                Records “Needed help”, removes Known, and adds this case to your
                learning set.
              </p>
            </div>
          {/if}
        {:else}<p class="rehearsal-instruction">
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
