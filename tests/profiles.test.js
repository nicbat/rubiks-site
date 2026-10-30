import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import Profile from "../src/components/Profile.svelte";
import AccountIdentity from "../src/components/AccountIdentity.svelte";
import AccountData from "../src/components/AccountData.svelte";
import AccountProfile from "../src/components/AccountProfile.svelte";
import {
  username,
  validateProfile,
  profileRemote,
  profileDetails,
  validateProfileStats,
  visitorProfile,
  profileHasDraft,
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
      username: "forged",
      user_id: "other",
    }),
    {
      display_name: "Learner",
      bio: "Learning PLL",
      learning_goal: "Full PLL",
    },
  );
  for (const invalid of [
    { bio: "x".repeat(281) },
    { display_name: {} },
    { learning_goal: "x".repeat(121) },
  ])
    assert.throws(() => profileDetails(invalid));
  const api = profileRemote(client, "owner", config, async (url, options) => {
    assert.match(url, /user_id=eq.owner$/);
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), {
      display_name: "Name",
      bio: "Bio",
      learning_goal: "PLL",
    });
    return Response.json([
      {
        username: "learner",
        is_public: false,
        display_name: "Name",
        bio: "Bio",
        learning_goal: "PLL",
      },
    ]);
  });
  assert.equal(
    (
      await api.save({
        display_name: "Name",
        bio: "Bio",
        learning_goal: "PLL",
        user_id: "other",
      })
    ).display_name,
    "Name",
  );
});
const stats = {
  practice_count: 8,
  active_days: 4,
  confident_count: 2,
  case_count: 78,
  total_time_ms: 78000,
  solve_count: 12,
  best_ms: 1000,
  median_ms: 6500,
  best_ao5_ms: null,
  best_ao12_ms: 6500,
};
test("profile lookup asks the server for an allowed summary and rejects malformed aggregate responses", async () => {
  const requests = [];
  const api = profileRemote(null, null, config, async (url, options) => {
    requests.push(url);
    assert.match(url, /rpc\/profile_for_username$/);
    assert.deepEqual(JSON.parse(options.body), { profile_username: "learner" });
    return Response.json({
      username: "learner",
      is_public: true,
      stats,
      email: "secret",
      solves: [],
    });
  });
  assert.deepEqual((await api.find("learner")).stats, stats);
  assert.equal(requests.length, 1);
  assert.equal(validateProfileStats(null), null);
  for (const bad of [
    { ...stats, best_ms: Infinity },
    { ...stats, solve_count: -1 },
    { ...stats, active_days: "4" },
    { ...stats, confident_count: 79 },
    { ...stats, total_time_ms: null },
    {},
  ])
    assert.throws(() => validateProfileStats(bad));
});
test("missing profile RPC falls back to validated profile fields for owners and guests", async () => {
  for (const signedIn of [false, true]) {
    const requests = [];
    const api = profileRemote(
      signedIn ? client : null,
      signedIn ? "owner" : null,
      config,
      async (url, options) => {
        requests.push(url);
        assert.equal(
          options.headers.Authorization,
          signedIn ? "Bearer token" : undefined,
        );
        if (url.endsWith("/rpc/profile_for_username"))
          return Response.json({ code: "PGRST202" }, { status: 404 });
        const query = new URL(url).searchParams;
        assert.equal(query.get("username"), "eq.learner");
        assert.equal(
          query.get("select"),
          "username,is_public,display_name,bio,learning_goal",
        );
        return Response.json([
          {
            username: "learner",
            is_public: true,
            display_name: "Learner",
            bio: "Learning PLL",
            learning_goal: "Full PLL",
            email: "secret",
            solves: [{ notes: "private note" }],
          },
        ]);
      },
    );
    const profile = await api.find("LEARNER");
    assert.deepEqual(profile, {
      username: "learner",
      is_public: true,
      display_name: "Learner",
      bio: "Learning PLL",
      learning_goal: "Full PLL",
      stats: null,
    });
    assert.equal(requests.length, 2);
    const body = render(Profile, {
      props: { page: { status: "ready", profile } },
    }).body;
    assert.match(body, /Learner/);
    assert.match(body, /Progress summary is temporarily unavailable/);
    assert.match(body, /data-action="account-profile-retry"/);
    assert.doesNotMatch(
      body,
      /Profile could not be loaded|private note|secret|Activity summary|Timer summary/,
    );
  }
});
test("legacy lookup preserves unavailable profiles and rejects malformed rows", async () => {
  for (const rows of [
    [],
    [{ username: "LEARNER", is_public: true }],
    [
      { username: "learner", is_public: true },
      { username: "other", is_public: true },
    ],
  ]) {
    const api = profileRemote(null, null, config, async (url) =>
      url.endsWith("/rpc/profile_for_username")
        ? Response.json({ code: "PGRST202" }, { status: 404 })
        : Response.json(rows),
    );
    if (rows.length === 0) assert.equal(await api.find("learner"), null);
    else
      await assert.rejects(
        () => api.find("learner"),
        /Invalid profile response/,
      );
  }
});
test("only a missing RPC permits legacy lookup; auth, server and invalid responses remain errors", async () => {
  for (const response of [
    () => Response.json({ code: "42501" }, { status: 403 }),
    () => Response.json({ code: "PGRST202" }, { status: 500 }),
    () => Response.json({ code: "PGRST205" }, { status: 404 }),
    () => Response.json({ username: "learner", is_public: true, stats: {} }),
    () => {
      throw new TypeError("Failed to fetch");
    },
  ]) {
    let requests = 0;
    const api = profileRemote(null, null, config, async () => {
      requests++;
      return response();
    });
    await assert.rejects(() => api.find("learner"));
    assert.equal(requests, 1);
  }
});
test("retry uses the summary RPC again when a migration becomes available", async () => {
  let migrated = false;
  let legacyReads = 0;
  const profile = { username: "learner", is_public: true };
  const api = profileRemote(null, null, config, async (url) => {
    if (url.endsWith("/rpc/profile_for_username"))
      return migrated
        ? Response.json({ ...profile, stats })
        : Response.json({ code: "PGRST202" }, { status: 404 });
    legacyReads++;
    return Response.json([profile]);
  });
  assert.equal((await api.find("learner")).stats, null);
  migrated = true;
  assert.deepEqual((await api.find("learner")).stats, stats);
  assert.equal(legacyReads, 1);
});
test("profile rendering escapes bios and shows both summary rows, counts and goals without rendering private training rows", () => {
  const body = render(Profile, {
    props: {
      account: {},
      page: {
        status: "ready",
        message: "Profile link copied.",
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
  assert.match(body, /Best ao5/);
  assert.match(body, /aria-label="Activity summary"/);
  assert.match(body, /aria-label="Timer summary"/);
  assert.match(body, /All-time progress/);
  assert.match(body, /Find a learner/);
  assert.doesNotMatch(
    body,
    /profile-lookup-form|Individual solves|Activity heatmap|Your cases/,
  );
  assert.match(body, /Copy profile link/);
  assert.match(body, /Profile link copied/);
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
test("anonymous lookups need no auth session and unknown usernames stay unavailable", async () => {
  const api = profileRemote(null, null, config, async (url, options) => {
    assert.match(url, /rpc\/profile_for_username$/);
    assert.deepEqual(JSON.parse(options.body), { profile_username: "learner" });
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.apikey, config.key);
    return Response.json(null);
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
  const setup = render(AccountIdentity, { props: { account } }).body;
  assert.match(setup, /Choose your username/);
  assert.match(setup, /Create my page/);
  assert.doesNotMatch(setup, /data-action="account-sync"/);
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

test("visitor previews keep profiles discoverable, enforce statistics privacy and omit unsaved fields", () => {
  const profile = {
    username: "learner",
    is_public: false,
    display_name: "Saved name",
    bio: "Saved bio",
    learning_goal: "PLL",
    share_stats: false,
    stats,
    email: "private@example.test",
    solves: [{ notes: "private note" }],
  };
  assert.equal(visitorProfile(null), null);
  assert.deepEqual(visitorProfile(profile), {
    username: "learner",
    is_public: false,
    display_name: "Saved name",
    bio: "Saved bio",
    learning_goal: "PLL",
    stats: null,
  });
  const privateHtml = render(AccountProfile, {
    props: { account: { profile }, page: { status: "ready", profile } },
  }).body.split('aria-label="Visitor preview"')[1];
  assert.match(privateHtml, /Saved bio/);
  assert.match(privateHtml, /Statistics are private/);
  assert.doesNotMatch(privateHtml, /Activity summary|Timer summary|Try again/);
  assert.deepEqual(visitorProfile({ ...profile, is_public: true }), {
    username: "learner",
    is_public: true,
    display_name: "Saved name",
    bio: "Saved bio",
    learning_goal: "PLL",
    stats,
  });
  const shared = visitorProfile({
    ...profile,
    is_public: true,
    share_stats: true,
  });
  assert.deepEqual(shared.stats, stats);
  assert.notEqual(shared.stats, stats);
  const account = {
    profile: { ...profile, is_public: true },
    profileDraft: { ...profileDetails(profile), bio: "Unsaved draft" },
  };
  assert.equal(profileHasDraft(account), true);
  const html = render(AccountProfile, {
    props: { account, page: { status: "ready", profile } },
  }).body;
  const preview = html.split('aria-label="Visitor preview"')[1];
  assert.match(preview, /Saved bio/);
  assert.doesNotMatch(
    preview,
    /Unsaved draft|private@example.test|private note|Manage profile|profile-lookup-form/,
  );
  assert.match(preview, /Best ao5/);
  assert.doesNotMatch(
    html,
    /profile-share-stats|Show statistics on my public profile/,
  );
  assert.match(html, /unsaved profile changes/);
  assert.equal(
    profileHasDraft({ profile, profileDraft: profileDetails(profile) }),
    false,
  );
});

test("a private-profile owner can retry a missing summary RPC while visitor previews retain privacy", async () => {
  const raw = {
    username: "learner",
    is_public: false,
    display_name: "Learner",
  };
  let ready = false;
  const api = profileRemote(client, "owner", config, async (url) => {
    if (url.endsWith("/rpc/profile_for_username"))
      return ready
        ? Response.json({ ...raw, stats })
        : Response.json({ code: "PGRST202" }, { status: 404 });
    return Response.json([raw]);
  });
  const profile = await api.find("learner");
  const owner = render(Profile, {
    props: { account: { profile }, page: { status: "ready", profile } },
  }).body;
  assert.match(owner, /Progress summary is temporarily unavailable/);
  assert.match(owner, /data-action="account-profile-retry"/);
  assert.doesNotMatch(owner, /Statistics are private/);
  for (const props of [
    { account: {}, page: { status: "ready", profile } },
    { preview: true, account: { profile }, page: { status: "ready", profile } },
  ]) {
    const visitor = render(Profile, { props }).body;
    assert.match(visitor, /Statistics are private/);
    assert.doesNotMatch(
      visitor,
      /account-profile-retry|Activity summary|Timer summary/,
    );
  }
  ready = true;
  const restored = await api.find("learner");
  const html = render(Profile, {
    props: {
      account: { profile: restored },
      page: { status: "ready", profile: restored },
    },
  }).body;
  assert.match(html, /Activity summary/);
  assert.doesNotMatch(
    html,
    /Progress summary is temporarily unavailable|account-profile-retry/,
  );
});

test("signed-in visitors retain public fallback after owner-only table policies", async () => {
  for (const isPublic of [false, true]) {
    const calls = [];
    const api = profileRemote(client, "owner", config, async (url, options) => {
      calls.push({ url, authorization: options.headers.Authorization });
      if (url.endsWith("/rpc/profile_for_username"))
        return Response.json({ code: "PGRST202" }, { status: 404 });
      assert.equal(
        new URL(url).searchParams.get("select"),
        "username,is_public,display_name,bio,learning_goal",
      );
      return Response.json(
        options.headers.Authorization
          ? []
          : [{ username: "friend", is_public: isPublic, bio: "Learning PLL" }],
      );
    });
    const profile = await api.find("friend");
    assert.equal(profile?.username, "friend");
    assert.equal(profile.stats, null);
    assert.deepEqual(
      calls.map((call) => call.authorization),
      ["Bearer token", "Bearer token", undefined],
    );
    const html = render(Profile, {
      props: {
        account: { profile: { username: "learner" } },
        page: { status: "ready", profile },
      },
    }).body;
    assert.match(html, /Learning PLL/);
    assert.doesNotMatch(html, /This profile is unavailable/);
    assert.equal(
      html.includes('data-action="account-profile-retry"'),
      isPublic,
    );
    assert.equal(html.includes("Statistics are private"), !isPublic);
  }
});
