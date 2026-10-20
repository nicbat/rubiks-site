<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import { f2lCases, f2lSetup } from "../f2l.js";
  import { applyAlg, solvedCube } from "../cube.js";
  import { f2lDiagram } from "../f2l-diagram.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  let props = $props();
</script>

{#snippet content({ example = null } = {})}
  {@const groups = [...new Set(f2lCases.map((item) => item.group))]}
  <section class="f2l-reference">
    <h2>F2L · 41 cases</h2>
    <p class="guide-note">
      White down, green front. Match the highlighted corner and edge; gray
      pieces do not matter. Solve into the front-right slot.
    </p>
    <details class="f2l-help">
      <summary>How to use these cases</summary>
      <p>
        Use U turns to match the diagram. Read rotations from left to right.
        Case numbers follow the CubeSkills sheet. Open a cube to step through
        the solution; only one player is loaded at a time.
      </p>
    </details>
    <nav class="f2l-index" aria-label="F2L case groups">
      {#each groups as group, index}<a href={"#f2l-group-" + index}>{group}</a
        >{/each}
    </nav>
    {#each groups as group, index}
      {@const preview = f2lCases.find(
        (item) => item.group === group && item.id === example,
      )}
      <section id={"f2l-group-" + index} class="f2l-group">
        <h3>{group}</h3>
        <div class="f2l-grid">
          {#each f2lCases.filter((item) => item.group === group) as item}{@const setup =
              f2lSetup(item.algorithm)}
            {@const open = example === item.id}
            <Card class="f2l-card"
              ><Button
                class="f2l-case-open"
                data-action="guide-example"
                data-id={item.id}
                aria-label={(open ? "Hide" : "Show") +
                  " 3D F2L case " +
                  item.sourceOrder}
                aria-expanded={open}
                aria-controls={"f2l-preview-" + index}
                >{@html f2lDiagram(
                  applyAlg(solvedCube(), setup),
                  `F2L case ${item.sourceOrder}`,
                )}<span
                  >Case {item.sourceOrder}<small
                    >{open ? "Hide" : "Show"} 3D</small
                  ></span
                ></Button
              >
              <p class="f2l-algorithm">{item.algorithm}</p>
            </Card>{/each}
        </div>
        <div id={"f2l-preview-" + index}>
          {#if preview}
            <section
              class="f2l-preview"
              aria-label={`F2L case ${preview.sourceOrder} preview`}
            >
              <h4>Case {preview.sourceOrder}</h4>
              <p class="f2l-algorithm">{preview.algorithm}</p>
              <CubePlayer
                id={preview.id}
                mode="lesson"
                setup={f2lSetup(preview.algorithm)}
                algorithm={preview.algorithm}
              />
            </section>
          {/if}
        </div>
      </section>{/each}
    <p class="guide-sources">
      Algorithms: <a
        href="https://www.cubeskills.com/uploads/pdf/tutorials/f2l.pdf"
        target="_blank"
        rel="noreferrer">CubeSkills · Feliks Zemdegs and Andy Klise</a
      >. Diagrams generated locally.
    </p>
  </section>
{/snippet}

{@render content(props)}
