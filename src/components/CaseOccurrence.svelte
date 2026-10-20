<script>
  import { occurrenceFor } from "../case-occurrences.js";
  let { item } = $props();
  let probability = $derived(occurrenceFor(item));
</script>

{#if probability}<span class="case-occurrence"
    >Occurrence {probability.fraction}</span
  >{/if}
