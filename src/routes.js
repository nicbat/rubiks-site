import { username } from "./profiles.js";
import { courseById } from "./courses.js";

export function readRoute(address) {
  const [path, query] = address.replace(/^#?\/?/, "").split("?");
  const [page, section, scope] = path.split("/");
  const route = {
    view: "dashboard",
    activeModule: null,
    settings: page === "settings" || new URLSearchParams(query).has("settings"),
  };
  if (page === "account") {
    route.view = section === "progress" && !scope ? "progress" : "account";
    route.accountSection =
      section === "profile" && scope === "edit"
        ? "edit"
        : section === "profile" && !scope
          ? "profile"
          : "settings";
  }
  if (page === "u" && section && !scope) {
    try {
      route.username = username(section);
      route.view = "profile";
    } catch {
      /* Unknown routes return to the dashboard. */
    }
  }
  if (
    [
      "dashboard",
      "about",
      "home",
      "courses",
      "progress",
      "timer",
      "cubes",
      "pll-quiz",
      "practice",
      "people",
    ].includes(page)
  )
    route.view = page;
  if (page === "courses" && section) {
    route.view = "dashboard";
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
export function routePath({
  view,
  activeCourse,
  activeModule,
  section,
  method,
  guideSection,
  settings,
  username,
  accountSection,
}) {
  let path = view;

  if (view === "account")
    path =
      accountSection === "profile"
        ? "account/profile"
        : accountSection === "edit"
          ? "account/profile/edit"
          : "account";
  if (view === "profile") path = `u/${username}`;
  if (
    ["lesson", "guides", "library"].includes(view) &&
    activeModule &&
    activeCourse &&
    activeCourse !== "cfop"
  )
    return `/courses/${activeCourse}/${activeModule}${settings ? "?settings" : ""}`;
  if (["library", "guides"].includes(view))
    path = activeModule
      ? `cfop/${activeModule.replace(/^(full|two-look)-(oll|pll)$/, "$2/$1")}`
      : view === "library"
        ? `library/${section.toLowerCase()}/${method}`
        : `guides/${guideSection}`;
  return `/${path}${settings ? "?settings" : ""}`;
}

// Keep local preview/recovery modes when following links within the app.
export function routeWithContext(path, search) {
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query);
  const context = new URLSearchParams(search);
  for (const key of ["demo", "recover-origin"])
    if (context.has(key)) params.set(key, context.get(key));
  return (
    pathname +
    (params.size
      ? `?${params}`.replace(/([?&])settings=(?=&|$)/, "$1settings")
      : "")
  );
}

// SVG anchors expose target as SVGAnimatedString even without a target attribute.
// Read attributes so chart actions and HTML app links share primary-click rules.
export function shouldHandleLinkClick(event, link) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !link.getAttribute("target") &&
    !link.hasAttribute("download")
  );
}
