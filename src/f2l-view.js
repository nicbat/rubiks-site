import { f2lCases, f2lSetup } from "./f2l.js";
import { applyAlg, solvedCube } from "./cube.js";
import { f2lDiagram } from "./f2l-diagram.js";
import { renderCubePlayer } from "./cube-player.js";
import { escape } from "./html.js";

export function renderF2L({ example = null } = {}) {
  const groups = [...new Set(f2lCases.map((item) => item.group))];
  return `<section class="f2l-reference"><h2>F2L · 41 cases</h2><p class="guide-note">White down, green front. Match the highlighted corner and edge; gray pieces do not matter. Solve into the front-right slot.</p>
  <details class="f2l-help"><summary>How to use these cases</summary><p>Use U turns to match the diagram. Read rotations from left to right. Case numbers follow the CubeSkills sheet. Open a cube to step through the solution; only one player is loaded at a time.</p></details>
  <nav class="f2l-index" aria-label="F2L case groups">${groups.map((group, index) => `<a href="#f2l-group-${index}">${escape(group)}</a>`).join("")}</nav>
  ${groups
    .map(
      (group, index) =>
        `<section id="f2l-group-${index}" class="f2l-group"><h3>${escape(group)}</h3><div class="f2l-grid">${f2lCases
          .filter((item) => item.group === group)
          .map((item) => {
            const setup = f2lSetup(item.algorithm),
              open = example === item.id;
            return `<article class="f2l-card"><button class="f2l-case-open" data-action="guide-example" data-id="${escape(item.id)}" aria-label="${open ? "Hide" : "Show"} 3D F2L case ${item.sourceOrder}" aria-expanded="${open}" aria-controls="f2l-preview-${index}">${f2lDiagram(applyAlg(solvedCube(), setup), `F2L case ${item.sourceOrder}`)}<span>Case ${item.sourceOrder}<small>${open ? "Hide" : "Show"} 3D</small></span></button><p class="f2l-algorithm">${escape(item.algorithm)}</p></article>`;
          })
          .join("")}</div>${f2lPreview(group, index, example)}</section>`,
    )
    .join(
      "",
    )}<p class="guide-sources">Algorithms: <a href="https://www.cubeskills.com/uploads/pdf/tutorials/f2l.pdf" target="_blank" rel="noreferrer">CubeSkills · Feliks Zemdegs and Andy Klise</a>. Diagrams generated locally.</p></section>`;
}

function f2lPreview(group, index, example) {
  const item = f2lCases.find(
    (item) => item.group === group && item.id === example,
  );
  return `<div id="f2l-preview-${index}">${item ? `<section class="f2l-preview" aria-label="F2L case ${item.sourceOrder} preview"><h4>Case ${item.sourceOrder}</h4><p class="f2l-algorithm">${escape(item.algorithm)}</p>${renderCubePlayer({ id: item.id, mode: "lesson", setup: f2lSetup(item.algorithm), algorithm: item.algorithm })}</section>` : ""}</div>`;
}
