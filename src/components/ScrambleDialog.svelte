<script>
  import { getCubeEvent } from "../cube-events.js";
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
    <p>
      After the current scramble · {state.timer.scrambleGrip?.up || "yellow"} on top,
      {state.timer.scrambleGrip?.front || "green"} in front.
    </p>
    <CubePlayer
      {...{
        id: "timer-scramble",
        mode: "scramble",
        algorithm: state.timer.scramble,
        size: getCubeEvent(state.timer.eventId || "333").size,
        grip: state.timer.scrambleGrip,
      }}
    />
    <p class="scramble-preview-moves">
      {state.timer.scramble}
    </p></DialogContent
  >
{/snippet}
{@render content(model)}
