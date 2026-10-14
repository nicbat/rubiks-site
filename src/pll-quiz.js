import { caseCube, applyAlg, colorAt, normals } from "./cube.js";
import { displayCube } from "./display-colors.js";
import { randomIndex } from "./practice.js";

export function createPllQuestion(catalog, pick = randomIndex) {
  const cases = catalog.filter((c) => c.section === "PLL");
  const c = cases[pick(cases.length)];
  const auf = pick(4),
    angle = pick(4);
  const others = cases
    .filter((item) => item.id !== c.id)
    .map((item) => item.id);
  const choices = [c.id];
  while (choices.length < 4)
    choices.push(others.splice(pick(others.length), 1)[0]);
  for (let i = choices.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return {
    choices,
    caseId: c.id,
    moves: c.algorithms[0].moves,
    auf,
    angle,
    answer: null,
  };
}
export function pllQuestionCube(question, top = "U") {
  return displayCube(
    applyAlg(
      caseCube(question.moves),
      `${["", "U", "U2", "U'"][question.auf]} ${["", "y", "y2", "y'"][question.angle]}`,
    ),
    top,
  );
}
export function twoSideStickers(cube) {
  return [
    ...[-1, 0, 1].map((x) => colorAt(cube, [x, 1, 1], normals.F)),
    ...[1, 0, -1].map((z) => colorAt(cube, [1, 1, z], normals.R)),
  ];
}
