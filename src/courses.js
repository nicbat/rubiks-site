import definitions from "virtual:course-content";
import { methodGroups } from "./learning-methods.js";

import { twoByTwoLessons } from "./two-by-two.js";

export const courses = definitions.courses;
export const modules = definitions.modules;
export const courseExamples = definitions.examples;
export function moduleExampleIds(module) {
  const ids = [];
  const visit = (nodes) => {
    for (const node of nodes || []) {
      if (node.type === "cube") ids.push(node.example);
      visit(node.children);
      for (const item of node.items || []) visit(item);
    }
  };
  visit(module?.nodes);
  return ids;
}
export const courseById = (id) => courses.find((course) => course.id === id);
export const moduleById = (id) => modules.find((module) => module.id === id);
moduleById("ortega-reference").lessons = twoByTwoLessons;
export const reviewIds = modules.flatMap((module) =>
  ["guide", "lesson"].includes(module.kind)
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
  const ids = ["guide", "lesson"].includes(module.kind)
    ? [module.id]
    : module.lessons.map((l) => l.id);
  return {
    done: ids.filter((id) => progress.reviewed?.includes(id)).length,
    total: ids.length,
    unit: module.kind === "guide" ? "guide reviewed" : "lessons reviewed",
  };
}

export function courseSummary(course, progress, index, catalog, chooseVariant) {
  const parts = course.modules.map((id) =>
    moduleProgress(moduleById(id), progress, index, catalog, chooseVariant),
  );
  const done = parts.filter(
    (part) => part.total > 0 && part.done === part.total,
  ).length;
  const started =
    !!progress.resume?.[course.id] ||
    progress.activeCourse === course.id ||
    parts.some((part) => part.done > 0);
  return {
    done,
    total: parts.length,
    started,
    finished: !course.status && parts.length > 0 && done === parts.length,
  };
}
