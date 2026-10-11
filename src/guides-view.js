import guides from "../data/guides.json" with { type: "json" };
import { renderCubePlayer } from "./cube-player.js";
import { renderF2L } from "./f2l-view.js";
import { renderNotation } from "./notation-view.js";
import { escape } from "./html.js";

export { guides };

export function renderGuides({
  section = "cross",
  example = null,
  notationMove = "R",
  notationSuffix = "",
} = {}) {
  const current = ["cross", "f2l", "notation"].includes(section)
    ? section
    : "cross";
  const navigation = `<div class="page-heading"><h1>Guides</h1></div><nav class="guide-sections" aria-label="Guide sections">${[
    ["cross", "Cross"],
    ["f2l", "F2L"],
    ["notation", "Notation"],
  ]
    .map(
      ([id, label]) =>
        `<button data-action="guide-section" data-id="${id}" aria-pressed="${current === id}">${label}</button>`,
    )
    .join("")}</nav>`;
  if (current === "notation") {
    return `${navigation}<div class="guide-notation"><button class="guide-cube-toggle" data-action="guide-example" data-id="notation" aria-expanded="${example === "notation"}">${example === "notation" ? "Hide" : "Show"} 3D notation cube</button>${renderNotation(notationMove, notationSuffix, { showCube: example === "notation" })}</div>`;
  }
  if (current === "f2l") return `${navigation}${renderF2L({ example })}`;
  const guide = guides.cross;
  return `${navigation}<div class="guide-page"><header class="guide-intro"><h2>${escape(guide.title)}</h2><p>${escape(guide.intro)}</p></header>
    <section class="guide-examples"><p class="guide-note">White down · green front. Apply setup moves to a solved cube to follow along.</p>
    ${guide.examples
      .map((item) => {
        const open = item.id === example;
        return `<article class="guide-example"><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p><div class="guide-example-actions"><button class="guide-cube-toggle" data-action="guide-example" data-id="${item.id}" aria-expanded="${open}" aria-controls="guide-demo-${item.id}" aria-label="${open ? "Hide" : "Show"} 3D example: ${escape(item.title)}">${open ? "Hide" : "Show"} 3D example</button><details><summary>Setup moves</summary><p class="guide-algorithm">${escape(item.setup)}</p></details></div><details class="guide-explanation"><summary>Why it works</summary><ol class="guide-steps">${item.steps.map((step) => `<li><strong>${escape(step.moves)}</strong><span>${escape(step.text)}</span></li>`).join("")}</ol></details><div id="guide-demo-${item.id}">${open ? renderCubePlayer({ id: `guide-${item.id}`, mode: "lesson", setup: item.setup, algorithm: item.algorithm }) : ""}</div></article>`;
      })
      .join("")}</section>
    <details class="guide-tips"><summary>Cross tips</summary><ul><li>Match both edge colors, not just white.</li><li>Keep white down and plan the next edge before turning.</li><li>Restore any solved edge you move temporarily.</li></ul></details><p class="guide-sources">Keep learning: ${guide.sources.map(({ label, url }) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(label)}</a>`).join(" · ")}</p></div>`;
}
