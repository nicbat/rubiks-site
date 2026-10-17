<script>
  import { icon } from "../icons.js";
  import { tokens } from "../cube.js";

  import { playerViewMode } from "../cube-player.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet iconControl(action, label, symbol)}
  <Button
    class="cube-icon-control"
    data-action={"cube-" + action}
    aria-label={label}
    title={label}>{@html icon(symbol)}</Button
  >
{/snippet}
{#snippet content({ id, mode, algorithm, setup, top = "U" })}
  {@const validatedMode = playerViewMode(id, mode, setup)}
  {@const notation = validatedMode === "notation"}
  {@const preview = validatedMode === "scramble"}
  <section
    class="cube-player"
    aria-label="3D cube player"
    data-algorithm={algorithm}
    data-player-id={id}
    data-cube-mode={mode}
    data-display-top={top}
    {...mode === "lesson" ? { "data-setup": setup } : {}}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (main.js provides arrow-key and pointer controls for the cube.) -->
    <div
      class="cube-stage"
      tabindex="0"
      role="img"
      aria-label="Interactive 3D cube. Drag or use arrow keys to change the view."
    >
      <div class="cube-camera"><div class="cube-scene"></div></div>
    </div>
    {#if preview}<div class="cube-controls">
        <Button data-action="cube-view">Reset view</Button>
      </div>{:else}{#if notation}<div class="cube-controls">
          {@render iconControl("toggle", "Play", "play")}
        </div>{:else}<input
          class="cube-scrubber"
          type="range"
          min="0"
          max={tokens(algorithm).length}
          step="0.01"
          value="0"
          aria-label="Scrub through moves"
        />
        <p class="cube-position"></p>
        <div class="cube-moves" aria-label="Playback moves">
          {#each tokens(algorithm) as move, i}<Button
              data-action="cube-seek"
              data-index={i}
              aria-label={"Go to move " + (i + 1) + ": " + move}>{move}</Button
            >{/each}
        </div>
        <div class="cube-controls">
          {@render iconControl("toggle", "Play", "play")}{@render iconControl(
            "previous",
            "Previous move",
            "previous",
          )}{@render iconControl(
            "next",
            "Next move",
            "next",
          )}{@render iconControl("reset", "Reset", "restart")}<Button
            data-action="cube-view">Reset view</Button
          >
        </div>{/if}{/if}
    <p class="cube-help">
      Drag to look around · arrow keys change the view{notation
        ? " · repeats the selected move"
        : ""}
    </p>
  </section>
{/snippet}

{@render content(props)}
