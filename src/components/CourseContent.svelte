<script>
  import { courseExamples } from "../courses.js";
  import { applyAlg, solvedCube } from "../cube.js";
  import { f2lDiagram } from "../f2l-diagram.js";
  import Algorithm from "./Algorithm.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  import CrossExample from "./CrossExample.svelte";
  import F2L from "./F2L.svelte";
  import Library from "./Library.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  let {
    nodes,
    example = null,
    model = null,
    headingOffset = 0,
    externalLinks = false,
  } = $props();
</script>

{#snippet renderNodes(items)}
  {#each items as node}
    {#if node.type === "text"}{node.text}
    {:else if node.type === "code"}<code>{node.text}</code>
    {:else if node.type === "br"}<br />
    {:else if node.type === "inline"}{@render renderNodes(node.children)}
    {:else if node.type === "paragraph"}<p>
        {@render renderNodes(node.children)}
      </p>
    {:else if node.type === "heading"}
      <svelte:element this={"h" + Math.min(node.depth + headingOffset, 6)}
        >{@render renderNodes(node.children)}</svelte:element
      >
    {:else if node.type === "strong"}<strong
        >{@render renderNodes(node.children)}</strong
      >
    {:else if node.type === "em"}<em>{@render renderNodes(node.children)}</em>
    {:else if node.type === "link"}<a
        href={node.href}
        target={externalLinks && node.href.startsWith("https:")
          ? "_blank"
          : undefined}
        rel={externalLinks && node.href.startsWith("https:")
          ? "noreferrer"
          : undefined}>{@render renderNodes(node.children)}</a
      >
    {:else if node.type === "list"}
      {#if node.ordered}<ol start={node.start}>
          {#each node.items as item}<li>{@render renderNodes(item)}</li>{/each}
        </ol>
      {:else}<ul>
          {#each node.items as item}<li>{@render renderNodes(item)}</li>{/each}
        </ul>{/if}
    {:else if node.type === "layout"}
      {#if node.kind === "intro"}<header class="guide-intro">
          {@render renderNodes(node.children)}
        </header>
      {:else if node.kind === "fact" || node.kind === "practice"}<aside
          class={"cross-" + node.kind}
        >
          {@render renderNodes(node.children)}
        </aside>
      {:else if node.kind === "note" || node.kind === "sources"}<p
          class={"guide-" + node.kind}
        >
          {@render renderNodes(node.children)}
        </p>
      {:else if node.kind === "examples"}<section
          class="guide-examples"
          aria-label={node.label}
        >
          {@render renderNodes(node.children)}
        </section>
      {:else if node.kind === "details"}<details class="f2l-help">
          <summary>{node.label}</summary>{@render renderNodes(node.children)}
        </details>{/if}
    {:else if node.type === "cross-example"}<CrossExample
        item={{ id: node.example, ...courseExamples[node.example] }}
        {example}
      />
    {:else if node.type === "f2l-cases"}<F2L {example} />
    {:else if node.type === "algorithm-library" && model}<Library {model} />
    {:else if node.type === "cube"}
      {@const demo = courseExamples[node.example]}
      {@const before = applyAlg(solvedCube(), demo.setup)}
      {@const rotation = demo.view === "underneath" ? "z2" : ""}
      <section class="lesson-example" aria-label={demo.title}>
        <h4>{demo.title}</h4>
        <p>{demo.caption}</p>
        <div class="lesson-diagrams">
          {#each [["Before", before], ["After", applyAlg(before, demo.algorithm)]] as [label, cube]}
            <figure>
              {@html f2lDiagram(
                cube,
                `${demo.title}: ${label.toLowerCase()}${rotation ? ", viewed underneath" : ", yellow up"}`,
                { targets: demo.targets, rotation },
              )}
              <figcaption>{label}{rotation ? " · underneath" : ""}</figcaption>
            </figure>
          {/each}
        </div>
        <Algorithm moves={demo.algorithm} />
        <Button
          class="secondary"
          data-action="course-example"
          data-id={node.example}
          aria-expanded={example === node.example}
          aria-controls={"lesson-demo-" + node.example}
        >
          {example === node.example ? "Hide example" : "Show example"}
        </Button>
        <div id={"lesson-demo-" + node.example}>
          {#if example === node.example}<CubePlayer
              id={node.example}
              mode="lesson"
              setup={demo.setup}
              algorithm={demo.algorithm}
            />{/if}
        </div>
      </section>
    {/if}
  {/each}
{/snippet}

{@render renderNodes(nodes)}
