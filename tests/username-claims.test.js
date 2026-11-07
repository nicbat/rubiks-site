import { test } from "node:test";
import assert from "node:assert/strict";
import { username, profileRemote } from "../src/profiles.js";

const config = { url: "https://example.supabase.co", key: "public" };
const client = {
  auth: {
    getSession: async () => ({
      data: { session: { user: { id: "owner" }, access_token: "token" } },
    }),
  },
};

test("username validation gives a specific, actionable reason and accepts trimmed boundary values", () => {
  for (const [value, message] of [
    ["ab", /3–24/],
    ["a".repeat(25), /3–24/],
    ["1learner", /Start.*English letter/],
    ["éclair", /English letter/],
    ["cube-learner", /only English letters/],
    ["cube learner", /only English letters/],
    ["cube.learner", /only English letters/],
    ["learner😀", /only English letters/],
    [" ADMIN ", /reserved/],
    ["support", /reserved/],
  ])
    assert.throws(() => username(value), message);
  assert.equal(username("  AbC  "), "abc");
  assert.equal(username(` A${"_".repeat(23)} `), `a${"_".repeat(23)}`);
});

test("duplicate claim recovers the owner's already completed setup without renaming", async () => {
  for (const existing of ["learner", "other_tab_name"]) {
    const calls = [];
    const api = profileRemote(client, "owner", config, async (url, options) => {
      calls.push({ url, method: options.method });
      if (options.method === "POST")
        return Response.json({ code: "23505" }, { status: 409 });
      assert.match(url, /user_id=eq.owner$/);
      assert.equal(options.headers.Authorization, "Bearer token");
      return Response.json([{ username: existing, is_public: false }]);
    });
    assert.equal((await api.claim("LEARNER")).username, existing);
    assert.deepEqual(
      calls.map((call) => call.method),
      ["POST", "GET"],
    );
    assert.ok(calls.every((call) => !call.url.includes("username=eq.")));
  }
});

test("another owner's collision remains taken even when their statistics are private", async () => {
  const api = profileRemote(client, "owner", config, async (_url, options) =>
    options.method === "POST"
      ? Response.json({ code: "23505" }, { status: 409 })
      : Response.json([]),
  );
  await assert.rejects(
    () => api.claim("learner"),
    /^Error: That username is already taken\. Choose another name\.$/,
  );
});

test("claim recovery failures remain errors and unrelated failures do not trigger owner lookup", async () => {
  for (const status of [403, 500]) {
    const calls = [];
    const api = profileRemote(
      client,
      "owner",
      config,
      async (_url, options) => {
        calls.push(options.method);
        return options.method === "POST"
          ? Response.json({ code: "23505" }, { status: 409 })
          : Response.json({ code: "42501" }, { status });
      },
    );
    await assert.rejects(() => api.claim("learner"), /Cloud request failed/);
    assert.deepEqual(calls, ["POST", "GET"]);
  }
  let calls = 0;
  const api = profileRemote(client, "owner", config, async () => {
    calls++;
    return Response.json({ code: "42501" }, { status: 403 });
  });
  await assert.rejects(() => api.claim("learner"), /Cloud request failed/);
  assert.equal(calls, 1);
});
