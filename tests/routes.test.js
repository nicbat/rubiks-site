import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readRoute,
  routePath,
  routeWithContext,
  shouldHandleLinkClick,
} from "../src/routes.js";

test("static-host routes round-trip pages, CFOP scopes, guides and settings", () => {
  for (const hash of [
    "/dashboard",
    "/about",
    "/home",
    "/courses",
    "/courses/beginner/beginner-white-cross",
    "/courses/beginner/beginner-orient-corners?settings",
    "/timer",
    "/account",
    "/progress",
    "/account/profile",
    "/account/profile/edit",
    "/progress?settings",
    "/account/profile?settings",
    "/cubes",
    "/pll-quiz",
    "/practice",
    "/people",
    "/u/learner_123",
    "/u/learner?settings",
    "/cfop/cross",
    "/cfop/f2l",
    "/cfop/oll/full",
    "/cfop/pll/two-look",
    "/library/oll/two-look",
    "/guides/notation",
    "/timer?settings",
    "/cfop/oll/two-look?settings",
  ]) {
    assert.equal(routePath(readRoute(hash)), hash);
  }
});
test("unknown or malformed routes use safe known destinations", () => {
  for (const hash of [
    "",
    "#",
    "/bogus",
    "/cfop/bogus",
    "/%E0%A4%A",
    "/library/<script>",
    "/u/admin",
    "/u/ab",
    "/u/learner/extra",
    "/u/<script>",
    "/courses/beginner/does-not-exist",
    "/courses/ortega/ortega-reference",
    "/courses/beginner/full-pll",
  ]) {
    assert.equal(readRoute(hash).view, "dashboard");
  }
  assert.equal(readRoute("/settings").settings, true);
  assert.equal(readRoute("/cfop/oll/bogus").activeModule, "full-oll");
  assert.equal(readRoute("/library/pll/bogus").method, "full");
});
test("profile routes canonicalize username case", () => {
  assert.equal(routePath(readRoute("/u/NicBat")), "/u/nicbat");
});

test("legacy Progress links preserve the detailed dashboard and Settings overlay", () => {
  assert.equal(readRoute("/progress").view, "progress");
  assert.equal(routePath(readRoute("/account/progress")), "/progress");
  assert.equal(
    routePath(readRoute("/progress?settings")),
    "/progress?settings",
  );
  for (const path of [
    "/account/unknown",
    "/account/profile/extra",
    "/account/sync",
    "/account/owner/progress",
  ])
    assert.equal(routePath(readRoute(path)), "/account");
});

test("leaving a lesson produces the destination hash even with retained course context", () => {
  for (const view of ["home", "progress", "timer", "courses", "practice"])
    assert.equal(
      routePath({
        view,
        activeCourse: "beginner",
        activeModule: "beginner-white-cross",
      }),
      `/${view}`,
    );
});

test("account and public profile links remain available with retained beginner lesson context", () => {
  const context = {
    activeCourse: "beginner",
    activeModule: "beginner-white-cross",
  };
  for (const [destination, expected] of [
    [{ view: "account", accountSection: "settings" }, "/account"],
    [{ view: "account", accountSection: "profile" }, "/account/profile"],
    [
      { view: "account", accountSection: "edit", settings: true },
      "/account/profile/edit?settings",
    ],
    [{ view: "profile", username: "learner" }, "/u/learner"],
  ]) {
    assert.equal(routePath({ ...context, ...destination }), expected);
    assert.equal(readRoute(expected).view, destination.view);
  }
});

test("legacy hash links canonicalize to clean URLs without changing their destination", () => {
  for (const path of [
    "/timer",
    "/u/learner",
    "/cfop/pll/two-look?settings",
    "/account/profile/edit",
  ])
    assert.equal(routePath(readRoute(`#${path}`)), path);
});

test("navigation retains recovery/demo context without retaining overlay or unrelated query values", () => {
  assert.equal(
    routeWithContext("/timer", "?demo=1&settings&unrelated=secret"),
    "/timer?demo=1",
  );
  assert.equal(
    routeWithContext("/u/learner?settings", "?recover-origin=1"),
    "/u/learner?settings&recover-origin=1",
  );
});

test("SVG chart actions use target attributes and retain native modified/download clicks", () => {
  const svgLink = {
    target: { baseVal: "", animVal: "" },
    getAttribute: () => null,
    hasAttribute: () => false,
  };
  assert.equal(shouldHandleLinkClick({ button: 0 }, svgLink), true);
  for (const event of [
    { button: 1 },
    { button: 2 },
    ...["ctrlKey", "metaKey", "altKey", "shiftKey"].map((key) => ({
      button: 0,
      [key]: true,
    })),
  ])
    assert.equal(shouldHandleLinkClick(event, svgLink), false);
  assert.equal(
    shouldHandleLinkClick(
      { button: 0 },
      { ...svgLink, getAttribute: () => "_blank" },
    ),
    false,
  );
  assert.equal(
    shouldHandleLinkClick(
      { button: 0 },
      { ...svgLink, hasAttribute: () => true },
    ),
    false,
  );
});
