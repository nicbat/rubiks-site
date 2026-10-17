<script>
  import { getContext } from "svelte";
  import { commands, commandFilter } from "../commands.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import * as Command from "../lib/components/ui/command/index.js";
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  let { model } = $props();
  const actions = getContext("actions");
</script>

<DialogContent id="command-dialog" aria-labelledby="command-title">
  <h2 id="command-title" class="sr-only">Commands</h2>
  <Button
    class="icon-button"
    id="command-close"
    aria-label="Close commands"
    onclick={() => actions.closeCommands()}>{@html icon("close")}</Button
  >
  <Command.Root label="Search commands" loop filter={commandFilter}>
    <Command.Input
      id="command-search"
      aria-label="Search commands"
      aria-controls="command-results"
      placeholder="Search commands"
      bind:value={model.query}
    />
    <Command.List id="command-results" aria-label="Commands">
      <Command.Empty role="status">No matching commands.</Command.Empty>
      {#each commands as [label, command]}
        <Command.Item value={label} onSelect={() => actions.runCommand(command)}
          >{label}</Command.Item
        >
      {/each}
    </Command.List>
  </Command.Root>
</DialogContent>
