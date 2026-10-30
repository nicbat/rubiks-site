<script>
  import Checkbox from "../lib/components/ui/checkbox/checkbox.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  let { groups, selected, caseDiagram, idPrefix, onSelectionChange } = $props();
  const ids = $derived(groups.flatMap((group) => group.cases.map((c) => c.id)));
  const chosen = $derived(new Set(selected));
</script>

<div class="case-selection">
  <div class="case-selection-tools">
    <Button
      class="secondary"
      disabled={chosen.size === ids.length}
      onclick={() => onSelectionChange?.(ids, true)}
      >Select all ({ids.length})</Button
    >
    <Button
      class="text-button"
      disabled={!chosen.size}
      onclick={() => onSelectionChange?.(ids, false)}>Clear selection</Button
    >
  </div>
  {#each groups as group}
    {@const count = group.cases.filter((c) => chosen.has(c.id)).length}
    {@const groupId = `${idPrefix}-group-${group.index}`}
    <section class="practice-pick-group" aria-labelledby={`${groupId}-label`}>
      <div class="case-selection-heading">
        <Checkbox
          id={groupId}
          aria-label={group.name}
          checked={count === group.cases.length}
          indeterminate={count > 0 && count < group.cases.length}
          onCheckedChange={(checked) =>
            onSelectionChange?.(
              group.cases.map((c) => c.id),
              checked,
            )}
        />
        <h3 id={`${groupId}-label`}>
          <Label for={groupId}>{group.name}</Label>
        </h3>
        <small>{count} / {group.cases.length}</small>
      </div>
      <div class="practice-pick-grid">
        {#each group.cases as c}
          {@const caseId = `${idPrefix}-${c.id}`}
          <div class="practice-pick-case" data-selected={chosen.has(c.id)}>
            <Checkbox
              id={caseId}
              aria-label={c.name}
              checked={chosen.has(c.id)}
              onCheckedChange={(checked) =>
                onSelectionChange?.([c.id], checked)}
            />
            <Label class="practice-pick-label" for={caseId}>
              {@render caseDiagram(c)}<span>{c.name}</span>
            </Label>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>
