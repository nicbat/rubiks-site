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
test("Profile is the single guest training destination without a header account shortcut or workspace tabs", () => {
  const m = model();
  m.state.view = "progress";
  const html = renderApp(m);
  assert.match(html, /<h1[^>]*>Profile<\/h1>/);
  assert.match(html, /Your cases/);
  assert.match(html, /Activity heatmap/);
  assert.match(html, /id="account-form"/);
  assert.match(html, /Sign in to sync across devices/);
  assert.match(html, /id="find-learner"/);
  assert.doesNotMatch(
    html,
    /header-account|Your workspace|workspace-tabs|PersonalNavigation/,
  );
  assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1);
});
test("the unified Profile shows saved identity and one private summary, retains draft editing, and ignores remote owner aggregates", () => {
  const m = model();
  m.state.view = "progress";
  m.state.account = {
    ...m.state.account,
    email: "private@example.test",
    profile: {
      username: "learner",
      display_name: "Saved name",
      bio: "Saved bio",
      learning_goal: "Full PLL",
      is_public: false,
      avatar_id: "ocean",
    },
    profileDraft: { display_name: "Unsaved name" },
  };
  m.state.profilePage = {
    status: "ready",
    profile: { username: "learner", stats: { solve_count: 999999 } },
  };
  const html = renderApp(m);
  assert.match(html, /Saved name/);
  assert.match(html, /Saved bio/);
  assert.match(html, /Full PLL/);
  assert.match(html, /src="\/pfps\/ocean.svg"/);
  assert.match(html, /href="\/account\/profile\/edit"/);
  assert.match(html, /href="\/people"[^>]*>Find a learner/);
  assert.match(html, /href="\/settings"[^>]*>Settings/);
  assert.match(html, /Copy profile link/);
  assert.match(html, /data-action="account-visibility"/);
  assert.match(html, /Statistics private/);
  for (const label of ["Activity summary", "Timer summary"])
    assert.equal(
      (html.match(new RegExp(`aria-label="${label}"`, "g")) || []).length,
      1,
    );
  assert.doesNotMatch(
    html,
    /profile-edit-form|Unsaved name|profile-lookup-form|private@example.test|999999|All-time progress/,
  );
  m.state.view = "account";
  m.state.accountSection = "edit";
  const edit = renderApp(m);
  assert.match(edit, /profile-edit-form/);
  assert.match(edit, /Unsaved name/);
  assert.match(edit, /<details[^>]+aria-label="Visitor preview"/);
});
test("the all-time personal summary agrees with the demo public summary from the same training", async () => {
  const { profileSummary } = await import("../src/profile-summary.js");
  const m = model();
  const data = createTestData(catalog, new Date("2026-10-17T19:00:00Z"));
  Object.assign(m.state, data, {
    view: "progress",
    dashboard: { range: "all", cube: "all" },
  });
  m.variant = (c) => data.progress.variants[c.id] ?? c.preferredVariant;
  const expected = profileSummary(data, catalog);
  assert.equal(expected.solve_count, data.solves.length);
  const html = renderApp(m);
  for (const [label, count] of [
    ["Solves", expected.solve_count],
    ["Practice attempts", expected.practice_count],
    ["Active days", expected.active_days],
  ])
    assert.match(
      html,
      new RegExp(`<strong>${count}</strong><span>${label}</span>`),
    );
  assert.match(html, /All time · All cubes/);
  // Selecting a day changes practice and solves together; confidence stays all-time.
  const today = "2026-10-17";
  m.state.dashboard.day = today;
  const selected = renderApp(m);
  const attempts = data.progress.attempts.filter(
    (attempt) => attempt.day === today,
  ).length;
  const solves = data.solves.filter((solve) => solve.day === today).length;
  assert.match(
    selected,
    new RegExp(`<strong>${attempts}</strong><span>Practice attempts</span>`),
  );
  assert.match(
    selected,
    new RegExp(`<strong>${solves}</strong><span>Solves</span>`),
  );
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
      ([label, path]) => label === "Profile" && path === "progress",
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

test("sign-in guest offer shows counts, preservation rules and an explicit skip on every account section", () => {
  const m = model();
  Object.assign(m.state.account, {
    email: "learner@example.test",
    profile: { username: "learner" },
    guestImportPending: true,
    guestImportComparison: {
      hasChanges: true,
      summary: {
        added: {
          attempts: 2,
          solves: 3,
          cubes: 1,
          selected: 4,
          known: 5,
          reviewed: 6,
        },
        duplicates: 0,
        conflicts: 0,
      },
    },
    guestImportPreview: {
      attempts: 2,
      solves: 3,
      cubes: 1,
      selected: 4,
      known: 5,
      reviewed: 6,
    },
    sync: { status: "synced" },
  });
  m.state.profilePage = { status: "ready", profile: m.state.account.profile };
  for (const section of ["settings", "edit"]) {
    m.state.accountSection = section;
    const html = renderApp(m);
    assert.match(html, /aria-label="Guest progress transfer"/);
    assert.match(html, /2 guest attempts, 3 solves/);
    assert.match(html, /data-action="account-import-guest"/);
    assert.match(html, /data-action="account-import-cancel"/);
    assert.match(html, /Keep separate/);
    assert.match(html, /Existing records, algorithm choices/);
  }
  m.state.account.guestImportPending = false;
  assert.doesNotMatch(renderApp(m), /aria-label="Guest progress transfer"/);
});

test("backup preview offers merge counts and explicit replacement with a legacy overlap explanation", () => {
  const m = model();
  m.state.backup = true;
  m.state.pendingImport = { progress: emptyProgress(), legacyAttempts: 2 };
  m.state.importPreview = {
    added: { attempts: 1, solves: 0, cubes: 0, selected: 2, reviewed: 1 },
    duplicates: 3,
    conflicts: 1,
  };
  let html = renderApp(m);
  assert.match(html, /data-action="merge-import"/);
  assert.match(html, /data-action="confirm-import"/);
  assert.match(html, /Merge adds 1 attempts, 0 solves/);
  assert.match(html, /3 matching records are counted once/);
  assert.match(html, /1 differing records keep the current\s+version/);
  assert.match(html, /different legacy backups may be added again/);
  m.state.importPreview = { error: "Unreadable current data" };
  html = renderApp(m);
  assert.match(html, /Merge unavailable: Unreadable current data/);
  assert.match(
    html,
    /<button(?=[^>]*data-action="merge-import")(?=[^>]*disabled)[^>]*>/,
  );
});

test("Settings retains the guest transfer review and account counts inside its dialog", () => {
  const m = model();
  m.state.view = "home";
  m.state.settings = true;
  Object.assign(m.state.account, {
    email: "learner@example.test",
    profile: { username: "learner" },
    guestImportPending: true,
    guestImportPreview: {
      attempts: 2,
      solves: 3,
      cubes: 1,
      selected: 4,
      known: 5,
      reviewed: 6,
    },
  });
  const settings = renderApp(m).split('id="settings-dialog"')[1];
  assert.match(settings, /aria-label="Guest progress transfer"/);
  assert.match(settings, /2 guest attempts, 3 solves/);
  assert.match(settings, /Your account currently has 0 attempts/);
  assert.match(settings, /data-action="account-import-cancel"/);
  assert.match(settings, /data-action="account-import-preview"/);
  m.state.view = "account";
  assert.equal(
    [...renderApp(m).matchAll(/aria-label="Guest progress transfer"/g)].length,
    1,
    "Settings owns the transfer controls while it is open",
  );
});

test("an open guest offer does not duplicate profile save feedback", () => {
  const m = model();
  m.state.accountSection = "edit";
  Object.assign(m.state.account, {
    email: "learner@example.test",
    profile: { username: "learner" },
    guestImportPending: true,
    guestImportPreview: {
      attempts: 0,
      solves: 0,
      cubes: 0,
      selected: 1,
      known: 0,
      reviewed: 0,
    },
    message: "Profile saved.",
  });
  assert.equal([...renderApp(m).matchAll(/>Profile saved\.<\/p>/g)].length, 1);
});

test("explicit guest review shows a no-change summary with a disabled import, and an unready comparison cannot apply", async () => {
  const { render } = await import("svelte/server");
  const { default: GuestTransfer } =
    await import("../src/components/GuestTransfer.svelte");
  const account = {
    sync: { status: "synced" },
    guestImportPreview: {
      attempts: 0,
      solves: 1,
      cubes: 0,
      selected: 1,
      known: 0,
      reviewed: 0,
    },
    guestImportComparison: {
      hasChanges: false,
      summary: {
        added: {
          attempts: 0,
          solves: 0,
          cubes: 0,
          selected: 0,
          known: 0,
          reviewed: 0,
        },
        duplicates: 1,
        conflicts: 1,
      },
    },
  };
  const html = render(GuestTransfer, { props: { account } }).body;
  assert.match(html, /No new guest progress/);
  assert.match(html, /1 differing records keep the current/);
  assert.match(
    html,
    /<button(?=[^>]*data-action="account-import-guest")(?=[^>]*disabled)[^>]*>/,
  );
  const close = html.match(
    /<button[^>]*data-action="account-import-cancel"[^>]*>([\s\S]*?)<\/button>/,
  )?.[1];
  assert.equal(close?.replace(/<!--[\s\S]*?-->/g, "").trim(), "Close");
  const waiting = render(GuestTransfer, {
    props: {
      account: {
        ...account,
        sync: { status: "syncing" },
        guestImportComparison: null,
      },
    },
  }).body;
  assert.match(waiting, /Finish syncing your account/);
  assert.match(
    waiting,
    /<button(?=[^>]*data-action="account-import-guest")(?=[^>]*disabled)[^>]*>/,
  );
});
