<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import { icon } from "../icons.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const { state } = model}

  <DialogContent id="scramble-dialog" aria-labelledby="scramble-title"
    ><div class="dialog-heading">
      <h2 id="scramble-title">Scrambled cube</h2>
      <Button
        class="icon-button"
        data-action="close-dialog"
        aria-label="Close scramble preview">{@html icon("close")}</Button
      >
    </div>
    <p>After the current scramble · yellow on top, green in front.</p>
    <CubePlayer
      {...{
        id: "timer-scramble",
        mode: "scramble",
        algorithm: state.timer.scramble,
      }}
    />
    <p class="scramble-preview-moves">
      {state.timer.scramble}
    </p></DialogContent
  >
{/snippet}
{@render content(model)}
