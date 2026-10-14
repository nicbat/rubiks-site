import guides from "../data/guides.json" with { type: "json" };
import { renderCubePlayer } from "./cube-player.js";
import { renderF2L } from "./f2l-view.js";
import { renderNotation } from "./notation-view.js";
import { applyAlg, solvedCube, tokens } from "./cube.js";
import { f2lDiagram } from "./f2l-diagram.js";
import { escape } from "./html.js";

export { guides };

export function renderGuides({
  section = "cross",
  embedded = false,
  example = null,
  notationMove = "R",
  notationSuffix = "",
} = {}) {
  const current = ["cross", "f2l", "notation"].includes(section)
    ? section
    : "cross";
  const navigation = embedded
    ? ""
    : `<div class="page-heading"><h1>Guides</h1></div><nav class="guide-sections" aria-label="Guide sections">${[
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
  return `${navigation}<div class="guide-page cross-guide"><header class="guide-intro"><h2>${escape(guide.title)}</h2><p>${escape(guide.intro)}</p></header>
    <aside class="cross-fact"><h3>Check another colour</h3><p>Compare white and yellow. Try more colours as you get comfortable. Choose a cross you can plan, with an easy first pair when possible.</p>Every cross has an <strong>8-move-or-fewer</strong> solution. Half turns count as one. <a href="https://www.cubezone.be/crossstudy.html" target="_blank" rel="noreferrer">The research</a></aside>
    <p class="guide-note">Hold white down, green front. Each picture shows the same cube from above and underneath. Coloured pieces are the ones to watch.</p>
    <section class="guide-examples" aria-label="Cross planning examples">${guide.examples.map((item) => renderCrossExample(item, example)).join("")}</section>
    <aside class="cross-practice"><h3>Try it without looking</h3><p>Plan your cross. Close your eyes. Execute it. Then repeat the scramble and look for a first pair.</p></aside>
    <p class="guide-sources">Keep learning: ${guide.sources.map(({ label, url }) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(label)}</a>`).join(" · ")}</p></div>`;
}

function renderCrossExample(item, example) {
  const open = item.id === example;
  let cube = applyAlg(solvedCube(), item.setup);
  const frames = [{ moves: "", text: item.start }, ...item.steps]
    .map((step) => {
      cube = applyAlg(cube, step.moves);
      return `<figure class="cross-frame"><div class="cross-move">${step.moves ? `<span aria-hidden="true">→ </span>${escape(step.moves)}` : "Start"}</div><div class="cross-views">${["", "z2"].map((rotation) => `<div>${f2lDiagram(cube, `${item.title}: ${step.text}, ${rotation ? "underneath" : "above"}`, { targets: item.pieces, rotation })}<small>${rotation ? "Underneath" : "Above"}</small></div>`).join("")}</div><figcaption>${escape(step.text)}</figcaption></figure>`;
    })
    .join("");
  return `<article class="guide-example" aria-label="${escape(item.title)}"><header><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></header><div class="cross-sequence">${frames}</div>
    ${item.comparison ? `<div class="cross-comparison"><span>${escape(item.comparison.label)}: <strong>${escape(item.comparison.algorithm)}</strong> · ${tokens(item.comparison.algorithm).length} moves</span><span>Align last: <strong>${escape(item.algorithm)}</strong> · ${tokens(item.algorithm).length} moves</span></div>` : ""}
    <div class="guide-example-actions"><button class="guide-cube-toggle" data-action="guide-example" data-id="${item.id}" aria-expanded="${open}" aria-controls="guide-demo-${item.id}" aria-label="${open ? "Hide" : "Show"} 3D example: ${escape(item.title)}">${open ? "Hide" : "Show"} 3D example</button><details><summary>Setup moves</summary><p class="guide-algorithm">${escape(item.setup)}</p></details></div><div id="guide-demo-${item.id}">${open ? renderCubePlayer({ id: `guide-${item.id}`, mode: "lesson", setup: item.setup, algorithm: item.algorithm }) : ""}</div></article>`;
}
