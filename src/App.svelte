<script>
  import { setThemePreference } from "./theme.js";
  import { setContext } from "svelte";
  import CommandPalette from "./components/CommandPalette.svelte";
  import { commandState } from "./app-model.svelte.js";
  import AppView from "./components/AppView.svelte";
  let { model, actions } = $props();
  setContext("actions", {
    setThemePreference,
    setPreference: (...args) => actions.setPreference(...args),
    chooseOption: (...args) => actions.chooseOption(...args),
    setLibrarySelection: (...args) => actions.setLibrarySelection(...args),
    setTimerSelection: (...args) => actions.setTimerSelection(...args),
    setPracticeSelection: (...args) => actions.setPracticeSelection(...args),
    setStarterSelection: (...args) => actions.setStarterSelection(...args),
    closeCommands: () => actions.closeCommands(),
    runCommand: (...args) => actions.runCommand(...args),
    setProfileField: (...args) => actions.setProfileField(...args),
    closeDialog: (...args) => actions.closeDialog(...args),
  });
</script>

{#if model.snapshot}
  <AppView {...model.snapshot} />
{/if}

{#if commandState.open}<CommandPalette model={commandState} />{/if}
