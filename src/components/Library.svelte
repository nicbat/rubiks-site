<script>
  import OccurrenceNote from "./OccurrenceNote.svelte";
  import CaseOccurrence from "./CaseOccurrence.svelte";
  import { getContext } from "svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import Checkbox from "../lib/components/ui/checkbox/checkbox.svelte";

  import { libraryGroups, learnedStatus } from "../library.js";
  import { learningMethods, methodGroups } from "../learning-methods.js";
  import { tokens } from "../cube.js";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import SelectControl from "./SelectControl.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  let { model } = $props();
  const actions = getContext("actions");
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
    aliasMarkup,
    workspace,
  } = model}
  {@const { preferences, section, query, group } = state}
  {@const bulk = state.bulkEdit}
  {@const chosen = new Set(bulk?.selected || [])}
  {#snippet selection(cases, id, label, text)}
    {@const count = cases.filter((c) => chosen.has(c.id)).length}
    <div class="bulk-selection">
      <Checkbox
        {id}
        aria-label={label}
        checked={!!cases.length && count === cases.length}
        indeterminate={count > 0 && count < cases.length}
        disabled={!cases.length}
        onCheckedChange={(checked) =>
          actions?.setLibrarySelection(
            cases.map((c) => c.id),
            checked,
          )}
      />
      {#if text}<Label for={id}>{text}</Label>{/if}
    </div>
  {/snippet}
  {#snippet libraryCard(c)}
    {@const added = progressIndex.isSelected(c.id)}
    <Card
      class="library-case"
      data-selected={bulk && chosen.has(c.id) ? "true" : undefined}
      >{#if bulk}
        {@render selection([c], `bulk-${c.id}`, `Select ${c.name}`, c.name)}
      {/if}<Button
        class="case-open"
        data-action="detail"
        data-id={c.id}
        aria-label={"View " + c.name}
        >{@render caseDiagram(c)}
        <div>
          <h3>{c.name}</h3>
          {@render aliasMarkup(c)}{@render badge(c)}<CaseOccurrence item={c} />
        </div></Button
      >
      <div class="case-footer">
        <span>{tokens(c.algorithms[variant(c)].moves).length} moves</span
        ><Button
          class={"add-button " + (added ? "added" : "")}
          data-action="toggle"
          data-id={c.id}
          aria-label={(added ? "Remove" : "Add") +
            " " +
            c.name +
            " " +
            (added ? "from" : "to") +
            " learning set"}
          aria-pressed={added}
          >{@html icon(added ? "check" : "plus")}{added
            ? "In your set"
            : "Learn this"}</Button
        >
      </div></Card
    >
  {/snippet}

  {@const method = state.method || "full"}
  {@const learned = state.learned || "all"}
  {@const isLearned = (c) => learnedStatus(status(c))}
  {@const learnedCount = (cases) => cases.filter(isLearned).length}
  {@const availableGroups = methodGroups(catalog, section, method)}
  {@const groups = availableGroups.map((g) => g.name)}
  {@const visibleGroups = libraryGroups(
    catalog,
    {
      section,
      method,
      group,
      query,
      learned,
    },
    isLearned,
  )}
  {@const cases = visibleGroups.flatMap((g) => g.cases)}
  <div class="page-heading">
    {#if workspace}<h2>{section}</h2>{:else}<h1>Algorithm library</h1>{/if}
    <div class="library-heading-actions">
      <Button
        id="bulk-mode"
        class="secondary"
        data-action="bulk-mode"
        aria-pressed={!!bulk}>{bulk ? "Done" : "Select cases"}</Button
      ><Button
        class="primary"
        data-action="practice-shown"
        {...cases.length ? {} : { disabled: true }}
        >Practice shown ({cases.length})</Button
      ><Button
        class="secondary"
        data-action="practice-filtered"
        {...cases.length ? {} : { disabled: true }}>Choose cases…</Button
      >
    </div>
  </div>
  <div class="library-console">
    <div class="library-toolbar">
      {#if workspace}{:else}<div
          class="segmented"
          aria-label="Algorithm section"
        >
          {#each ["PLL", "OLL"] as s}<Button
              data-action="section"
              data-section={s}
              aria-pressed={section === s}
              >{s}<span
                >{methodGroups(catalog, s, method).reduce(
                  (count, g) => count + g.cases.length,
                  0,
                )}</span
              ></Button
            >{/each}
        </div>{/if}<Label class="search"
        >{@html icon("search")}<Input
          id="search"
          type="search"
          placeholder="Find a case or group…"
          aria-label="Search cases"
          value={query}
        /></Label
      >
    </div>
    <div class="library-filters">
      <div class="console-field">
        <span class="console-caption" aria-hidden="true">Method</span
        >{#if workspace}<div
            class="segmented"
            role="group"
            aria-label="Last-layer scope"
          >
            {#each [["two-look", "Two-look"], ["full", "Full"]] as [id, label]}<Button
                data-action="cfop-method"
                data-id={id}
                aria-pressed={method === id}>{label}</Button
              >{/each}
          </div>{:else}<SelectControl
            id={"method"}
            label={"Learning method"}
            value={method}
            options={learningMethods}
          />{/if}
      </div>
      <div class="console-field">
        <span class="console-caption" aria-hidden="true">Status</span
        ><SelectControl
          id={"learned"}
          label={"Learning status"}
          value={learned}
          options={[
            { value: "all", label: "All learning statuses" },
            { value: "learned", label: "Learned" },
            { value: "unlearned", label: "Unlearned" },
          ]}
        />
      </div>
      <div class="console-field">
        <span class="console-caption" aria-hidden="true">Group</span
        ><SelectControl
          id={"group"}
          label={"Filter by group"}
          value={group}
          options={[
            { value: "all", label: "All groups" },
            ...groups.map((g) => ({ value: g, label: g })),
          ]}
        />
      </div>
    </div>
  </div>
  {#if workspace && section === "PLL"}<Button
      class="text-button"
      data-action="pll-quiz">Start PLL quiz</Button
    >{/if}
  <div class="library-meta">
    <span
      >{learned === "all"
        ? `${learnedCount(cases)} / ${cases.length} learned`
        : `${cases.length} ${cases.length === 1 ? "case" : "cases"}`} · viewed from
      above</span
    >
  </div>
  <OccurrenceNote {section} />
  {#if bulk}
    <section class="bulk-toolbar" aria-label="Bulk case properties">
      <div class="bulk-toolbar-heading">
        <strong role="status">{chosen.size} selected</strong>
        <Button
          class="text-button"
          data-action="bulk-clear"
          disabled={!chosen.size}>Clear selection</Button
        >
      </div>
      {@render selection(
        cases,
        "bulk-select-all",
        "Select all matching",
        `Select all matching (${cases.length})`,
      )}
      <div class="bulk-properties">
        <div class="bulk-property">
          <Label for="bulk-known">Known</Label>
          <SelectControl
            id="bulk-known"
            label="Known"
            value={bulk.known}
            options={[
              { value: "keep", label: "Leave unchanged" },
              { value: "add", label: "Mark known" },
              { value: "remove", label: "Remove known mark" },
            ]}
          />
        </div>
        <div class="bulk-property">
          <Label for="bulk-learning-set">Learning set</Label>
          <SelectControl
            id="bulk-learning-set"
            label="Learning set"
            value={bulk.learningSet}
            options={[
              { value: "keep", label: "Leave unchanged" },
              { value: "add", label: "Add to learning set" },
              { value: "remove", label: "Remove from learning set" },
            ]}
          />
        </div>
        <Button
          class="primary"
          data-action="bulk-apply"
          disabled={!chosen.size ||
            (bulk.known === "keep" && bulk.learningSet === "keep")}
          >Apply to {chosen.size} {chosen.size === 1 ? "case" : "cases"}</Button
        >
      </div>
      <p class="muted">
        Uses each case’s chosen algorithm. Applying or changing filters clears
        selection.
      </p>
    </section>
  {/if}
  <div class="library-groups">
    {#if visibleGroups.length}{#each visibleGroups as g}<section
          class="library-group"
          aria-labelledby={"group-" + g.index}
        >
          <div class="group-heading">
            {#if bulk}{@render selection(
                g.cases,
                `bulk-group-${g.index}`,
                `Select ${g.name}`,
                "",
              )}{/if}
            <h2 id={"group-" + g.index}>
              <Button
                data-action="collapse-group"
                data-group={`${method}:${section}:${g.name}`}
                aria-expanded={query ||
                !(preferences.collapsedGroups || []).includes(
                  `${method}:${section}:${g.name}`,
                )
                  ? "true"
                  : "false"}
                aria-controls={"group-cases-" + g.index}
                >{g.name}
                <span class="count"
                  >{learned === "all"
                    ? `${learnedCount(g.cases)} / ${g.cases.length} learned`
                    : g.cases.length}</span
                ><span class="group-chevron" aria-hidden="true">⌄</span></Button
              >
            </h2>
          </div>
          <div
            id={"group-cases-" + g.index}
            class="library-grid"
            {...!query &&
            (preferences.collapsedGroups || []).includes(
              `${method}:${section}:${g.name}`,
            )
              ? { hidden: true }
              : {}}
          >
            {#if g.description}<p class="group-description">
                {g.description}
              </p>{/if}{#each g.cases as item, index}{@render libraryCard(
                item,
              )}{/each}
          </div>
        </section>{/each}{:else}<div class="no-results">
        <h2>No matching cases</h2>
        <Button data-action="clear-search" class="secondary"
          >Clear filters</Button
        >
      </div>{/if}
  </div>
  <p class="source-note">
    Algorithms and setups: <a
      href={"https://jperm.net/algs/" + section.toLowerCase()}
      target="_blank"
      rel="noreferrer">J Perm</a
    >.
  </p>
{/snippet}
{@render content(model)}
