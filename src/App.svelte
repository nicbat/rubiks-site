<script>
  import { setContext } from "svelte";
  import CommandPalette from "./components/CommandPalette.svelte";
  import { commandState } from "./app-model.svelte.js";
  import AppView from "./components/AppView.svelte";
  let { model, actions } = $props();
  setContext("actions", {
    setPreference: (...args) => actions.setPreference(...args),
    chooseOption: (...args) => actions.chooseOption(...args),
    closeCommands: () => actions.closeCommands(),
    runCommand: (...args) => actions.runCommand(...args),
    closeDialog: (...args) => actions.closeDialog(...args),
  });
</script>

{#if model.snapshot}
  <AppView {...model.snapshot} />
{/if}

{#if commandState.open}<CommandPalette model={commandState} />{/if}
