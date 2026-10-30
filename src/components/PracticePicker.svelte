<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CaseSelection from "./CaseSelection.svelte";
  import { getContext } from "svelte";
  let props = $props();
  const actions = getContext("actions");
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
      Check the cases you want, then start. These choices apply to this session
      only; your learning set stays unchanged.
    </p>
    <p class="muted">
      {picker.section} · {total} cases matching your library filters
    </p>
    <CaseSelection
      groups={picker.groups}
      selected={picker.selected}
      {caseDiagram}
      idPrefix="practice-pick"
      onSelectionChange={actions?.setPracticeSelection}
    />
    <div class="practice-picker-actions">
      <span role="status">{chosen.size} selected</span><Button
        class="primary"
        data-action="practice-picked"
        {...chosen.size ? {} : { disabled: true }}
        >Practice selected ({chosen.size})</Button
      >
    </div>
  </DialogContent>
{/snippet}

{@render content(props.picker, props.caseDiagram)}
