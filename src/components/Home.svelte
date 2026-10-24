<script>
  import CaseOccurrence from "./CaseOccurrence.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import Algorithm from "./Algorithm.svelte";
  import { icon } from "../icons.js";
  import { dayKey } from "../progress.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CourseContinue from "./CourseContinue.svelte";
  import SelectControl from "./SelectControl.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import { hiddenPracticeCases } from "../hidden-practice.js";
  import { learningMethods } from "../learning-methods.js";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const {
    state,
    byId,
    variant,
    selected,
    progressIndex,
    status,
    caseDiagram,
    badge,
    sideToggle,
  } = model}
  {@const { progress, focusId } = state}
  {#snippet study(c)}
    <Card class="study-card"
      ><div class="study-visual">
        <Button
          class="study-diagram-button"
          data-action="detail"
          data-id={c.id}
          aria-label={"View " + c.name + " case"}
          >{@render caseDiagram(c)}</Button
        ><span>{c.section} / {c.group}</span>
      </div>
      <div class="study-body">
        <div class="study-heading">
          <h2>{c.name}</h2>
          {@render badge(c)}
        </div>
        <CaseOccurrence item={c} />
        <Algorithm moves={c.algorithms[variant(c)].moves} />
        <div class="study-actions">
          <Button class="primary" data-action="rehearse" data-id={c.id}
            >Practice algorithm</Button
          ><Button class="text-button" data-action="detail" data-id={c.id}
            >View case {@html icon("arrow")}</Button
          >
        </div>
      </div></Card
    >
  {/snippet}

  {@const list = selected()}
  {@const options = state.practiceOptions || {
    source: "learning",
    section: "both",
  }}
  {@const pool = hiddenPracticeCases(
    model.catalog,
    progress,
    { ...options, method: state.method || "full" },
    progressIndex,
  )}
  {@const focus = list.find((c) => c.id === focusId) || list[0]}
  {@const today = progressIndex.attemptsOn(dayKey())}
  <div class="page-heading home-heading">
    <div>
      <p class="date-label">
        {new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      <h1>My learning</h1>
    </div>
    <div class="today-count">
      {@html icon("sun")}<span
        ><strong>{today}</strong>
        {today === 1 ? "attempt" : "attempts"} today</span
      >
    </div>
  </div>
  <CourseContinue {progress} summaries={model.courseSummaries} />
  <div class="workspace learning-workspace">
    <section>
      <div class="section-heading">
        <h2>Your learning set <span class="count">{list.length}</span></h2>
        <Button class="text-button" data-action="nav" data-view="library"
          >{@html icon("plus")} Add cases</Button
        >
      </div>
      {#if focus}{@render study(focus)}
        <div class="case-strip">
          {#each list as c}<Button
              class={"mini-case " + (focus.id === c.id ? "active" : "")}
              data-action="focus"
              data-id={c.id}
              aria-pressed={focus.id === c.id}
              >{@render caseDiagram(c)}<span>{c.name}</span><small
                >{status(c).label}</small
              ></Button
            >{/each}
        </div>{:else}<div class="empty-learning">
          <div class="empty-diagrams">
            {@render caseDiagram(byId.get("pll-T"))}{@render caseDiagram(
              byId.get("oll-27"),
            )}
          </div>
          <h2>Choose cases to practice</h2>
          <Button class="primary" data-action="nav" data-view="library"
            >Browse library {@html icon("arrow")}</Button
          >
        </div>{/if}
    </section>
    <aside>
      <div class="practice-panel">
        <span class="practice-icon">{@html icon("shuffle")}</span>
        <h2>Hidden practice</h2>
        <p>Set up a case out of sight, then recognize and solve it.</p>
        <div class="practice-options">
          <div>
            <Label for="practice-source">Cases</Label>
            <SelectControl
              id="practice-source"
              label="Practice cases"
              value={options.source}
              options={[
                { value: "learning", label: "Learning set" },
                { value: "known", label: "Review known" },
              ]}
            />
          </div>
          <div>
            <Label for="practice-section">Section</Label>
            <SelectControl
              id="practice-section"
              label="Practice section"
              value={options.section}
              options={[
                { value: "both", label: "Both" },
                { value: "OLL", label: "OLL" },
                { value: "PLL", label: "PLL" },
              ]}
            />
          </div>
        </div>
        <small
          >{learningMethods.find(
            (entry) => entry.value === (state.method || "full"),
          )?.label}{options.source === "known"
            ? " · Known + Confident"
            : ""}</small
        >
        {@render sideToggle()}
        <small role="status"
          >{pool.length} {pool.length === 1 ? "case" : "cases"} available</small
        >
        <Button
          class="primary"
          data-action="start"
          {...!pool.length ? { disabled: true } : {}}
          >Start hidden practice {@html icon("arrow")}</Button
        >
        {#if !pool.length}
          <p>
            No {options.source === "known"
              ? "known or confident"
              : "learning-set"} cases match this section.
          </p>
          <Button class="text-button" data-action="nav" data-view="library"
            >Browse library</Button
          >
        {/if}
      </div>
      <div class="habit-note">
        <span class="small-mark">↻</span>
        <div>
          <h3>Confidence</h3>
          <p>
            “Confident” means recognizing and solving a case on three different
            days since your last difficult attempt.
          </p>
        </div>
      </div>
    </aside>
  </div>
  <div class="bottom-note">
    {@html icon("check")}
    {state.account?.email && !state.preferences.testData
      ? "Saved changes sync automatically."
      : "Progress stays in this browser."}
  </div>
{/snippet}
{@render content(model)}
