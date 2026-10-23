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
test("Progress stays in main navigation and guests can open their profile without an Overview", () => {
  const m = model();
  m.state.accountSection = "profile";
  const html = renderApp(m);
  assert.match(html, /id="account-form"/);
  assert.match(
    html,
    /class="icon-button header-account"[^>]*href="#\/account\/profile"/,
  );
  assert.doesNotMatch(html, /Account sections|Activity heatmap|Overview/);
  m.state.view = "progress";
  const progress = renderApp(m);
  assert.match(progress, /Your cases/);
  assert.match(progress, /Activity heatmap/);
  assert.doesNotMatch(progress, /id="account-form"/);
  assert.equal([...progress.matchAll(/<h1>/g)].length, 1);
});
test("My profile shows saved content and editing is a separate destination", () => {
  const m = model();
  m.state.accountSection = "profile";
  m.state.account = {
    ...m.state.account,
    email: "owner@example.test",
    profile: {
      username: "learner",
      display_name: "Saved name",
      is_public: false,
    },
    profileDraft: { display_name: "Unsaved name" },
  };
  m.state.profilePage = { status: "ready", profile: m.state.account.profile };
  const html = renderApp(m);
  assert.match(html, /Saved name/);
  assert.match(html, /href="#\/account\/profile\/edit"/);
  assert.doesNotMatch(
    html,
    /profile-edit-form|Unsaved name|profile-lookup-form/,
  );
  m.state.accountSection = "edit";
  const edit = renderApp(m);
  assert.match(edit, /profile-edit-form/);
  assert.match(edit, /Unsaved name/);
  assert.match(edit, /<details[^>]+aria-label="Visitor preview"/);
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
    "Data & backups",
    "Preview tools",
  ];
  let previous = -1;
  for (const title of sections) {
    const index = settings.indexOf(`>${title.replaceAll("&", "&amp;")}</h2>`);
    assert.ok(index > previous, `${title} retains the preference order`);
    previous = index;
  }
  assert.match(settings, /Account settings/);
  assert.match(settings, /data-action="backup"/);
  assert.doesNotMatch(
    settings,
    /account-form|username-form|profile-edit-form|account-delete-form|account-signout/,
  );
  assert.ok(
    commands.some(
      ([label, path]) => label === "Progress" && path === "progress",
    ),
  );
  assert.ok(
    commands.some(
      ([label, path]) => label === "Account settings" && path === "account",
    ),
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
