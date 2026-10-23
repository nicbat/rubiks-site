<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import { applyAlg, solvedCube, tokens } from "../cube.js";
  import { f2lDiagram } from "../f2l-diagram.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  let { item, example = null } = $props();
</script>

{#snippet content(item, example)}
  {@const open = item.id === example}
  {@const framesData = [{ moves: "", text: item.start }, ...item.steps].reduce(
    (frames, step) => {
      const cube = applyAlg(
        frames.at(-1)?.cube || applyAlg(solvedCube(), item.setup),
        step.moves,
      );
      return [...frames, { ...step, cube }];
    },
    [],
  )}
  {#snippet frames()}{#each framesData as step}{@const cube = step.cube}
      <figure class="cross-frame">
        <div class="cross-move">
          {#if step.moves}<span aria-hidden="true"
              >→
            </span>{step.moves}{:else}Start{/if}
        </div>
        <div class="cross-views">
          {#each ["", "z2"] as rotation}<div>
              {@html f2lDiagram(
                cube,
                `${item.title}: ${step.text}, ${rotation ? "underneath" : "above"}`,
                { targets: item.pieces, rotation },
              )}<small>{rotation ? "Underneath" : "Above"}</small>
            </div>{/each}
        </div>
        <figcaption>{step.text}</figcaption>
      </figure>{/each}{/snippet}
  <Card class="guide-example" aria-label={item.title}
    ><header>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </header>
    <div class="cross-sequence">{@render frames()}</div>
    {#if item.comparison}<div class="cross-comparison">
        <span
          >{item.comparison.label}: <strong>{item.comparison.algorithm}</strong>
          · {tokens(item.comparison.algorithm).length} moves</span
        ><span
          >Align last: <strong>{item.algorithm}</strong> · {tokens(
            item.algorithm,
          ).length} moves</span
        >
      </div>{/if}
    <div class="guide-example-actions">
      <Button
        class="guide-cube-toggle"
        data-action="guide-example"
        data-id={item.id}
        aria-expanded={open}
        aria-controls={"guide-demo-" + item.id}
        aria-label={(open ? "Hide" : "Show") + " 3D example: " + item.title}
        >{open ? "Hide" : "Show"} 3D example</Button
      >
      <details>
        <summary>Setup moves</summary>
        <p class="guide-algorithm">{item.setup}</p>
      </details>
    </div>
    <div id={"guide-demo-" + item.id}>
      {#if open}<CubePlayer
          {...{
            id: `guide-${item.id}`,
            mode: "lesson",
            setup: item.setup,
            algorithm: item.algorithm,
          }}
        />{/if}
    </div></Card
  >
{/snippet}
{@render content(item, example)}
