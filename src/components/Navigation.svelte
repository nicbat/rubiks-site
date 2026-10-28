<script>
  import { icon } from "../icons.js";
  import { syncStatus } from "../sync-status.js";
  import Button from "../lib/components/ui/button/button.svelte";

  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state, workspace } = model}
  {@const { notice, view } = state}
  {@const sync =
    state.syncStatus ||
    syncStatus({
      account: state.account,
      demo: state.preferences.testData,
      notice,
    })}

  <header class="header">
    <a class="brand" href="#/dashboard" data-action="nav" data-view="dashboard"
      ><span class="brand-mark"><i></i><i></i><i></i><i></i></span>Last Layer</a
    >
    <div class="header-actions">
      <Button
        class="icon-button"
        data-action="commands"
        aria-label="Commands"
        title="Esc">⌘</Button
      >{#if state.account?.profile || notice}<Button
          class="icon-button header-sync"
          data-action="account-sync"
          aria-label="Check sync"
          aria-describedby="header-sync-status"
          title={sync.label}
          aria-disabled={!sync.canCheck}
          data-state={sync.state}
          >{@html icon("restart")}{#if sync.attention}<span
              class="sync-marker"
              aria-hidden="true">!</span
            >{/if}</Button
        ><span class="sr-only" id="header-sync-status">{sync.label}</span>{/if}
      <Button
        class="icon-button header-account"
        href="#/account/profile"
        aria-label="My profile"
        title="My profile">{@html icon("account")}</Button
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
      {#each [["dashboard", "cube", "Dashboard"], ["home", "grid", "My learning"], ["courses", "book", "Courses"], ["progress", "chart", "Progress"], ["timer", "stopwatch", "Timer"]] as [v, i, label]}<Button
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
