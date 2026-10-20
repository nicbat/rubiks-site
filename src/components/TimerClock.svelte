<script>
  import { liveClock } from "../app-model.svelte.js";
  let { running, time } = $props();
  const text = $derived(running ? liveClock.text : time);
</script>

<output
  id="timer-clock"
  class="timer-clock"
  aria-label="Solve time"
  aria-live="off"
  data-ghost={text.replace(/\d/g, "8")}>{text}</output
>
