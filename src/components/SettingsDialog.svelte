<script>
  import PreferenceCheckbox from "./PreferenceCheckbox.svelte";
  import NativeSelect from "../lib/components/ui/native-select/native-select.svelte";
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { displayColors } from "../display-colors.js";
  import { icon } from "../icons.js";
  import ThemeControl from "./ThemeControl.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";

  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state } = model}
  {@const { preferences } = state}

  <DialogContent id="settings-dialog" aria-labelledby="settings-title"
    ><div class="dialog-heading">
      <h1 id="settings-title">Settings</h1>
      <Button
        class="icon-button"
        data-action="close-dialog"
        aria-label="Close settings">{@html icon("close")}</Button
      >
    </div>
    <section class="settings-panel">
      <h2>Your cubes</h2>
      <p class="muted">Manage your collection and default timer cube.</p>
      <Button class="secondary" data-action="nav" data-view="cubes"
        >Cubes</Button
      >
      <h2>Display and timer</h2>
      <ThemeControl /><Label class="cube-field" for="display-top"
        >Default display top color<NativeSelect id="display-top"
          >{#each Object.entries(displayColors) as [id, name]}<option
              value={id}
              {...preferences.displayTop === id ? { selected: true } : {}}
              >{name}</option
            >{/each}</NativeSelect
        ></Label
      ><Label class="setting-toggle"
        ><PreferenceCheckbox
          id="random-display"
          {...preferences.randomDisplay ? { checked: true } : {}}
        />Randomize display color</Label
      >
      <p class="muted">
        Randomize per case opening or question. Timer previews stay yellow.
      </p>
      <Label class="setting-toggle"
        ><PreferenceCheckbox
          id="pll-arrows"
          {...preferences.pllArrows ? { checked: true } : {}}
        />PLL arrows</Label
      >
      <p class="muted">Show piece movement on PLL diagrams.</p>
      <Label class="setting-toggle"
        ><PreferenceCheckbox
          id="timer-minutes"
          {...preferences.timerMinutes !== false ? { checked: true } : {}}
        />Show minutes on timer</Label
      >
      <p class="muted">Turn off to show total seconds.</p>
      <Label class="setting-toggle"
        ><PreferenceCheckbox
          id="hide-timer"
          {...preferences.hideTimer ? { checked: true } : {}}
        />Hide timer while solving</Label
      >
      <p class="muted">Show the time when you stop.</p>
    </section></DialogContent
  >
{/snippet}
{@render content(model)}
