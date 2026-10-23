import { test } from "node:test";
import assert from "node:assert/strict";
import { readRoute, routeHash } from "../src/routes.js";

test("static-host routes round-trip pages, CFOP scopes, guides and settings", () => {
  for (const hash of [
    "#/home",
    "#/courses",
    "#/timer",
    "#/account",
    "#/account/progress",
    "#/account/profile",
    "#/account/sync",
    "#/account/progress?settings",
    "#/account/profile?settings",
    "#/cubes",
    "#/pll-quiz",
    "#/practice",
    "#/people",
    "#/u/learner_123",
    "#/u/learner?settings",
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
    "#/u/admin",
    "#/u/ab",
    "#/u/learner/extra",
    "#/u/<script>",
  ]) {
    assert.equal(readRoute(hash).view, "home");
  }
  assert.equal(readRoute("#/settings").settings, true);
  assert.equal(readRoute("#/cfop/oll/bogus").activeModule, "full-oll");
  assert.equal(readRoute("#/library/pll/bogus").method, "full");
});
test("profile routes canonicalize username case", () => {
  assert.equal(routeHash(readRoute("#/u/NicBat")), "#/u/nicbat");
});

test("legacy Progress links preserve the detailed dashboard and Settings overlay", () => {
  assert.equal(readRoute("#/progress").view, "progress");
  assert.equal(routeHash(readRoute("#/progress")), "#/account/progress");
  assert.equal(
    routeHash(readRoute("#/progress?settings")),
    "#/account/progress?settings",
  );
  for (const path of [
    "#/account/unknown",
    "#/account/profile/extra",
    "#/account/owner/progress",
  ])
    assert.equal(routeHash(readRoute(path)), "#/account");
});
