import { test } from "node:test";
import assert from "node:assert/strict";
import { readRoute, routeHash } from "../src/routes.js";

test("static-host routes round-trip pages, CFOP scopes, guides and settings", () => {
  for (const hash of [
    "#/home",
    "#/courses",
    "#/courses/beginner/beginner-white-cross",
    "#/courses/beginner/beginner-orient-corners?settings",
    "#/timer",
    "#/progress",
    "#/cubes",
    "#/pll-quiz",
    "#/practice",
    "#/cfop/cross",
    "#/cfop/f2l",
    "#/cfop/oll/full",
    "#/cfop/pll/two-look",
    "#/library/oll/two-look",
    "#/guides/notation",
    "#/timer?settings",
    "#/cfop/oll/two-look?settings",
  ]) {
    assert.equal(routeHash(readRoute(hash)), hash);
  }
});
test("unknown or malformed routes use safe known destinations", () => {
  for (const hash of [
    "",
    "#",
    "#/bogus",
    "#/cfop/bogus",
    "#/%E0%A4%A",
    "#/library/<script>",
    "#/courses/beginner/does-not-exist",
    "#/courses/ortega/ortega-reference",
    "#/courses/beginner/full-pll",
  ]) {
    assert.equal(readRoute(hash).view, "home");
  }
  assert.equal(readRoute("#/settings").settings, true);
  assert.equal(readRoute("#/cfop/oll/bogus").activeModule, "full-oll");
  assert.equal(readRoute("#/library/pll/bogus").method, "full");
});
test("leaving a lesson produces the destination hash even with retained course context", () => {
  for (const view of ["home", "progress", "timer", "courses", "practice"])
    assert.equal(
      routeHash({
        view,
        activeCourse: "beginner",
        activeModule: "beginner-white-cross",
      }),
      `#/${view}`,
    );
});
