<script>
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Wordmark from "./Wordmark.svelte";
  import BrandLogo from "./BrandLogo.svelte";

  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state, workspace } = model}
  {@const { view } = state}
  {@const settingsActive =
    state.settings ||
    view === "cubes" ||
    (view === "account" && state.accountSection === "settings")}

  <header class="header">
    <a class="brand" href="/home" data-action="nav" data-view="home"
      ><BrandLogo /><Wordmark /><span class="sr-only">Last Layer</span></a
    >
    <!-- Decorative status panel: one light per cube face. -->
    <span class="header-signal" aria-hidden="true"
      ><span class="signal-lights"
        >{#each ["white", "yellow", "red", "orange", "blue", "green"] as face}<i
            style="--light: var(--cube-{face})"
          ></i>{/each}</span
      ><span class="signal-label">Speed cube trainer</span></span
    >
    <div class="header-actions">
      <Button
        class="icon-button"
        data-action="commands"
        aria-label="Commands"
        title="Esc">⌘</Button
      >
    </div>
  </header>
  <div class="nav-wrap">
    <nav aria-label="Main navigation">
      {#each [["home", "grid", "Dashboard"], ["courses", "book", "Courses"], ["progress", "chart", "Profile"], ["timer", "stopwatch", "Timer"], ["about", "book", "About"], ["settings", "settings", "Settings"]] as [v, i, label]}<Button
          class={v === "settings" ? "settings-nav" : undefined}
          data-action="nav"
          data-view={v}
          disabled={v === "settings" && state.timer?.status === "running"}
          {...(
            v === "settings"
              ? settingsActive
              : !settingsActive &&
                (view === v ||
                  (v === "courses" && (workspace || view === "pll-quiz")))
          )
            ? { "aria-current": "page" }
            : {}}>{@html icon(i)}{label}</Button
        >{/each}
    </nav>
  </div>
{/snippet}
{@render content(model)}
