<script>
  import Card from "../lib/components/ui/card/card.svelte";

  import { libraryGroups, learnedStatus } from "../library.js";
  import { learningMethods, methodGroups } from "../learning-methods.js";
  import { tokens } from "../cube.js";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import SelectControl from "./SelectControl.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
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
    aliasMarkup,
    workspace,
  } = model}
  {@const { preferences, section, query, group } = state}
  {#snippet libraryCard(c)}
    {@const added = progressIndex.isSelected(c.id)}
    <Card class="library-case"
      ><Button
        class="case-open"
        data-action="detail"
        data-id={c.id}
        aria-label={"View " + c.name}
        >{@render caseDiagram(c)}
        <div>
          <h3>{c.name}</h3>
          {@render aliasMarkup(c)}{@render badge(c)}
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
    {#if workspace}<h2>{section}</h2>{:else}<h1>
        Algorithm library
      </h1>{/if}<Button
      class="primary"
      data-action="practice-filtered"
      {...cases.length ? {} : { disabled: true }}>Practice these cases</Button
    >
  </div>
  <div class="library-filters">
    {#if workspace}<div
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
      />{/if}<SelectControl
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
  <div class="library-toolbar">
    {#if workspace}{:else}<div class="segmented" aria-label="Algorithm section">
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
  <div class="library-groups">
    {#if visibleGroups.length}{#each visibleGroups as g}<section
          class="library-group"
          aria-labelledby={"group-" + g.index}
        >
          <div class="group-heading">
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
