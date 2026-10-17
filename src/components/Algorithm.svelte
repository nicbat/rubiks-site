<script module>
  import triggers from "../../data/triggers.json";
  import { createAlgorithmTokenizer } from "../algorithm.js";
  const tokenize = createAlgorithmTokenizer(triggers);
</script>

<script>
  const uid = $props.id();
  let { moves, tokenizer = tokenize } = $props();
  let chunks = $derived(tokenizer(moves));
</script>

<div class="algorithm" aria-label="Algorithm">
  {#each chunks as chunk, index}
    {#if chunk.name}
      <details class="trigger">
        <summary aria-describedby={`${uid}-${index}`}
          >{chunk.moves}<span
            id={`${uid}-${index}`}
            class="trigger-tooltip"
            role="tooltip"
            aria-hidden="true">{chunk.name}</span
          ></summary
        ><span>{chunk.name}</span>
      </details>
    {:else}<span class="plain-moves">{chunk.moves}</span>{/if}
  {/each}
</div>
