<script>
  import { occurrenceStage } from "../case-occurrences.js";
  let { section } = $props();
  let stage = $derived(occurrenceStage(section));
</script>

{#if stage}
  <details class="occurrence-note">
    <summary>About occurrence</summary>
    <p>
      Full {section} probabilities at the {section} stage of a standard 3×3 solve,
      including skips. {section} skip: {stage.skipWeight}/{stage.denominator} ({section ===
      "OLL"
        ? "top already oriented"
        : "solved up to a U turn"}). Two-look steps and practice sets have
      different frequencies.
    </p>
    <p>
      Probability source: <a
        href={stage.source.url}
        target="_blank"
        rel="noreferrer">{stage.source.label}</a
      >.
    </p>
  </details>
{/if}
