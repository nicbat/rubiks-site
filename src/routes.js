import { courseById } from "./courses.js";

export function readRoute(hash) {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [page, section, scope] = path.split("/");
  const route = {
    view: "home",
    activeModule: null,
    settings: page === "settings" || new URLSearchParams(query).has("settings"),
  };
  if (
    [
      "home",
      "courses",
      "progress",
      "timer",
      "cubes",
      "pll-quiz",
      "practice",
    ].includes(page)
  )
    route.view = page;
  if (page === "courses" && section) {
    route.view = "home";
    const course = courseById(section);
    if (course && !course.status && course.modules.includes(scope)) {
      route.view = "lesson";
      route.activeCourse = course.id;
      route.activeModule = scope;
    }
  }
  if (["cfop", "library"].includes(page) && ["oll", "pll"].includes(section)) {
    route.view = "library";
    route.section = section.toUpperCase();
    route.method = scope === "two-look" ? scope : "full";
    if (page === "cfop") route.activeModule = `${route.method}-${section}`;
  }
  if (
    ["cfop", "guides"].includes(page) &&
    ["cross", "f2l", ...(page === "guides" ? ["notation"] : [])].includes(
      section,
    )
  ) {
    route.view = "guides";
    route.guideSection = section;
    if (page === "cfop") route.activeModule = section;
  }
  return route;
}
export function routeHash({
  view,
  activeCourse,
  activeModule,
  section,
  method,
  guideSection,
  settings,
}) {
  let path = view;
  if (
    ["lesson", "guides", "library"].includes(view) &&
    activeModule &&
    activeCourse &&
    activeCourse !== "cfop"
  )
    return `#/courses/${activeCourse}/${activeModule}${settings ? "?settings" : ""}`;
  if (["library", "guides"].includes(view))
    path = activeModule
      ? `cfop/${activeModule.replace(/^(full|two-look)-(oll|pll)$/, "$2/$1")}`
      : view === "library"
        ? `library/${section.toLowerCase()}/${method}`
        : `guides/${guideSection}`;
  return `#/${path}${settings ? "?settings" : ""}`;
}
