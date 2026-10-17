<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet content(picker, caseDiagram)}
  {@const chosen = new Set(picker.selected)}
  {@const total = picker.groups.reduce((n, group) => n + group.cases.length, 0)}
  <DialogContent
    id="practice-picker"
    aria-labelledby="practice-picker-title"
    aria-describedby="practice-picker-help"
  >
    <div class="dialog-heading">
      <h2 id="practice-picker-title">Choose cases to practice</h2>
      <Button
        class="icon-button"
        data-action="close-dialog"
        aria-label="Close practice picker">{@html icon("close")}</Button
      >
    </div>
    <p id="practice-picker-help">
      Choose individual cases or click a group heading to select the group. Your
      learning set stays unchanged.
    </p>
    <p class="muted">
      {picker.section} · {total} cases matching your library filters
    </p>
    {#each picker.groups as group}{@const count = group.cases.filter((c) =>
        chosen.has(c.id),
      ).length}
      <section
        class="practice-pick-group"
        aria-labelledby={"pick-group-" + group.index}
      >
        <h3 id={"pick-group-" + group.index}>
          <Button
            role="checkbox"
            aria-checked={count === group.cases.length
              ? "true"
              : count
                ? "mixed"
                : "false"}
            aria-label={group.name}
            data-action="pick-group"
            data-group={group.index}
            ><span class="pick-check" aria-hidden="true"
              >{count === group.cases.length ? "✓" : count ? "−" : ""}</span
            ><span>{group.name}</span><small
              >{count} / {group.cases.length}</small
            ></Button
          >
        </h3>
        <div class="practice-pick-grid">
          {#each group.cases as c}<Button
              class="practice-pick-case"
              role="checkbox"
              aria-checked={chosen.has(c.id)}
              aria-label={c.name}
              data-action="pick-case"
              data-id={c.id}
              ><span class="pick-check" aria-hidden="true"
                >{chosen.has(c.id) ? "✓" : ""}</span
              >{@render caseDiagram(c)}<span>{c.name}</span></Button
            >{/each}
        </div>
      </section>{/each}
    <div class="practice-picker-actions">
      <span role="status">{chosen.size} selected</span><Button
        class="primary"
        data-action="practice-picked"
        {...chosen.size ? {} : { disabled: true }}
        >Practice selected ({chosen.size})</Button
      ><Button class="secondary" data-action="practice-all"
        >Practice all ({total})</Button
      >
    </div>
  </DialogContent>
{/snippet}

{@render content(props.picker, props.caseDiagram)}
