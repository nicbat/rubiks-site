<script>
  import DialogContent from "../lib/components/ui/dialog/dialog-content.svelte";
  import Algorithm from "./Algorithm.svelte";
  import { displayColors } from "../display-colors.js";
  import { partialCases, twoLookCases } from "../learning-methods.js";
  import { icon } from "../icons.js";
  import { isKnown } from "../progress.js";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import SelectControl from "./SelectControl.svelte";
  import CubePlayer from "./CubePlayer.svelte";
  let { model } = $props();
</script>

{#snippet content(model)}
  {@const {
    state,
    byId,
    variant,
    progressIndex,
    status,
    stages,
    caseDiagram,
    badge,
    aliasMarkup,
  } = model}
  {@const { progress, detail } = state}
  {#snippet sharing(c)}
    {#if twoLookCases.includes(c.id)}<div class="progress-sharing">
        <p>
          Known marks apply to this algorithm in both two-look and full CFOP.
        </p>
        <p>
          {partialCases.includes(c.id)
            ? "Recognition practice tracks the two patterns separately."
            : "Recognition progress is shared too."}
        </p>
      </div>{/if}
  {/snippet}

  {@const c = byId.get(detail)}
  {#if c}{@const s = status(c)}
    <DialogContent id="detail-dialog" aria-labelledby="case-title"
      ><div class="dialog-heading">
        <span>{c.section} / {c.group}</span>
        <div class="dialog-heading-actions">
          <Button
            class="icon-button"
            data-action="close-dialog"
            aria-label="Close case">{@html icon("close")}</Button
          >
        </div>
      </div>
      <div class="case-layout">
        <div class="case-information">
          <div class="detail-intro">
            {@render caseDiagram(c)}
            <div>
              <h1 id="case-title">{c.name}</h1>
              {@render aliasMarkup(c)}{@render badge(c)}
              <p>{Math.min(s.days, 3)} of 3 confident recognition days</p>
            </div>
          </div>
          <Label class="variant-label" for="variant">Your algorithm</Label
          ><small class="variant-saved muted"
            >Your choice is saved on this device.</small
          ><SelectControl
            id={"variant"}
            label={"Your algorithm"}
            value={variant(c)}
            options={c.algorithms.map((a, i) => ({
              value: i,
              label: `${a.label} — ${a.moves}`,
            }))}
          /><Algorithm moves={c.algorithms[variant(c)].moves} />
          <p class="muted">
            {displayColors[state.displayTop]} on top; the diagram’s front is at the
            bottom.
          </p>
          <Button class="text-button" data-action="display-color"
            >Change color</Button
          >
          <div class="case-setup">
            <Button
              class="text-button"
              data-action="detail-setup"
              aria-expanded={!!state.detailSetupVisible}
              aria-controls="case-setup-content"
              >{state.detailSetupVisible ? "Hide" : "Show"} setup moves</Button
            >
            <div
              id="case-setup-content"
              {...state.detailSetupVisible ? {} : { hidden: true }}
            >
              <p class="muted">
                Start solved, with yellow on top and green in front.
              </p>
              <p class="case-setup-moves" aria-label="Case setup moves">
                {c.setups[0]}
              </p>
              <p class="muted">
                Then use U turns or rotate the cube to match the diagram.{c.section ===
                "OLL"
                  ? " After OLL, you may still need PLL."
                  : ""}
              </p>
            </div>
          </div>
          <div class="detail-help">
            <strong
              >{stages.get(c.id)?.description
                ? stages.get(c.id).name
                : c.section === "OLL"
                  ? "Top-color pattern"
                  : "Side stickers"}</strong
            >
            <p>
              {stages.get(c.id)?.description ||
                (c.section === "OLL"
                  ? "Match the top-color stickers on top and around the edges."
                  : "Check side colors for matching pairs, solid rows, and pieces to move.")}
            </p>
          </div>
          {@render sharing(c)}
          <div class="dialog-actions">
            <Button
              class={progressIndex.isSelected(c.id) ? "primary" : "secondary"}
              data-action="toggle"
              data-id={c.id}
              aria-pressed={progressIndex.isSelected(c.id)}
              >{@html icon(
                progressIndex.isSelected(c.id) ? "check" : "plus",
              )}Learning set</Button
            ><Button class="secondary" data-action="rehearse" data-id={c.id}
              >Rehearse</Button
            ><Button
              class={isKnown(progress, c.id, variant(c), state.method)
                ? "primary"
                : "secondary"}
              data-action="known"
              data-id={c.id}
              aria-pressed={isKnown(progress, c.id, variant(c), state.method)}
              >{@html icon(
                isKnown(progress, c.id, variant(c), state.method)
                  ? "check"
                  : "plus",
              )}Known</Button
            >
          </div>
          <a
            class="source-link"
            href={stages.get(c.id)?.source || c.source}
            target="_blank"
            rel="noreferrer">Algorithm source: J Perm</a
          >
        </div>
        <aside class="case-player-panel" aria-label="Algorithm preview">
          <CubePlayer
            {...{
              id: c.id,
              mode: "algorithm",
              top: state.displayTop,
              algorithm: c.algorithms[variant(c)].moves,
            }}
          />
        </aside>
      </div></DialogContent
    >{/if}
{/snippet}
{@render content(model)}
