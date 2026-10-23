import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { renderApp } from "../scripts/render-views.mjs";
import { emptyProgress } from "../src/progress.js";
import { commands } from "../src/commands.js";
import { createTestData } from "../src/test-data.js";
import { createProgressIndex } from "../src/progress-index.js";
import { accountOverview } from "../src/account-workspace.js";

function model() {
  const progress = emptyProgress();
  return {
    state: {
      view: "account",
      accountSection: "overview",
      progress,
      solves: [],
      preferences: {},
      dashboard: { range: "all", tab: "learning", cube: "all" },
      account: { configured: true, email: "", sync: { status: "idle" } },
      cubeCollection: { cubes: [], defaultId: null },
      timer: { status: "ready" },
    },
    catalog,
    byId: new Map(catalog.map((c) => [c.id, c])),
    variant: () => 0,
    selected: () => [],
  };
}
test("guest Account exposes progress and backup without an authentication gate", () => {
  const m = model();
  const overview = renderApp(m);
  assert.match(overview, /id="account-form"/);
  assert.match(overview, /href="#\/account\/progress"/);
  assert.match(overview, /Activity heatmap/);
  assert.match(overview, /Start your training/);
  for (const section of ["profile", "sync"]) {
    m.state.accountSection = section;
    const html = renderApp(m);
    assert.match(html, /href="#\/account"/);
    assert.doesNotMatch(html, /id="account-form"|id="profile-edit-form"/);
  }
  m.state.view = "progress";
  const progress = renderApp(m);
  assert.match(progress, /Your cases/);
  assert.doesNotMatch(progress, /id="account-form"/);
  assert.equal([...progress.matchAll(/<h1>/g)].length, 1);
});
test("Settings groups preferences and cross-links Account without mounting private forms", () => {
  const m = model();
  m.state.view = "home";
  m.state.settings = true;
  m.state.account = {
    ...m.state.account,
    email: "owner@example.test",
    profile: { username: "learner" },
  };
  const settings = renderApp(m).split('id="settings-dialog"')[1];
  const sections = [
    "Account",
    "Appearance",
    "Learning and display",
    "Timer",
    "Equipment",
    "Data and backups",
    "Preview tools",
  ];
  let previous = -1;
  for (const title of sections) {
    const index = settings.indexOf(`>${title}</h2>`);
    assert.ok(index > previous, `${title} retains the preference order`);
    previous = index;
  }
  assert.match(settings, /Open Account/);
  assert.match(settings, /data-action="backup"/);
  assert.doesNotMatch(
    settings,
    /account-form|username-form|profile-edit-form|account-delete-form|account-signout/,
  );
  assert.ok(
    commands.some(
      ([label, path]) => label === "Progress" && path === "account/progress",
    ),
  );
  assert.ok(
    commands.some(([label, path]) => label === "Account" && path === "account"),
  );
});
test("Account summaries use full sample history and the existing progress index", () => {
  const m = model();
  const data = createTestData(catalog, new Date("2026-10-17T19:00:00Z"));
  Object.assign(m.state, data);
  m.variant = (c) => data.progress.variants[c.id] || 0;
  m.progressIndex = createProgressIndex(data.progress);
  m.status = (c) => m.progressIndex.statusFor(c.id, m.variant(c));
  const expected = catalog.filter(
    (c) => m.status(c).label === "Confident",
  ).length;
  // Once indexed, rendering summaries must not scan attempt records again.
  data.progress.attempts = new Proxy(data.progress.attempts, {
    get(target, key, receiver) {
      if (key === Symbol.iterator) throw Error("Repeated attempt history scan");
      return Reflect.get(target, key, receiver);
    },
  });
  const summary = accountOverview(m, "2026-10-17");
  assert.equal(summary.activity.totals.solves, data.solves.length);
  assert.equal(summary.confident, expected);
  assert.equal(summary.cases.length, 78);
  assert.ok(summary.activity.totals.recognition > 0);
});
