<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import guides from "../../data/guides.json";
  import { applyAlg, solvedCube, tokens } from "../cube.js";
  import { f2lDiagram } from "../f2l-diagram.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  import Notation from "./Notation.svelte";
  import F2L from "./F2L.svelte";
  let props = $props();
</script>

{#snippet renderCrossExample(item, example)}
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
    </div>{:else}{#if current === "f2l"}{@render navigation()}<F2L
        {...{ example }}
      />{:else}{@const guide = guides.cross}
      {@render navigation()}
      <div class="guide-page cross-guide">
        <header class="guide-intro">
          <h2>{guide.title}</h2>
          <p>{guide.intro}</p>
        </header>
        <aside class="cross-fact">
          <h3>Check another colour</h3>
          <p>
            Compare white and yellow. Try more colours as you get comfortable.
            Choose a cross you can plan, with an easy first pair when possible.
          </p>
          Every cross has an<strong>8-move-or-fewer</strong> solution. Half
          turns count as one.
          <a
            href="https://www.cubezone.be/crossstudy.html"
            target="_blank"
            rel="noreferrer">The research</a
          >
        </aside>
        <p class="guide-note">
          Hold white down, green front. Each picture shows the same cube from
          above and underneath. Coloured pieces are the ones to watch.
        </p>
        <section class="guide-examples" aria-label="Cross planning examples">
          {#each guide.examples as item}{@render renderCrossExample(
              item,
              example,
            )}{/each}
        </section>
        <aside class="cross-practice">
          <h3>Try it without looking</h3>
          <p>
            Plan your cross. Close your eyes. Execute it. Then repeat the
            scramble and look for a first pair.
          </p>
        </aside>
        <p class="guide-sources">
          Keep learning: {#each guide.sources as { label, url }, index}{#if index}
              ·
            {/if}<a href={url} target="_blank" rel="noreferrer">{label}</a
            >{/each}
        </p>
      </div>{/if}{/if}
{/snippet}

{@render content(props)}
