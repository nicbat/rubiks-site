<script>
  import PreferenceCheckbox from "./PreferenceCheckbox.svelte";
  import NativeSelect from "../lib/components/ui/native-select/native-select.svelte";
  import { displayColors } from "../display-colors.js";
  import ThemeControl from "./ThemeControl.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import AccountData from "./AccountData.svelte";
  import SettingRow from "./SettingRow.svelte";
  import { DEMO_SCENARIOS } from "../demo-account.js";
  let { model } = $props();
  let state = $derived(model.state);
  let preferences = $derived(state.preferences);
</script>

<section
  id="settings-page"
  class="settings-page"
  aria-labelledby="settings-title"
>
  <Card class="settings-card settings-intro">
    <div class="settings-page-heading">
      <h1 id="settings-title" tabindex="-1">Settings</h1>
      <p class="muted">Preferences save immediately on this device.</p>
    </div>
    <Button variant="link" data-action="settings-return"
      >Return to previous page</Button
    >
  </Card>
  {#if state.settingsSaveError}<p role="alert" class="warning">
      {state.settingsSaveError}
    </p>{/if}
  <Card
    class="settings-card settings-section"
    aria-labelledby="settings-appearance-title"
  >
    <h2 id="settings-appearance-title">Appearance</h2>
    <ThemeControl />
  </Card>
  <Card
    class="settings-card settings-section"
    aria-labelledby="settings-diagrams-title"
  >
    <h2 id="settings-diagrams-title">Case diagrams</h2>
    <SettingRow
      id="case-color"
      label="Case top color"
      description="Choose the top color for case previews and practice answers. Random chooses again for each case or question; the library keeps your last fixed color. Timer and guide examples keep their stated orientation."
    >
      <NativeSelect
        id="case-color"
        aria-describedby="case-color-help"
        value={preferences.randomDisplay ? "random" : preferences.displayTop}
      >
        {#each Object.entries(displayColors) as [id, name]}<option value={id}
            >{name}</option
          >{/each}
        <option value="random">Random each case</option>
      </NativeSelect>
    </SettingRow>
    <SettingRow
      id="pll-arrows"
      label="Show PLL movement arrows"
      description="Show where pieces move on PLL diagrams."
    >
      <div class="setting-toggle">
        <PreferenceCheckbox
          id="pll-arrows"
          checked={preferences.pllArrows}
          aria-describedby="pll-arrows-help"
        />
      </div>
    </SettingRow>
  </Card>
  <Card
    class="settings-card settings-section"
    aria-labelledby="settings-timer-title"
  >
    <h2 id="settings-timer-title">Timer</h2>
    <SettingRow
      id="time-format"
      label="Time format"
      description="Use minutes or total seconds for the timer and solve history."
    >
      <NativeSelect
        id="time-format"
        aria-describedby="time-format-help"
        value={preferences.timerMinutes !== false ? "minutes" : "seconds"}
      >
        <option value="minutes">Minutes — 1:05.23</option>
        <option value="seconds">Seconds — 65.23</option>
      </NativeSelect>
    </SettingRow>
    <SettingRow
      id="hide-timer"
      label="Hide timer while solving"
      description="Show your final time when you stop."
    >
      <div class="setting-toggle">
        <PreferenceCheckbox
          id="hide-timer"
          checked={preferences.hideTimer}
          aria-describedby="hide-timer-help"
        />
      </div>
    </SettingRow>
  </Card>
  <Card
    class="settings-card settings-section"
    aria-labelledby="settings-data-title"
  >
    <h2 id="settings-data-title" tabindex="-1">Data &amp; backups</h2>
    <p class="muted">
      Training backups include learning history, solves, and cubes. Preferences
      stay on this device.
    </p>
    {#if preferences.testData}<p class="muted">
        Demo mode is on. Downloads contain sample data; imports change only the
        demo data in this tab.
      </p>{/if}
    <div class="settings-actions">
      <Button variant="secondary" data-action="export"
        >Download training backup</Button
      >
      <Button variant="secondary" data-action="backup">Import backup</Button>
    </div>
    <AccountData
      mode="data"
      account={state.account || {}}
      testData={preferences.testData}
      running={state.timer?.status === "running"}
      progress={state.progress}
      solves={state.solves}
      cubeCollection={state.cubeCollection}
    />
  </Card>
  <Card
    class="settings-card settings-section"
    aria-labelledby="settings-related-title"
  >
    <h2 id="settings-related-title">Related settings</h2>
    <div class="settings-actions">
      <Button variant="secondary" data-action="nav" data-view="cubes"
        >Manage cubes</Button
      >
      <Button variant="secondary" data-action="nav" data-view="account"
        >Account settings</Button
      >
    </div>
    <p class="muted">
      Manage your default timer cube, or open sign-in and account controls.
    </p>
  </Card>
  <Card class="settings-card">
    <details class="settings-advanced">
      <summary>Advanced</summary>
      <h2>Demo mode</h2>
      <SettingRow
        id="test-data"
        label="Use demo data"
        description="Switch to sample training and a fake account. Your real data is kept separately. Demo edits last in this tab and reset on reload; no emails or cloud requests are sent."
      >
        <div class="setting-toggle">
          <PreferenceCheckbox
            id="test-data"
            checked={preferences.testData === true}
            disabled={state.account?.busy}
            aria-describedby="test-data-help"
          />
        </div>
      </SettingRow>
      {#if preferences.testData}
        <SettingRow
          id="demo-account-state"
          label="Demo account state"
          description="Preview account setup, sign-in, and sync failures with sample data."
        >
          <NativeSelect
            id="demo-account-state"
            value={state.account?.scenario}
            aria-describedby="demo-account-state-help"
          >
            {#each DEMO_SCENARIOS as [value, label]}<option {value}
                >{label}</option
              >{/each}
          </NativeSelect>
        </SettingRow>
        <Button variant="secondary" data-action="account-demo-reset"
          >Reset demo account</Button
        >
      {/if}
    </details>
  </Card>
</section>
