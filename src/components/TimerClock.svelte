<script>
  import { liveClock } from "../app-model.svelte.js";
  let { running, time } = $props();
</script>

<output
  id="timer-clock"
  class="timer-clock"
  aria-label="Solve time"
  aria-live="off">{running ? liveClock.text : time}</output
>
