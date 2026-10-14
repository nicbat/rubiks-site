import definitions from "../data/courses.json" with { type: "json" };
import { methodGroups } from "./learning-methods.js";

import { twoByTwoLessons } from "./two-by-two.js";

export const courses = definitions.courses;
export const modules = definitions.modules;
export const courseById = (id) => courses.find((course) => course.id === id);
export const moduleById = (id) => modules.find((module) => module.id === id);
moduleById("ortega-reference").lessons = twoByTwoLessons;
export const reviewIds = modules.flatMap((module) =>
  module.kind === "guide"
    ? [module.id]
    : (module.lessons || []).map((l) => l.id),
);
export function moduleCases(module, catalog) {
  return module?.kind === "algorithms"
    ? methodGroups(catalog, module.section, module.method).flatMap(
        (g) => g.cases,
      )
    : [];
}

export function moduleProgress(
  module,
  progress,
  index,
  catalog,
  chooseVariant,
) {
  if (module.kind === "algorithms") {
    const cases = moduleCases(module, catalog);
    return {
      done: cases.filter((c) =>
        ["Already known", "Confident"].includes(
          index.statusFor(c.id, chooseVariant(c, module.method), module.method)
            .label,
        ),
      ).length,
      total: cases.length,
      unit: "cases learned",
    };
  }
  const ids =
    module.kind === "guide" ? [module.id] : module.lessons.map((l) => l.id);
  return {
    done: ids.filter((id) => progress.reviewed?.includes(id)).length,
    total: ids.length,
    unit: module.kind === "guide" ? "guide reviewed" : "lessons reviewed",
  };
}
