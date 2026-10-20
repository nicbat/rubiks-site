<script>
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";

  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state, workspace } = model}
  {@const { notice, view } = state}

  <header class="header">
    <a class="brand" href="#/home" data-action="nav" data-view="home"
      ><span class="brand-mark"><i></i><i></i><i></i><i></i></span>Last Layer</a
    >
    <div class="header-actions">
      <Button
        class="icon-button"
        data-action="commands"
        aria-label="Commands"
        title="Esc">⌘</Button
      ><Button
        class="local-button"
        data-action="backup"
        aria-label="Backup and transfer local progress"
        ><span class="local-dot"></span><span
          >{state.preferences.testData
            ? "Test data"
            : notice
              ? "Progress needs attention"
              : "Saved on this device"}</span
        >{@html icon("download")}</Button
      ><Button
        class="icon-button header-settings"
        data-action="nav"
        data-view="settings"
        aria-label="Settings"
        title="Settings"
        {...["settings", "cubes"].includes(view)
          ? { "aria-current": "page" }
          : {}}>{@html icon("settings")}</Button
      >
    </div>
  </header>
  <div class="nav-wrap">
    <nav aria-label="Main navigation">
      {#each [["home", "grid", "My learning"], ["courses", "book", "Courses"], ["progress", "chart", "Progress"], ["timer", "stopwatch", "Timer"]] as [v, i, label]}<Button
          data-action="nav"
          data-view={v}
          {...view === v ||
          (v === "courses" && (workspace || view === "pll-quiz"))
            ? { "aria-current": "page" }
            : {}}>{@html icon(i)}{label}</Button
        >{/each}
    </nav>
  </div>
{/snippet}
{@render content(model)}
