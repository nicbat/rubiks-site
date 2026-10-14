import { caseDiagram } from "./case-diagram.js";
import { pllQuestionCube, twoSideStickers } from "./pll-quiz.js";
import { centers } from "./cube.js";
import { palette } from "./diagram.js";
import { displayColors } from "./display-colors.js";
import { escape } from "./html.js";

export function renderPllQuiz(quiz, catalog, top, method = "full") {
  const q = quiz.question,
    cube = pllQuestionCube(q, top),
    colors = twoSideStickers(cube),
    center = centers(cube);
  const face = (offset, name, color) =>
    `<div class="quiz-face"><div class="quiz-stickers">${colors
      .slice(offset, offset + 3)
      .map(
        (c) =>
          `<span style="background:${palette[c]}" aria-label="${displayColors[c]} sticker"></span>`,
      )
      .join(
        "",
      )}</div><span class="quiz-center" style="background:${palette[color]}" aria-label="${displayColors[color]} center"></span><small>${name}</small></div>`;
  const answer = catalog.find((c) => c.id === q.caseId);
  return `<div class="page-heading"><div><h1>Two-sided PLL recognition</h1><p>Match two adjacent sides to a case diagram.</p></div><button class="text-button" data-action="open-module" data-course="cfop" data-id="${method}-pll">Back to PLL</button></div><section class="pll-quiz"><p>${quiz.correct} / ${quiz.total} correct this session · ${displayColors[top]} on top</p><div class="two-side-view" role="img" aria-label="Two adjacent sides: front on the left, right on the right">${face(0, "Front", center.F)}${face(3, "Right", center.R)}</div><p class="muted">Look for matching corners, bars, and opposite colors. Centers show the side colors.</p><button class="text-button" data-action="display-color">Change color</button><div class="quiz-choices" role="group" aria-label="PLL case diagrams">${q.choices
    .map((id) => catalog.find((c) => c.id === id))
    .map(
      (c) =>
        `<button class="secondary" data-action="pll-answer" data-id="${c.id}" aria-label="${escape(c.name)}" ${q.answer ? "disabled" : ""}>${caseDiagram(c.algorithms[0].moves, "PLL", "Case pattern", { top, arrows: true, neutralSides: true })}<small>${escape(c.name)}</small></button>`,
    )
    .join(
      "",
    )}</div>${q.answer ? `<div class="quiz-result" role="status"><h2>${q.answer === q.caseId ? "Correct" : "Keep practicing"} · ${escape(answer.name)}</h2>${caseDiagram(answer.algorithms[0].moves, "PLL", "Correct case pattern", { top, arrows: true, neutralSides: true })}<button class="primary" data-action="pll-next">Next case</button></div>` : ""}<p class="source-note">Quiz scores do not change algorithm mastery. <a href="https://sarah.cubing.net/3x3x3/pll-recognition-guide" target="_blank" rel="noreferrer">Recognition guide by Sarah Strong</a></p></section>`;
}
