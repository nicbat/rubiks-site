import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import Profile from "../src/components/Profile.svelte";
import AccountSettings from "../src/components/AccountSettings.svelte";
import {
  username,
  validateProfile,
  profileRemote,
  profileDetails,
  validateProfileStats,
} from "../src/profiles.js";
import { removeAccountCache } from "../src/training-storage.js";

const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
};
const client = {
  auth: {
    getSession: async () => ({
      data: { session: { user: { id: "owner" }, access_token: "token" } },
    }),
  },
};
test("usernames normalize case and whitespace, reject reserved names, and have safe route characters", () => {
  assert.equal(username("  NicBat  "), "nicbat");
  assert.equal(username("learner_123"), "learner_123");
  for (const name of [
    "ab",
    "1learner",
    "a".repeat(25),
    "admin",
    "ADMIN",
    "settings",
    "a/b",
    "a b",
    "<script>",
    "café",
    "ab%20c",
    "ab?settings",
    "ab#home",
  ])
    assert.throws(() => username(name));
});
test("profile responses expose only username and visibility, without accepting invalid data", () => {
  assert.deepEqual(
    validateProfile({
      username: "learner",
      is_public: false,
      email: "private",
      payload: {},
    }),
    {
      username: "learner",
      is_public: false,
      display_name: "",
      bio: "",
      learning_goal: "",
      share_stats: false,
    },
  );
  for (const value of [
    null,
    {},
    { username: "LEARNER", is_public: true },
    { username: "learner", is_public: "true" },
  ])
    assert.throws(() => validateProfile(value));
});

test("profile edits validate bounded plain text and send only editable fields", async () => {
  assert.deepEqual(
    profileDetails({
      display_name: "  Learner  ",
      bio: "Learning PLL",
      learning_goal: "Full PLL",
      share_stats: true,
      username: "forged",
      user_id: "other",
    }),
    {
      display_name: "Learner",
      bio: "Learning PLL",
      learning_goal: "Full PLL",
      share_stats: true,
    },
  );
  for (const invalid of [
    { bio: "x".repeat(281) },
    { display_name: {} },
    { learning_goal: "x".repeat(121) },
    { share_stats: "yes" },
  ])
    assert.throws(() => profileDetails(invalid));
  const api = profileRemote(client, "owner", config, async (url, options) => {
    assert.match(url, /user_id=eq.owner$/);
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), {
      display_name: "Name",
      bio: "Bio",
      learning_goal: "PLL",
      share_stats: false,
    });
    return Response.json([
      {
        username: "learner",
        is_public: false,
        display_name: "Name",
        bio: "Bio",
        learning_goal: "PLL",
        share_stats: false,
      },
    ]);
  });
  assert.equal(
    (
      await api.save({
        display_name: "Name",
        bio: "Bio",
        learning_goal: "PLL",
        share_stats: false,
        user_id: "other",
      })
    ).display_name,
    "Name",
  );
});
const stats = {
  solve_count: 12,
  best_ms: 1000,
  ao5_ms: null,
  ao5_dnf: true,
  ao12_ms: 6500,
  ao12_dnf: false,
  known_count: 3,
};
test("profile lookup asks the server for an allowed summary and rejects malformed aggregate responses", async () => {
  const requests = [];
  const api = profileRemote(null, null, config, async (url, options) => {
    requests.push(url);
    if (url.includes("rpc/")) {
      assert.deepEqual(JSON.parse(options.body), {
        profile_username: "learner",
      });
      return Response.json(stats);
    }
    return Response.json([
      { username: "learner", is_public: true, share_stats: true },
    ]);
  });
  assert.deepEqual((await api.find("learner")).stats, stats);
  assert.equal(requests.length, 2);
  assert.equal(validateProfileStats(null), null);
  for (const bad of [
    { ...stats, best_ms: Infinity },
    { ...stats, solve_count: -1 },
    { ...stats, ao5_dnf: "true" },
    {},
  ])
    assert.throws(() => validateProfileStats(bad));
});
test("profile rendering escapes bios and shows DNF, counts and goals without rendering private training rows", () => {
  const body = render(Profile, {
    props: {
      account: {},
      page: {
        status: "ready",
        profile: {
          username: "learner",
          is_public: true,
          display_name: "Learner",
          bio: "<script>alert(1)</script>",
          learning_goal: "Full PLL",
          stats,
          solves: [{ notes: "private note" }],
        },
      },
    },
  }).body;
  assert.match(body, /&lt;script/);
  assert.doesNotMatch(body, /<script>|private note/);
  assert.match(body, /Full PLL/);
  assert.match(body, /Average of 5/);
  assert.match(body, /DNF/);
  assert.match(body, /Copy profile link/);
});
test("account deletion passes a confirmation without accepting a target user and propagates failures", async () => {
  const api = profileRemote(client, "owner", config, async (url, options) => {
    assert.match(url, /rpc\/delete_my_account$/);
    assert.deepEqual(JSON.parse(options.body), { confirmation: "learner" });
    return Response.json(true);
  });
  await api.deleteAccount("learner");
  const failed = profileRemote(client, "owner", config, async () =>
    Response.json(false),
  );
  await assert.rejects(() => failed.deleteAccount("learner"));
});
test("removing a deleted account cache preserves guest data and other account caches", () => {
  const values = new Map([
    ["last-layer.progress.v2", "guest"],
    ["last-layer.account.owner.last-layer.progress.v2", "account"],
    ["last-layer.account.owner.last-layer.sync.v1", "baseline"],
    ["last-layer.account.other.last-layer.progress.v2", "other"],
    ["last-layer.account.owner2.last-layer.progress.v2", "similar prefix"],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i] ?? null,
    removeItem: (key) => values.delete(key),
  };
  removeAccountCache(storage, "owner");
  assert.deepEqual([...values.values()], ["guest", "other", "similar prefix"]);
  assert.throws(() => removeAccountCache(storage, "../other"));
});
test("claiming a username uses the signed-in owner, lets the server choose private visibility, and maps uniqueness races", async () => {
  const requests = [];
  const api = profileRemote(client, "owner", config, async (url, options) => {
    requests.push({ url, options });
    return Response.json([{ username: "learner", is_public: false }]);
  });
  assert.equal((await api.claim("LEARNER")).is_public, false);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    user_id: "owner",
    username: "learner",
  });
  assert.equal(requests[0].options.headers.Authorization, "Bearer token");
  const taken = profileRemote(client, "owner", config, async () =>
    Response.json({ code: "23505" }, { status: 409 }),
  );
  await assert.rejects(() => taken.claim("learner"), /already taken/);
});
test("anonymous lookups need no auth session and cannot infer private profile existence", async () => {
  const api = profileRemote(null, null, config, async (url, options) => {
    assert.match(url, /username=eq.learner$/);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.apikey, config.key);
    return Response.json([]);
  });
  assert.equal(await api.find("learner"), null);
  await assert.rejects(() => api.find("../private"));
});
test("visibility changes update only the signed-in profile and stale identities cannot send requests", async () => {
  const api = profileRemote(client, "owner", config, async (url, options) => {
    assert.match(url, /user_id=eq.owner$/);
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { is_public: true });
    return Response.json([{ username: "learner", is_public: true }]);
  });
  assert.equal((await api.visibility(true)).is_public, true);
  let requested = false;
  const stale = profileRemote(client, "different", config, async () => {
    requested = true;
  });
  await assert.rejects(() => stale.claim("learner"), /session changed/);
  assert.equal(requested, false);
});
test("account setup requires a username before sync and profile views do not render private fields", () => {
  const account = {
    configured: true,
    email: "owner@example.com",
    sync: { message: "Saved", status: "idle" },
  };
  const setup = render(AccountSettings, { props: { account } }).body;
  assert.match(setup, /Choose your username/);
  assert.match(setup, /Create my page/);
  assert.match(setup, /disabled[^>]*>(?:<!---->)?Sync now/);
  assert.match(setup, /pattern="\[A-Za-z\]\[A-Za-z0-9_\]\{2,23\}"/);
  const profile = render(Profile, {
    props: {
      page: {
        status: "ready",
        profile: {
          username: "learner",
          is_public: true,
          email: "secret@example.com",
          solves: [{ notes: "secret notes" }],
        },
      },
      account: {},
    },
  }).body;
  assert.match(profile, /@learner/);
  assert.doesNotMatch(profile, /secret@example.com|secret notes/);
});
