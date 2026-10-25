<script>
  import { moduleById } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CourseContent from "./CourseContent.svelte";
  import Notation from "./Notation.svelte";
  let props = $props();
</script>

{#snippet content({
  section = "cross",
  embedded = false,
  example = section === "notation" ? "notation" : null,
  notationMove = "R",
  notationSuffix = "",
} = {})}
  {@const current = ["cross", "f2l", "notation"].includes(section)
    ? section
    : "cross"}
  {#snippet navigation()}{#if !embedded}<div class="page-heading">
        <h1>Guides</h1>
      </div>
      <nav class="guide-sections" aria-label="Guide sections">
        {#each [["cross", "Cross"], ["f2l", "F2L"], ["notation", "Notation"]] as [id, label]}<Button
            data-action="guide-section"
            data-id={id}
            aria-pressed={current === id}>{label}</Button
          >{/each}
      </nav>{/if}{/snippet}
  {#if current === "notation"}{@render navigation()}
    <div class="guide-notation">
      <Button
        class="guide-cube-toggle"
        data-action="guide-example"
        data-id="notation"
        aria-expanded={example === "notation"}
        >{example === "notation" ? "Hide" : "Show"} 3D notation cube</Button
      ><Notation
        move={notationMove}
        suffix={notationSuffix}
        {...{ showCube: example === "notation" }}
      />
    </div>
  {:else}
    {@render navigation()}
    {#if current === "f2l"}<section class="f2l-reference">
        <CourseContent
          nodes={moduleById("f2l").nodes}
          {example}
          externalLinks={true}
        />
      </section>
    {:else}<div class="guide-page cross-guide">
        <CourseContent
          nodes={moduleById("cross").nodes}
          {example}
          externalLinks={true}
        />
      </div>{/if}
  {/if}
{/snippet}

{@render content(props)}
