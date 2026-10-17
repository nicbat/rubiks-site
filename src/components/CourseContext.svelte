<script>
  import { courseById, moduleById } from "../courses.js";
  import Button from "../lib/components/ui/button/button.svelte";
  let props = $props();
</script>

{#snippet reviewButton(id, reviewed)}
  <Button
    class={reviewed ? "secondary" : "primary"}
    data-action="review-lesson"
    data-id={id}
    aria-pressed={!!reviewed}>{reviewed ? "Reviewed" : "Mark reviewed"}</Button
  >
{/snippet}
{#snippet content(courseId, moduleId, method = "full")}
  {@const module = moduleById(moduleId)}
  {#if courseId !== "cfop" || !module || !courseById("cfop").modules.includes(moduleId)}{:else}{@const current =
      module.guide || module.section.toLowerCase()}
    <div class="page-heading">
      <h1>CFOP</h1>
      <Button class="text-button" data-action="courses-back">All courses</Button
      >
    </div>
    <nav class="guide-sections cfop-sections" aria-label="CFOP sections">
      {#each [["cross", "Cross"], ["f2l", "F2L"], ["oll", "OLL"], ["pll", "PLL"]] as [id, label]}<Button
          data-action="open-module"
          data-course="cfop"
          data-id={id === "cross" || id === "f2l" ? id : `${method}-${id}`}
          aria-pressed={current === id}>{label}</Button
        >{/each}
    </nav>{/if}
{/snippet}

{@render content(props.courseId, props.moduleId, props.method)}
