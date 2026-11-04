<script>
  import ProfilePicture from "./ProfilePicture.svelte";
  import { icon } from "../icons.js";
  import { syncStatus } from "../sync-status.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Wordmark from "./Wordmark.svelte";
  import BrandLogo from "./BrandLogo.svelte";

  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state, workspace } = model}
  {@const { notice, view } = state}
  {@const settingsActive =
    state.settings ||
    view === "cubes" ||
    (view === "account" && state.accountSection === "settings")}
  {@const sync =
    state.syncStatus ||
    syncStatus({
      account: state.account,
      demo: state.preferences.testData,
      notice,
    })}

  <header class="header">
    <a class="brand" href="/dashboard" data-action="nav" data-view="dashboard"
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
        href="/account/profile"
        aria-label="My profile"
        title="My profile"
        >{#if state.account?.profile}<ProfilePicture
            id={state.account.profile.avatar_id}
            small
          />{:else}{@html icon("account")}{/if}</Button
      >
    </div>
  </header>
  <div class="nav-wrap">
    <nav aria-label="Main navigation">
      {#each [["dashboard", "cube", "Dashboard"], ["home", "grid", "My learning"], ["courses", "book", "Courses"], ["progress", "chart", "Progress"], ["timer", "stopwatch", "Timer"], ["about", "book", "About"], ["settings", "settings", "Settings"]] as [v, i, label]}<Button
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
