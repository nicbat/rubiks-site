import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import {
  createDemoAccount,
  DEMO_CODE,
  DEMO_SCENARIOS,
  demoStats,
} from "../src/demo-account.js";
import { emptyProgress, STORAGE_KEY } from "../src/progress.js";
import {
  trainingBackup,
  validateBackup,
  restoreBackup,
} from "../src/training-backup.js";
import { createTrainingStorage } from "../src/training-storage.js";
import { render } from "svelte/server";
import AccountIdentity from "../src/components/AccountIdentity.svelte";
import AccountProfile from "../src/components/AccountProfile.svelte";
import AccountData from "../src/components/AccountData.svelte";

const data = () =>
  trainingBackup(
    {
      ...emptyProgress(),
      known: { "pll-T": [0] },
      twoLookKnown: { "pll-T": [0] },
    },
    [1, 2, 3, 4, 5].map((i) => ({
      id: `solve-${i}`,
      elapsed: i * 1000,
      date: `2026-10-20T00:00:0${i}Z`,
      day: "2026-10-20",
      scramble: Array(10).fill("R U").join(" "),
    })),
    { cubes: [], defaultId: null },
  );

test("test mode starts with a fake account and derives its summary from sample training", () => {
  const demo = createDemoAccount(data);
  assert.equal(demo.session.user.email, "learner@example.test");
  assert.equal(demo.profile.is_public, false);
  assert.deepEqual(demo.find("demo_learner").stats, {
    solve_count: 5,
    best_ms: 1000,
    ao5_ms: 3000,
    ao5_dnf: false,
    ao12_ms: null,
    ao12_dnf: false,
    known_count: 1,
  });
  const changed = data();
  changed.solves[3].penalty = changed.solves[4].penalty = "dnf";
  assert.equal(demoStats(changed).ao5_dnf, true);
});
test("demo sign-in, setup and profile controls work without invoking network services", (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw Error("Demo must not fetch");
  });
  const demo = createDemoAccount(data);
  demo.reset("signed-out");
  assert.equal(demo.session, null);
  assert.equal(demo.find("demo_learner"), null);
  demo.sendEmail("contributor@example.test");
  assert.throws(() => demo.verifyCode("wrong"), /123456/);
  demo.verifyCode(DEMO_CODE);
  assert.equal(demo.session.user.email, "contributor@example.test");
  demo.reset("setup");
  assert.equal(demo.profile, null);
  assert.throws(() => demo.claim("demo_friend"), /taken/);
  assert.throws(() => demo.claim("admin"));
  assert.equal(demo.claim("New_Learner").username, "new_learner");
  demo.save({
    display_name: "New Learner",
    bio: "Learning",
    learning_goal: "Full PLL",
    share_stats: false,
  });
  demo.visibility(true);
  demo.signOut();
  assert.equal(demo.find("new_learner").stats, null);
  assert.equal(demo.find("new_learner").display_name, "New Learner");
  assert.equal(demo.find("demo_private"), null);
  assert.equal(demo.find("missing_learner"), null);
  assert.equal(demo.find("demo_friend").stats.solve_count, 240);
});
test("demo states, conflict resolution and retry remain deterministic and local", () => {
  const demo = createDemoAccount(data);
  for (const [scenario] of DEMO_SCENARIOS) {
    demo.reset(scenario);
    assert.equal(demo.scenario, scenario);
  }
  assert.throws(() => demo.reset("unknown"));
  demo.reset("offline");
  assert.equal(demo.sync().status, "error");
  demo.reset("conflict");
  assert.equal(demo.sync().mergeConflict, true);
  assert.equal(demo.sync("cloud").status, "synced");
  assert.equal(demo.scenario, "signed-in");
});
test("demo deletion and edits cannot mutate personal storage, other sessions, or returned objects", () => {
  const values = new Map([
    [STORAGE_KEY, JSON.stringify({ ...emptyProgress(), selected: ["pll-T"] })],
    [
      `last-layer.account.real-user.${STORAGE_KEY}`,
      JSON.stringify(emptyProgress()),
    ],
  ]);
  const personal = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const before = [...values];
  const storage = createTrainingStorage(personal, data);
  storage.setAccount("real-user");
  storage.setTestData(true);
  const demo = createDemoAccount(data);
  assert.doesNotThrow(() => validateBackup(demo.guestBackup(), catalog));
  restoreBackup(storage.target, demo.guestBackup());
  const returned = demo.profile;
  returned.username = "mutated";
  const session = demo.session;
  session.user.email = "other@example.test";
  assert.equal(demo.profile.username, "demo_learner");
  assert.equal(demo.session.user.email, "learner@example.test");
  assert.throws(() => demo.deleteAccount("wrong"));
  demo.deleteAccount("demo_learner");
  assert.equal(demo.session, null);
  assert.equal(demo.profile, null);
  storage.setTestData(false);
  assert.deepEqual([...values], before);
  demo.reset();
  assert.equal(demo.profile.username, "demo_learner");
});
test("the shared account UI enables fake controls in test mode and identifies the simulation", () => {
  const demo = createDemoAccount(data);
  const props = {
    testData: true,
    account: {
      demo: true,
      configured: true,
      email: demo.session.user.email,
      profile: demo.profile,
      profileDraft: demo.profile,
      sync: demo.sync(),
    },
  };
  const html =
    [AccountIdentity, AccountProfile, AccountData]
      .map((component) => render(component, { props }).body)
      .join("") +
    render(AccountData, { props: { ...props, mode: "data" } }).body;
  assert.match(html, /Demo account/);
  assert.match(html, /data-action="account-visibility"/);
  assert.doesNotMatch(
    html,
    /disabled[^>]*data-action="account-(visibility|signout|export|delete-preview)"/,
  );
  assert.doesNotMatch(html, /Sync paused for test data/);
});
