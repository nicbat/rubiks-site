import { username } from "./profiles.js";
export function readRoute(hash) {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [page, section, scope] = path.split("/");
  const route = {
    view: "home",
    activeModule: null,
    settings: page === "settings" || new URLSearchParams(query).has("settings"),
  };
  if (page === "account") {
    route.view = section === "progress" && !scope ? "progress" : "account";
    route.accountSection =
      !scope && ["profile", "sync"].includes(section) ? section : "overview";
  }
  if (page === "u" && section && !scope) {
    try {
      route.username = username(section);
      route.view = "profile";
    } catch {
      /* Unknown routes return home. */
    }
  }
  if (
    [
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
  activeModule,
  section,
  method,
  guideSection,
  settings,
  username,
  accountSection,
}) {
  let path = view;
  if (view === "progress") path = "account/progress";
  if (view === "account")
    path = ["profile", "sync"].includes(accountSection)
      ? `account/${accountSection}`
      : "account";
  if (view === "profile") path = `u/${username}`;
  if (["library", "guides"].includes(view))
    path = activeModule
      ? `cfop/${activeModule.replace(/^(full|two-look)-(oll|pll)$/, "$2/$1")}`
      : view === "library"
        ? `library/${section.toLowerCase()}/${method}`
        : `guides/${guideSection}`;
  return `#/${path}${settings ? "?settings" : ""}`;
}
