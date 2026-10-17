<script>
  import { moduleById, moduleCases } from "../courses.js";
  import { methodGroups } from "../learning-methods.js";
  import { icon } from "../icons.js";

  import Button from "../lib/components/ui/button/button.svelte";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const {
    state,
    catalog,
    variant,
    progressIndex,
    status,
    caseDiagram,
    badge,
  } = model}
  {@const { progress, section } = state}

  {@const scope = moduleById(state.activeModule)}
  {@const scopedCatalog =
    scope?.kind === "algorithms"
      ? moduleCases(scope, catalog)
      : ["OLL", "PLL"].flatMap((section) =>
          methodGroups(catalog, section, state.method).flatMap((g) => g.cases),
        )}
  {@const attempted = scopedCatalog.filter(
    (c) =>
      progressIndex.isSelected(c.id) ||
      progressIndex.hasAttempts(c.id) ||
      progressIndex.isKnown(c.id, variant(c)),
  )}
  {@const confident = attempted.filter(
    (c) => status(c).label === "Confident",
  ).length}
  {@const days = progressIndex.practiceDays}
  <div class="page-heading">
    <div><h1>Progress</h1></div>
    <Button class="secondary" data-action="backup"
      >{@html icon("download")} Backup & transfer</Button
    >
  </div>
  <div class="progress-stats">
    <div>
      <strong>{progress.attempts.length}</strong><span>Practice attempts</span>
    </div>
    <div><strong>{days}</strong><span>Practice days</span></div>
    <div>
      <strong>{confident}<small> / {scopedCatalog.length}</small></strong><span
        >Confident cases</span
      >
    </div>
  </div>
  <section class="progress-list">
    <div class="section-heading">
      <h2>Your cases</h2>
      <span class="muted"
        >Three confident recognition days, after the last difficult attempt</span
      >
    </div>
    {#if attempted.length}{#each attempted as c}{@const s = status(c)}
        <Button class="progress-row" data-action="detail" data-id={c.id}
          >{@render caseDiagram(c)}<span class="progress-name"
            ><strong>{c.name}</strong><small>{c.group}</small></span
          >{@render badge(c)}<span
            class="day-dots"
            aria-label={Math.min(s.days, 3) + " of 3 confident days"}
            >{#each [0, 1, 2] as n}<i class={s.days > n ? "filled" : ""}
              ></i>{/each}</span
          ><span class="attempt-count">{s.attempts} attempts</span>{@html icon(
            "arrow",
          )}</Button
        >{/each}{:else}<div class="no-results">
        <h2>No practice yet</h2>
        <Button class="primary" data-action="nav" data-view="library"
          >Browse library</Button
        >
      </div>{/if}
  </section>
  <p class="source-note">
    Only hidden practice counts toward confidence. Each algorithm has its own
    confidence record.
  </p>
{/snippet}
{@render content(model)}
