import {
  twoByTwoLessons,
  twoByTwoAlgorithms,
  twoByTwoSetup,
} from "./two-by-two.js";
import { escape } from "./html.js";

export function renderTwoByTwo(progress, chunks) {
  return `<div class="page-heading"><div><h1>2×2 Ortega reference</h1><p>One face → opposite face → both layers.</p></div></div><p class="bld-intro">Reference only. Use your own 2×2; interactive practice will follow. <a href="https://jperm.net/2x2/faster" target="_blank" rel="noreferrer">J Perm’s Ortega tutorial</a></p><div class="bld-lessons">${twoByTwoLessons
    .map((lesson, i) => {
      const stage = i === 1 ? "OLL" : i === 2 ? "PBL" : null;
      const reviewed = progress.reviewed?.includes(lesson.id);
      return `<article class="bld-lesson" aria-labelledby="${lesson.id}"><h2 id="${lesson.id}">${i + 1}. ${escape(lesson.title)}</h2><p>${escape(lesson.text)}</p><p class="lesson-exercise"><strong>Try it</strong> ${escape(lesson.exercise)}</p>${
        stage
          ? `<p><a href="https://jperm.net/algs/2x2${stage.toLowerCase()}" target="_blank" rel="noreferrer">${stage} algorithms and recognition diagrams · J Perm</a></p>${twoByTwoAlgorithms
              .filter((a) => a.stage === stage)
              .map(
                (a) =>
                  `<section class="bld-algorithm" aria-label="${escape(a.name)}"><h3>${escape(a.name)}</h3>${chunks(a.moves)}<details class="setup-disclosure"><summary>Build ${escape(a.name)} example</summary><p>Start solved, any color up. Apply the setup, keep your grip, then do the algorithm.</p><p class="plain-moves">${escape(twoByTwoSetup(a))}</p></details></section>`,
              )
              .join("")}`
          : ""
      }<button class="${reviewed ? "secondary" : "primary"}" data-action="review-lesson" data-id="${lesson.id}" aria-pressed="${!!reviewed}">${reviewed ? "Reviewed" : "Mark reviewed"}</button></article>`;
    })
    .join("")}</div>`;
}
